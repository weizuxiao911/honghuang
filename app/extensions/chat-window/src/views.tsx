// 通过 window 全局读取 host 端 (app/index.tsx) 注入的 React + ReactDOM，
// 避免 CodeBlitz requireInterceptor 对 'react' 返回 undefined 导致 hooks 报 null。
const React = (window as any).React;
const { useState, useEffect, useRef, useCallback } = React;

import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';

function getBaseUrl(): string {
  const cfg = (window as any).__TAICHU_RUNTIME__;
  if (!cfg?.baseUrl) {
    throw new Error('[Taichu] runtime baseUrl not resolved; ensure app has bootstrapped gateway');
  }
  return cfg.baseUrl;
}
const ACTIVE_SESSION_KEY = 'taichu.activeSessionId';

// opencode SDK client 延迟初始化（首次调用时 runtime baseUrl 已注入）
let _client: ReturnType<typeof createOpencodeClient> | null = null;
function getClient() {
  if (!_client) {
    _client = createOpencodeClient({
      baseUrl: getBaseUrl(),
      responseStyle: 'fields',
      throwOnError: true,
    });
  }
  return _client;
}

const CSS = `
.an-cw { display:flex; flex-direction:column; height:100%; width:100%; box-sizing:border-box; font-size:14px; color:var(--sideBar-foreground,var(--foreground)); background:transparent; position:relative; overflow:hidden; }
.an-cw__assistant { display:flex; align-items:center; gap:10px; padding:16px 20px 4px; flex-shrink:0; }
.an-cw__assistant-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg, #8b5cf6, #6366f1); display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px; font-weight:600; flex-shrink:0; }
.an-cw__assistant-info { flex:1; min-width:0; }
.an-cw__assistant-name { font-size:16px; font-weight:600; line-height:1.3; }
.an-cw__assistant-desc { font-size:12px; color:var(--descriptionForeground); line-height:1.5; margin-top:2px; }
.an-cw__assistant-edit { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--descriptionForeground); cursor:pointer; user-select:none; background:transparent; border:none; }
.an-cw__assistant-edit:hover { background:var(--list-hoverBackground); color:var(--foreground); }
.an-cw__intro-card { margin:8px 20px 16px; padding:14px 16px; border-radius:10px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); color:var(--descriptionForeground); font-size:13px; line-height:1.6; }
.an-cw__scroll { flex:1; min-height:0; overflow-y:auto; padding:6px 20px 12px; display:flex; flex-direction:column; gap:14px; }
.an-cw__empty { margin:auto; padding:30px 20px; text-align:center; color:var(--descriptionForeground); line-height:1.7; user-select:none; font-size:13px; }
.an-cw__msg { display:flex; flex-direction:column; gap:4px; }
.an-cw__msg-role { font-size:11px; font-weight:600; letter-spacing:.04em; color:var(--descriptionForeground); user-select:none; padding:0 6px; }
.an-cw__msg.is-user { align-items:flex-end; }
.an-cw__msg.is-user .an-cw__msg-role { color:var(--textLink-foreground,var(--focusBorder)); }
.an-cw__bubble { padding:9px 14px; border-radius:14px; max-width:85%; white-space:pre-wrap; word-break:break-word; line-height:1.55; font-size:14px; }
.an-cw__msg.is-user .an-cw__bubble { background:var(--list-activeSelectionBackground); color:var(--list-activeSelectionForeground,inherit); border-top-right-radius:4px; }
.an-cw__msg.is-assistant .an-cw__bubble { background:rgba(255,255,255,0.04); border:1px solid var(--editorWidget-border,var(--input-border,transparent)); border-top-left-radius:4px; }
.an-cw__bubble--err { color:var(--inputValidation-errorForeground,var(--errorForeground)); }
.an-cw__part-reason { margin:6px 0; padding:8px 12px; border-radius:8px; font-size:13px; opacity:.8; font-style:italic; background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.18); }
.an-cw__cursor::after { content:'\\258C'; display:inline-block; animation:an-cw-blink 1s steps(2) infinite; margin-left:2px; opacity:.6; }
@keyframes an-cw-blink { 50% { opacity:0; } }
.an-cw__err { margin:0 20px 8px; padding:8px 12px; border-radius:8px; font-size:12px; color:var(--inputValidation-errorForeground,var(--errorForeground)); background:var(--inputValidation-errorBackground,transparent); border:1px solid var(--inputValidation-errorBorder,currentColor); }
.an-cw__examples { padding:0 20px 12px; display:flex; flex-direction:column; gap:6px; }
.an-cw__examples-label { font-size:12px; color:var(--descriptionForeground); margin-bottom:4px; }
.an-cw__examples-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.an-cw__example { padding:6px 10px; border-radius:8px; font-size:12px; background:rgba(255,255,255,0.04); border:1px solid var(--editorWidget-border, transparent); cursor:pointer; user-select:none; color:var(--descriptionForeground); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.an-cw__example:hover { background:rgba(99,102,241,0.1); border-color:rgba(99,102,241,0.3); color:var(--foreground); }
.an-cw__work { padding:0 20px 10px; font-size:12px; color:var(--descriptionForeground); }
.an-cw__work a, .an-cw__work span { color:var(--textLink-foreground,var(--focusBorder)); cursor:pointer; }
.an-cw__work a:hover, .an-cw__work span:hover { text-decoration:underline; }
.an-cw__foot { padding:8px 20px 14px 20px; display:flex; flex-direction:column; gap:4px; flex-shrink:0; background:transparent; }
.an-cw__composer { padding:10px 12px; border-radius:18px; background:var(--input-background); border:1px solid var(--input-border, transparent); transition:border-color .15s; }
.an-cw__composer:focus-within { border-color:rgba(99,102,241,0.6); box-shadow:0 0 0 4px rgba(99,102,241,0.08); }
.an-cw__composer-textarea { display:block; width:100%; min-height:32px; max-height:240px; resize:none; border:none; outline:none; background:transparent; color:var(--input-foreground,inherit); font:inherit; line-height:1.6; padding:4px 0; }
.an-cw__composer-textarea::placeholder { color:var(--input-placeholderForeground); }
.an-cw__composer-tools { display:flex; align-items:center; gap:6px; margin-top:8px; font-size:12px; color:var(--descriptionForeground); }
.an-cw__tool { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; cursor:pointer; user-select:none; background:transparent; border:none; color:var(--descriptionForeground); }
.an-cw__tool:hover { background:var(--list-hoverBackground); color:var(--foreground); }
.an-cw__tools-spacer { flex:1; }
.an-cw__model { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:5px; cursor:pointer; user-select:none; font-size:12px; color:var(--descriptionForeground); }
.an-cw__model:hover { background:var(--list-hoverBackground); color:var(--foreground); }
.an-cw__send { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; user-select:none; color:#fff; background:#6366f1; border:none; font-weight:600; font-size:14px; box-shadow:0 2px 8px rgba(99,102,241,0.35); }
.an-cw__send:hover:not(:disabled) { background:#4f46e5; box-shadow:0 2px 12px rgba(99,102,241,0.5); }
.an-cw__send:disabled { opacity:.4; cursor:not-allowed; box-shadow:none; background:var(--button-secondaryBackground, #475569); }
.an-cw__send-abort { background:#ef4444; }
.an-cw__send-abort:hover:not(:disabled) { background:#dc2626; box-shadow:0 2px 12px rgba(239,68,68,0.5); }
.an-cw__status { font-size:11px; color:var(--descriptionForeground); display:flex; align-items:center; gap:6px; padding:0 4px; }
.an-cw__status-dot { width:6px; height:6px; border-radius:50%; background:var(--descriptionForeground); }
.an-cw__status-dot.is-live { background:#22c55e; }
.an-cw__status-dot.is-busy { background:#eab308; animation:an-cw-pulse 1s infinite; }
.an-cw__status-dot.is-error { background:#ef4444; }
@keyframes an-cw-pulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }
.an-cw__status-spacer { flex:1; }
`;

