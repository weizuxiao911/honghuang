import * as vscode from 'vscode';

const log = (...args: unknown[]) => console.log('>>>[yunyan-paper-web]', ...args);

const VIEW_TYPE = 'yunyan-paperPlugin.paperEditor';

interface QuestionBase {
  id?: string;
  type: string;
  score?: number;
  [key: string]: unknown;
}

interface PaperDetail {
  title: string;
  questions: QuestionBase[];
  totalScore: number;
  questionCount: number;
}

type PaperViewState =
  | { status: 'ready'; title: string; paper: PaperDetail }
  | { status: 'empty'; title: string; description: string }
  | { status: 'error'; title: string; description: string; detail?: string };

// 从相对/绝对 URI path 里取最后一段（浏览器可用，代替 path.basename）。
function basename(p: string): string {
  const clean = p.split(/[?#]/)[0];
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] || clean;
}

function stripExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

function resolvePaperFromContent(fileName: string, raw: string): PaperViewState {
  const tabTitle = basename(fileName);
  const displayTitle = stripExt(tabTitle);
  const trimmed = raw.trim();

  if (!trimmed) {
    return { status: 'empty', title: tabTitle, description: '当前试卷内容为空，请录入题目后再试。' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      parsed = JSON.parse(`[${trimmed}]`);
    } catch {
      return {
        status: 'error',
        title: tabTitle,
        description: '试卷文件不是合法的 JSON，请检查逗号、引号和括号是否完整。',
        detail: '请将以上内容发给 AI 协助修正。',
      };
    }
  }

  let questions: QuestionBase[];
  if (Array.isArray(parsed)) {
    questions = parsed as QuestionBase[];
  } else if (parsed && typeof parsed === 'object') {
    questions = [parsed as QuestionBase];
  } else {
    return {
      status: 'error',
      title: tabTitle,
      description: '试卷文件结构不正确，请使用题目数组或逗号分隔的多个题目对象。',
      detail: '请将以上内容发给 AI 协助修正。',
    };
  }

  questions = questions.filter((q) => q && typeof q === 'object' && Object.keys(q).length > 0);

  if (questions.length === 0) {
    return { status: 'empty', title: tabTitle, description: '当前试卷暂无题目，请录入至少一道题后再试。' };
  }

  const totalScore = questions.reduce((sum, item) => {
    const score = (item as { score?: unknown }).score;
    return sum + (typeof score === 'number' && Number.isFinite(score) ? score : 0);
  }, 0);

  return {
    status: 'ready',
    title: tabTitle,
    paper: { title: displayTitle, questions, totalScore, questionCount: questions.length },
  };
}

function getNonce(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// 内嵌 webview manifest（打包时由 esbuild --define 注入）
declare const __PAPER_MANIFEST__: string;

interface ViteManifestEntry {
  file: string;
  css?: string[];
  imports?: string[];
}

function collectAllCss(manifest: Record<string, ViteManifestEntry>, entryName: string): string[] {
  const collected = new Set<string>();
  const visited = new Set<string>();
  const walk = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    const chunk = manifest[name];
    if (!chunk) return;
    for (const css of chunk.css ?? []) collected.add(css);
    for (const imp of chunk.imports ?? []) walk(imp);
  };
  walk(entryName);
  return Array.from(collected);
}

function joinUri(base: vscode.Uri, ...segments: string[]): vscode.Uri {
  return vscode.Uri.joinPath(base, ...segments);
}

function buildHtml(webview: vscode.Webview, extensionUri: vscode.Uri, initialState: PaperViewState): string {
  const manifest = JSON.parse(__PAPER_MANIFEST__) as Record<string, ViteManifestEntry>;
  const entry = manifest['index.html'];
  const scriptUri = webview.asWebviewUri(joinUri(extensionUri, 'webview', 'dist', entry.file));
  const cssFiles = collectAllCss(manifest, 'index.html');
  const styleUris = cssFiles.map((file) =>
    webview.asWebviewUri(joinUri(extensionUri, 'webview', 'dist', file)).toString()
  );
  const nonce = getNonce();
  const stateJson = JSON.stringify(initialState).replace(/</g, '\\u003c');
  const runtime = JSON.stringify({
    codeTestUrl: '',
    codePlayerUrl: '',
    labCode: '',
    communityBaseUrl: '',
  }).replace(/</g, '\\u003c');

  // 静态资源通过 asWebviewUri 转成 https://<registry>/... 域，需要把每个资源的 origin 都
  // 加进 CSP style-src/img-src/script-src，否则浏览器会拒绝加载。webview.cspSource 只覆盖
  // OpenSumi 默认域，跨域 langhuan 分发域必须显式补充。
  const originSet = new Set<string>();
  const scriptOrigin = safeOrigin(scriptUri.toString());
  if (scriptOrigin) originSet.add(scriptOrigin);
  for (const uri of styleUris) {
    const o = safeOrigin(uri);
    if (o) originSet.add(o);
  }
  const extraOrigins = Array.from(originSet).join(' ');
  const styleSrc = `${webview.cspSource} ${extraOrigins} 'unsafe-inline'`;
  const scriptSrc = `${webview.cspSource} ${extraOrigins} 'nonce-${nonce}'`;
  const imgSrc = `${webview.cspSource} ${extraOrigins} https: data:`;
  const fontSrc = `${webview.cspSource} ${extraOrigins} data:`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src ${styleSrc}; script-src ${scriptSrc}; font-src ${fontSrc}; connect-src ${extraOrigins} https:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${styleUris.map((u) => `<link rel="stylesheet" href="${u}" />`).join('\n')}
    <title>题目</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__PAPER_INITIAL_STATE__ = ${stateJson};window.__WEBVIEW_RUNTIME_CONFIG__ = ${runtime};</script>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

class PaperEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist')],
    };

    const initial = resolvePaperFromContent(document.uri.path, document.getText());
    panel.title = initial.title;
    panel.webview.html = buildHtml(panel.webview, this.context.extensionUri, initial);

    const push = async (state: PaperViewState) => {
      panel.title = state.title;
      try {
        await panel.webview.postMessage({ type: 'paper:update', data: state });
      } catch (err) {
        log('postMessage failed', err);
      }
    };

    const changeSub = vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      await push(resolvePaperFromContent(document.uri.path, e.document.getText()));
    });

    const msgSub = panel.webview.onDidReceiveMessage(async (message: any) => {
      if (message?.type !== 'rpc-request') return;
      // 浏览器兼容版仅回复 not-supported，写库/开外链等 Node 依赖能力另行接入。
      try {
        await panel.webview.postMessage({
          type: 'rpc-response',
          requestId: message.requestId,
          success: false,
          error: '浏览器环境暂不支持该操作',
        });
      } catch {
        /* ignore */
      }
    });

    panel.onDidDispose(() => {
      changeSub.dispose();
      msgSub.dispose();
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  log('activate');
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new PaperEditorProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    })
  );
}

export function deactivate() {
  return undefined;
}
