import * as vscode from 'vscode'
import { resolvePaperFromContent } from '../services/paperFileService'
import { PaperWebviewHost } from './PaperWebviewHost'

export const PAPER_CUSTOM_EDITOR_VIEW_TYPE = 'yunyan.paperEditor'

/**
 * 让 .paper 文件在工作区中直接以插件 Webview 形式打开。
 * 保留原有命令面板模式，文件双击则走这里的自定义编辑器模式。
 */
export class PaperCustomEditorProvider implements vscode.CustomTextEditorProvider {
  /** 当前活动的 paper editor panel (供 tab 栏 action 命令触发存入试卷库) */
  static activePanel: vscode.WebviewPanel | null = null

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    PaperCustomEditorProvider.activePanel = webviewPanel

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        // browser 环境 Uri.joinPath 不可用 (CodeBlitz), 用字符串拼接
        vscode.Uri.parse(`${this.context.extensionUri.toString().replace(/\/$/, '')}/webview/dist`)
      ]
    }

    const paperState = resolvePaperFromContent(document.uri.fsPath, document.getText())
    const host = new PaperWebviewHost({
      panel: webviewPanel,
      extensionUri: this.context.extensionUri,
      paperState
    })

    const changeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.uri.toString() !== document.uri.toString()) {
        return
      }

      const nextPaperState = resolvePaperFromContent(document.uri.fsPath, event.document.getText())
      await host.updatePaperState(nextPaperState)
    })

    webviewPanel.onDidDispose(() => {
      if (PaperCustomEditorProvider.activePanel === webviewPanel) {
        PaperCustomEditorProvider.activePanel = null
      }
      changeDisposable.dispose()
      host.dispose()
    })
  }
}