function useInjectStyle() {
  useEffect(() => {
    if (document.getElementById('app-chat-window-style')) return;
    const el = document.createElement('style');
    el.id = 'app-chat-window-style';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const EXAMPLES = [
  '分析当前项目结构并提出改进建议',
  '自动执行构建和部署流程',
  '总结项目中的关键信息',
  '生成项目 README 文档',
];

const ChatWindow = () => {
  useInjectStyle();
  const [sessionID, setSessionID] = useState(() => {
    try { return localStorage.getItem(ACTIVE_SESSION_KEY) || ''; } catch { return ''; }
  });
  const [rows, setRows] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streamingPartID, setStreamingPartID] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [model, setModel] = useState('ling-3.0-flash-free');
  const sessionIDRef = useRef(sessionID);
  useEffect(() => { sessionIDRef.current = sessionID; }, [sessionID]);

  useEffect(() => {
    let cancelled = false;
    if (!sessionID) { setSessionTitle(''); return; }
    (async () => {
      try {
        const r = await fetch(`${getBaseUrl()}/session/${sessionID}`, { headers: { Accept: 'application/json' } });
        if (cancelled) return;
        if (r.ok) {
          const d = await r.json();
          setSessionTitle(d.title || d.slug || '');
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [sessionID]);

  useEffect(() => {
    const onChange = (e) => setSessionID(e?.detail?.id || '');
    const onStorage = (e) => {
      if (e.key === ACTIVE_SESSION_KEY) setSessionID(e.newValue || '');
    };
    // 扩展 activate 完毕，主应用会派发 app:extensions-ready；
    // 视图收到后重新拉一次当前 session 的消息，保证首屏渲染晚于扩展 host 就绪。
    const onReady = () => {
      const cur = sessionIDRef.current;
      if (cur) loadMessages(cur);
    };
    window.addEventListener('app:session-changed', onChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('app:extensions-ready', onReady);
    return () => {
      window.removeEventListener('app:session-changed', onChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('app:extensions-ready', onReady);
    };
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) { setRows([]); return; }
    try {
      const { data } = await getClient().session.messages({ sessionID: id, limit: 200 });
      const list = (data || []).slice().sort((a, b) => (a.info.time?.created || 0) - (b.info.time?.created || 0));
      setRows(list);
      setError('');
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    setStreamingPartID('');
    loadMessages(sessionID);
  }, [sessionID, loadMessages]);

  // SSE 监听
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let stream = null;

    (async () => {
      while (!cancelled) {
        try {
          const result = await getClient().global.event();
          setLive(true);
          attempt = 0;
          stream = result.stream;
          for await (const ev of stream) {
            if (cancelled) break;
            const payload = ev?.payload ?? ev;
            handleEvent(payload);
          }
        } catch { }
        setLive(false);
        stream = null;
        if (cancelled) break;
        attempt++;
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 15000)));
      }
    })();

    function handleEvent(ev) {
      const type = ev.type;
      const props = ev.properties || {};
      const currentSid = sessionIDRef.current;
      const evSid = props.sessionID || props.info?.sessionID || props.part?.sessionID;
      if (evSid && currentSid && evSid !== currentSid) return;

      switch (type) {
        case 'message.updated': {
          const info = props.info;
          if (!info) return;
          setRows((prev) => upsertRow(prev, info));
          if (info.role === 'assistant') setBusy(true);
          return;
        }
        case 'message.part.updated': {
          const part = props.part;
          if (!part) return;
          setRows((prev) => upsertPart(prev, part));
          return;
        }
        case 'message.part.delta': {
          const { messageID, partID, field, delta } = props;
          if (!messageID || !partID || !field || typeof delta !== 'string') return;
          if (field === 'text') setStreamingPartID(partID);
          setRows((prev) => applyDelta(prev, messageID, partID, field, delta));
          return;
        }
        case 'message.part.removed':
          setRows((prev) => removePart(prev, props.messageID, props.partID));
          return;
        case 'message.removed':
          setRows((prev) => prev.filter((r) => r.info.id !== props.messageID));
          return;
        case 'session.status': {
          const stype = typeof props.status === 'string' ? props.status : props.status?.type;
          setBusy(stype !== 'idle');
          return;
        }
        case 'session.idle':
          setBusy(false); setStreamingPartID('');
          return;
        case 'session.error':
          setError(props.error?.data?.message || props.error?.message || '会话出错');
          setBusy(false); setStreamingPartID('');
          return;
        default: return;
      }
    }
    return () => {
      cancelled = true;
      if (stream) stream.return?.(undefined);
    };
  }, []);

  const scrollRef = useAutoScroll(rows);
  const onSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    setError('');
    const text = input;
    setInput('');
    try {
      let sid = sessionID;
      if (!sid) {
        const r = await fetch(`${getBaseUrl()}/session`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!r.ok) throw new Error('POST /session ' + r.status);
        const s = await r.json();
        sid = s.id;
        setSessionID(sid);
        try { localStorage.setItem(ACTIVE_SESSION_KEY, sid); } catch {}
        window.dispatchEvent(new CustomEvent('app:session-changed', { detail: { id: sid } }));
      }
      await getClient().session.promptAsync({
        sessionID: sid,
        model: { providerID: 'opencode', modelID: model },
        parts: [{ type: 'text', text }],
      });
      setBusy(true);
    } catch (e) {
      setError(String(e?.message || e));
      setInput(text);
    } finally { setSending(false); }
  }, [sessionID, input, sending, model]);

  const onAbort = useCallback(async () => {
    if (!sessionID) return;
    try { await getClient().session.abort({ sessionID }); } catch (e) { setError(String(e?.message || e)); }
  }, [sessionID]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); onSend(); }
  }, [onSend]);

  const showExamples = !sessionID;
  const introText = sessionTitle
    ? `对话进行中 · 模型 ${model}`
    : '轻松应对复杂项目开发';

  return React.createElement('div', { className: 'an-cw' },
    // 助手头部
    React.createElement('div', { className: 'an-cw__assistant' },
      React.createElement('div', { className: 'an-cw__assistant-avatar' }, 'A'),
      React.createElement('div', { className: 'an-cw__assistant-info' },
        React.createElement('div', { className: 'an-cw__assistant-name' }, sessionTitle || 'Taichu Agent'),
        React.createElement('div', { className: 'an-cw__assistant-desc' }, introText)
      ),
      React.createElement('button', { className: 'an-cw__assistant-edit', title: '新对话', onClick: async () => {
        const r = await fetch(`${getBaseUrl()}/session`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        });
        if (r.ok) {
          const s = await r.json();
          window.dispatchEvent(new CustomEvent('app:session-changed', { detail: { id: s.id } }));
        }
      } }, '✎')
    ),
    // 介绍 (无 session 时)
    !sessionID
      ? React.createElement('div', { className: 'an-cw__intro-card' },
          '💡 轻松应对复杂项目开发 · 擅长项目迭代、问题修复与架构重构 · 智能任务规划, 确认后精准推进执行 · 自主编排智能体, AI 专家团队协同开发'
        )
      : null,
    // 消息流
    React.createElement('div', { className: 'an-cw__scroll', ref: scrollRef },
      sessionID && rows.length === 0 && !busy
        ? React.createElement('div', { className: 'an-cw__empty' }, '发送第一条消息开始对话')
        : rows.map((r) => {
            const role = r.info.role;
            const errMsg = r.info.error?.data?.message || r.info.error?.message;
            const visibleParts = (r.parts || [])
              .filter((p) => !p.synthetic)
              .map((p) => renderPart(p, p.id === streamingPartID))
              .filter(Boolean);
            if (visibleParts.length === 0 && role !== 'assistant' && !errMsg) return null;
            return React.createElement('div', { key: r.info.id, className: 'an-cw__msg is-' + role },
              React.createElement('span', { className: 'an-cw__msg-role' }, role === 'user' ? '你' : 'Assistant'),
              ...visibleParts,
              errMsg ? React.createElement('div', { className: 'an-cw__bubble an-cw__bubble--err' }, errMsg) : null,
              role === 'assistant' && visibleParts.length === 0
                ? React.createElement('div', { className: 'an-cw__part-reason' }, '正在生成…')
                : null
            );
          })
    ),
    // 示例提示 (无 session 时)
    showExamples
      ? React.createElement('div', { className: 'an-cw__examples' },
          React.createElement('div', { className: 'an-cw__examples-label' }, 'Try example prompts:'),
          React.createElement('div', { className: 'an-cw__examples-grid' },
            EXAMPLES.map((ex) =>
              React.createElement('div', {
                className: 'an-cw__example',
                onClick: () => setInput(ex),
                title: ex,
              }, ex)
            )
          )
        )
      : null,
    // "Work in a project" 链接 (无 session 时)
    showExamples
      ? React.createElement('div', { className: 'an-cw__work' },
          React.createElement('span', { onClick: () => {/* TODO: 打开项目 */} }, '📁 Work in a project')
        )
      : null,
    // 底部: 输入框 + 工具栏
    React.createElement('div', { className: 'an-cw__foot' },
      error ? React.createElement('div', { className: 'an-cw__err' }, error) : null,
      React.createElement('div', { className: 'an-cw__composer' },
        React.createElement('textarea', {
          className: 'an-cw__composer-textarea',
          placeholder: '输入消息, Enter 发送, Shift+Enter 换行',
          value: input,
          disabled: sending,
          onChange: (e) => setInput(e.target.value),
          onKeyDown,
          rows: 2,
        })
      ),
      React.createElement('div', { className: 'an-cw__composer-tools' },
        React.createElement('button', { className: 'an-cw__tool', title: '添加附件' }, '+'),
        React.createElement('span', { className: 'an-cw__tools-spacer' }),
        React.createElement('span', { className: 'an-cw__model', title: '切换模型' },
          '⚙ ' + model + ' ▾'
        ),
        busy
          ? React.createElement('button', { className: 'an-cw__send an-cw__send-abort', onClick: onAbort, title: '停止' }, '■')
          : React.createElement('button', { className: 'an-cw__send', disabled: !input.trim() || sending, onClick: onSend, title: '发送 (Enter)' }, '↑')
      )
    )
  );
};

