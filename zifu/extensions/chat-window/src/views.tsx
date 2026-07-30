const React = require('React');
const { useState, useEffect, useRef, useCallback } = React;

import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';

const OPENCODE_BASE_URL = 'http://df-dev.localhost';
const ACTIVE_SESSION_KEY = 'zifu.activeSessionId';

const client = createOpencodeClient({
  baseUrl: OPENCODE_BASE_URL,
  responseStyle: 'fields',
  throwOnError: true,
});

const CSS = `
.an-cw { display:flex; flex-direction:column; height:100%; font-size:var(--font-size,13px); color:var(--sideBar-foreground,var(--foreground)); background:var(--sideBar-background); }
.an-cw__header { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid var(--sideBar-border, transparent); background:var(--sideBar-background); flex-shrink:0; }
.an-cw__title { font-size:13px; font-weight:600; color:var(--sideBar-foreground,var(--foreground)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }
.an-cw__title-icon { font-size:13px; opacity:.7; flex:0 0 auto; }
.an-cw__header-btn { flex:0 0 auto; display:flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:5px; cursor:pointer; user-select:none; color:var(--descriptionForeground); background:transparent; border:none; }
.an-cw__header-btn:hover { background:var(--list-hoverBackground); color:var(--foreground); }
.an-cw__header-btn:disabled { opacity:.4; cursor:not-allowed; }
.an-cw__header-btn svg { width:14px; height:14px; }
.an-cw__model { flex:0 0 auto; display:flex; align-items:center; gap:4px; padding:3px 8px; border-radius:5px; font-size:11px; color:var(--descriptionForeground); background:var(--input-background); border:1px solid var(--input-border, transparent); cursor:pointer; user-select:none; }
.an-cw__model:hover { background:var(--list-hoverBackground); color:var(--foreground); }
.an-cw__scroll { flex:1; min-height:0; overflow-y:auto; padding:20px 16px; display:flex; flex-direction:column; gap:18px; }
.an-cw__empty { margin:auto; padding:40px 20px; text-align:center; color:var(--descriptionForeground); line-height:1.7; user-select:none; font-size:14px; }
.an-cw__msg { display:flex; flex-direction:column; gap:4px; }
.an-cw__msg-role { font-size:11px; font-weight:600; letter-spacing:.04em; color:var(--descriptionForeground); user-select:none; }
.an-cw__msg.is-user { align-items:flex-end; }
.an-cw__msg.is-user .an-cw__msg-role { color:var(--textLink-foreground,var(--focusBorder)); }
.an-cw__bubble { padding:10px 14px; border-radius:12px; max-width:100%; white-space:pre-wrap; word-break:break-word; line-height:1.6; font-size:13px; }
.an-cw__msg.is-user .an-cw__bubble { background:var(--list-activeSelectionBackground); color:var(--list-activeSelectionForeground,inherit); border-top-right-radius:4px; }
.an-cw__msg.is-assistant .an-cw__bubble { background:var(--editorWidget-background,var(--input-background)); border:1px solid var(--editorWidget-border,var(--input-border,transparent)); border-top-left-radius:4px; }
.an-cw__bubble--err { color:var(--inputValidation-errorForeground,var(--errorForeground)); }
.an-cw__part-tool { display:inline-flex; align-items:center; gap:6px; padding:3px 8px; border-radius:5px; font-size:11px; margin:2px 4px 2px 0; background:var(--badge-background); color:var(--badge-foreground); }
.an-cw__part-reason { font-size:12px; opacity:.7; font-style:italic; }
.an-cw__cursor::after { content:'\\258C'; display:inline-block; animation:an-cw-blink 1s steps(2) infinite; margin-left:2px; opacity:.6; }
@keyframes an-cw-blink { 50% { opacity:0; } }
.an-cw__err { margin:0 12px 0 12px; padding:8px 10px; border-radius:6px; font-size:12px; color:var(--inputValidation-errorForeground,var(--errorForeground)); background:var(--inputValidation-errorBackground,transparent); border:1px solid var(--inputValidation-errorBorder,currentColor); }
.an-cw__foot { border-top:1px solid var(--sideBar-border,transparent); padding:12px 16px; display:flex; flex-direction:column; gap:8px; flex-shrink:0; background:var(--sideBar-background); }
.an-cw__composer { display:flex; align-items:flex-end; gap:8px; padding:8px 10px; border-radius:10px; background:var(--input-background); border:1px solid var(--input-border,transparent); }
.an-cw__composer:focus-within { border-color:var(--focusBorder); }
.an-cw__composer textarea { flex:1; min-height:24px; max-height:200px; resize:none; border:none; outline:none; background:transparent; color:var(--input-foreground,inherit); font:inherit; line-height:1.5; padding:2px 0; }
.an-cw__composer textarea::placeholder { color:var(--input-placeholderForeground); }
.an-cw__send { flex:0 0 auto; padding:6px 14px; border-radius:7px; cursor:pointer; user-select:none; color:var(--button-foreground); background:var(--button-background); border:1px solid var(--button-border,transparent); font-weight:500; }
.an-cw__send:hover:not(:disabled) { background:var(--button-hoverBackground); }
.an-cw__send:disabled { opacity:.5; cursor:not-allowed; }
.an-cw__hint { font-size:11px; color:var(--descriptionForeground); display:flex; align-items:center; gap:8px; }
.an-cw__hint-status { display:inline-flex; align-items:center; gap:5px; }
.an-cw__hint-status::before { content:''; width:6px; height:6px; border-radius:50%; background:var(--descriptionForeground); }
.an-cw__hint-status.is-live::before { background:var(--terminal-ansiGreen,#22c55e); }
.an-cw__hint-status.is-busy::before { background:var(--terminal-ansiYellow,#eab308); }
.an-cw__hint-status.is-error::before { background:var(--errorForeground,#f87171); }
.an-cw__hint-spacer { flex:1; }
.an-cw__abort { cursor:pointer; color:var(--textLink-foreground,var(--focusBorder)); }
`;