// 辅助函数
function upsertRow(rows, info) {
  const idx = rows.findIndex((r) => r.info.id === info.id);
  if (idx >= 0) {
    const next = rows.slice();
    next[idx] = { ...next[idx], info: { ...next[idx].info, ...info } };
    return next;
  }
  return [...rows, { info, parts: [] }].sort((a, b) => (a.info.time?.created || 0) - (b.info.time?.created || 0));
}

function upsertPart(rows, part) {
  const idx = rows.findIndex((r) => r.info.id === part.messageID);
  if (idx < 0) return rows;
  const row = rows[idx];
  const pi = row.parts.findIndex((p) => p.id === part.id);
  const parts = row.parts.slice();
  if (pi >= 0) parts[pi] = { ...parts[pi], ...part };
  else parts.push(part);
  const next = rows.slice();
  next[idx] = { ...row, parts };
  return next;
}

function applyDelta(rows, messageID, partID, field, delta) {
  const idx = rows.findIndex((r) => r.info.id === messageID);
  if (idx < 0) return rows;
  const row = rows[idx];
  const pi = row.parts.findIndex((p) => p.id === partID);
  const parts = row.parts.slice();
  if (pi >= 0) {
    parts[pi] = { ...parts[pi], [field]: (parts[pi][field] || '') + delta };
  } else {
    parts.push({ id: partID, type: 'text', messageID, sessionID: row.info.sessionID, [field]: delta });
  }
  const next = rows.slice();
  next[idx] = { ...row, parts };
  return next;
}

function removePart(rows, messageID, partID) {
  const idx = rows.findIndex((r) => r.info.id === messageID);
  if (idx < 0) return rows;
  const next = rows.slice();
  next[idx] = { ...next[idx], parts: next[idx].parts.filter((p) => p.id !== partID) };
  return next;
}

function renderPart(part, streaming) {
  if (part.synthetic) return null;
  switch (part.type) {
    case 'text':
      if (!part.text) return null;
      return React.createElement('div', { key: part.id, className: 'an-cw__bubble' + (streaming ? ' an-cw__cursor' : '') }, part.text);
    case 'reasoning':
      return part.text
        ? React.createElement('div', { key: part.id, className: 'an-cw__part-reason' }, part.text)
        : null;
    case 'tool': {
      const name = part.tool || part.name || 'tool';
      const state = part.state?.status || 'running';
      return React.createElement('span', { key: part.id, className: 'an-cw__bubble' }, `[${name}] ${state}`);
    }
    default: return null;
  }
}

function useAutoScroll(dep) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

exports['chatWindow'] = ChatWindow;