function useInjectStyle() {
  useEffect(() => {
    if (document.getElementById('zifu-chat-window-style')) return;
    const el = document.createElement('style');
    el.id = 'zifu-chat-window-style';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const UploadIcon = () =>
  React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
    React.createElement('path', { d: 'M8 2v9M4.5 5.5L8 2l3.5 3.5M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2', strokeLinecap: 'round', strokeLinejoin: 'round' })
  );

const QuestionIcon = () =>
  React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
    React.createElement('circle', { cx: 8, cy: 8, r: 6 }),
    React.createElement('path', { d: 'M6 6.5a2 2 0 014 0c0 1.2-1.2 1.6-2 2.3V9.5M8 11.5h.01', strokeLinecap: 'round' })
  );

const ModelIcon = () =>
  React.createElement('svg', { viewBox: '0 0 16 16', fill: 'currentColor' },
    React.createElement('path', { d: 'M3 4l5 4 5-4M3 8l5 4 5-4M3 12l5 4 5-4' })
  );

const NewChatIcon = () =>
  React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
    React.createElement('path', { d: 'M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v6A1.5 1.5 0 0112.5 11H6l-3 3v-3H3.5A1.5 1.5 0 012 9.5v-6z', strokeLinecap: 'round', strokeLinejoin: 'round' })
  );

const TitleIcon = () =>
  React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
    React.createElement('path', { d: 'M2 4.5A1.5 1.5 0 013.5 3h9A1.5 1.5 0 0114 4.5v5A1.5 1.5 0 0112.5 11H6.5l-2.5 2.5V11H3.5A1.5 1.5 0 012 9.5v-5z', strokeLinejoin: 'round' })
  );

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

  // 加载 session 标题 (从 opencode /session/{id})
  useEffect(() => {
    let cancelled = false;
    if (!sessionID) { setSessionTitle(''); return; }
    (async () => {
      try {
        const r = await fetch(`${OPENCODE_BASE_URL}/session/${sessionID}`, { headers: { Accept: 'application/json' } });
        if (cancelled) return;
        if (r.ok) {
          const d = await r.json();
          setSessionTitle(d.title || d.slug || '');
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [sessionID]);

  // 监听 SSE session.updated 自动刷新 title
  useEffect(() => {
    const handler = (e: any) => {
      const sid = e?.detail?.sessionID;
      if (sid && sid === sessionIDRef.current && e.detail?.title) {
        setSessionTitle(e.detail.title);
      }
    };
    window.addEventListener('zifu:session-title-update', handler as any);
    return () => window.removeEventListener('zifu:session-title-update', handler as any);
  }, []);

  useEffect(() => {
    const onChange = (e) => setSessionID(e?.detail?.id || '');
    const onStorage = (e) => {
      if (e.key === ACTIVE_SESSION_KEY) setSessionID(e.newValue || '');
    };
    window.addEventListener('zifu:session-changed', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('zifu:session-changed', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) { setRows([]); return; }
    try {
      const { data } = await client.session.messages({ sessionID: id, limit: 200 });
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
          const result = await client.global.event();
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
    if (!sessionID || !input.trim() || sending) return;
    setSending(true);
    setError('');
    const text = input;
    setInput('');
    try {
      await client.session.promptAsync({
        sessionID,
        model: { providerID: 'opencode', modelID: 'ling-3.0-flash-free' },
        parts: [{ type: 'text', text }],
      });
      setBusy(true);
    } catch (e) {
      setError(String(e?.message || e));
      setInput(text);
    } finally { setSending(false); }
  }, [sessionID, input, sending]);

  const onAbort = useCallback(async () => {
    if (!sessionID) return;
    try { await client.session.abort({ sessionID }); } catch (e) { setError(String(e?.message || e)); }
  }, [sessionID]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); onSend(); }
  }, [onSend]);

  const statusText = !sessionID ? '未选择' : busy ? '生成中' : live ? '已连接' : '连接中';
  const statusClass = 'an-cw__hint-status' + (error ? ' is-error' : busy ? ' is-busy' : live && sessionID ? ' is-live' : '');

  return React.createElement('div', { className: 'an-cw' },
    // 头部: session title + 模型 + 工具栏
    React.createElement('div', { className: 'an-cw__header' },
      React.createElement('span', { className: 'an-cw__title-icon' }, React.createElement(TitleIcon, null)),
      React.createElement('span', { className: 'an-cw__title' }, sessionTitle || (sessionID ? '对话中...' : '选择会话')),
      React.createElement('span', { className: 'an-cw__model', title: '切换模型', onClick: () => {/* TODO: 模型选择器 */} },
        React.createElement(ModelIcon, null),
        React.createElement('span', null, model)
      ),
      React.createElement('button', { className: 'an-cw__header-btn', title: '上传文件', disabled: !sessionID },
        React.createElement(UploadIcon, null)
      ),
      React.createElement('button', { className: 'an-cw__header-btn', title: '提问工具', disabled: !sessionID },
        React.createElement(QuestionIcon, null)
      ),
      React.createElement('button', { className: 'an-cw__header-btn', title: '新对话', onClick: () => {
        // 通知 session-manager 创建
        window.dispatchEvent(new CustomEvent('zifu:create-session-request'));
      } },
        React.createElement(NewChatIcon, null)
      )
    ),
    error ? React.createElement('div', { className: 'an-cw__err' }, error) : null,
    React.createElement('div', { className: 'an-cw__scroll', ref: scrollRef },
      !sessionID
        ? React.createElement('div', { className: 'an-cw__empty' }, '请在左侧「洪荒会话」选择或新建对话')
        : rows.length === 0
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
    React.createElement('div', { className: 'an-cw__foot' },
      React.createElement('div', { className: 'an-cw__composer' },
        React.createElement('textarea', {
          placeholder: sessionID ? '输入消息，Enter 发送，Shift+Enter 换行' : '先在左侧选择或新建对话',
          value: input,
          disabled: !sessionID || sending,
          onChange: (e) => setInput(e.target.value),
          onKeyDown,
          rows: 1,
        }),
        React.createElement('button', { className: 'an-cw__send', disabled: !sessionID || !input.trim() || sending, onClick: onSend },
          sending ? '发送中…' : '发送'
        )
      ),
      React.createElement('div', { className: 'an-cw__hint' },
        React.createElement('span', { className: statusClass }, statusText),
        React.createElement('span', { className: 'an-cw__hint-spacer' }),
        busy ? React.createElement('span', { className: 'an-cw__abort', onClick: onAbort }, '中止') : null
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
        ? React.createElement('div', { key: part.id, className: 'an-cw__part-reason' }, '思考：' + part.text)
        : null;
    case 'tool': {
      const name = part.tool || part.name || 'tool';
      const state = part.state?.status || 'running';
      return React.createElement('span', { key: part.id, className: 'an-cw__part-tool' }, name + ' · ' + state);
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

exports['zifu.chatWindow'] = ChatWindow;