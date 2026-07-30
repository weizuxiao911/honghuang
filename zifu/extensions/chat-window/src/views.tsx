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
.an-cw { display:flex; flex-direction:column; height:100%; font-size:14px; color:var(--sideBar-foreground,var(--foreground)); background:var(--sideBar-background); }
.an-cw__top { display:flex; align-items:center; gap:8px; padding:8px 12px; flex-shrink:0; color:var(--descriptionForeground); font-size:12px; }
.an-cw__top-label { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.an-cw__top-status { flex:0 0 auto; display:flex; align-items:center; gap:6px; color:var(--descriptionForeground); }
.an-cw__top-dot { width:6px; height:6px; border-radius:50%; background:var(--descriptionForeground); }
.an-cw__top-dot.is-live { background:var(--terminal-ansiGreen,#22c55e); }
.an-cw__top-dot.is-busy { background:var(--terminal-ansiYellow,#eab308); animation:an-cw-pulse 1s infinite; }
.an-cw__top-dot.is-error { background:var(--errorForeground,#f87171); }
@keyframes an-cw-pulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }
.an-cw__intro { padding:16px 20px 8px; flex-shrink:0; }
.an-cw__intro-title { font-size:18px; font-weight:600; margin-bottom:4px; }
.an-cw__intro-desc { font-size:12px; color:var(--descriptionForeground); line-height:1.6; }
.an-cw__scroll { flex:1; min-height:0; overflow-y:auto; padding:12px 20px; display:flex; flex-direction:column; gap:14px; }
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
.an-cw__err { margin:0 12px; padding:8px 10px; border-radius:6px; font-size:12px; color:var(--inputValidation-errorForeground,var(--errorForeground)); background:var(--inputValidation-errorBackground,transparent); border:1px solid var(--inputValidation-errorBorder,currentColor); }
.an-cw__foot { border-top:1px solid var(--sideBar-border,transparent); padding:10px 12px 14px 12px; display:flex; flex-direction:column; gap:6px; flex-shrink:0; background:var(--sideBar-background); }
.an-cw__composer { padding:8px 10px; border-radius:10px; background:var(--input-background); border:1px solid var(--input-border,transparent); }
.an-cw__composer:focus-within { border-color:var(--focusBorder); }
.an-cw__composer textarea { display:block; width:100%; min-height:48px; max-height:240px; resize:none; border:none; outline:none; background:transparent; color:var(--input-foreground,inherit); font:inherit; line-height:1.55; padding:2px 0; }
.an-cw__composer textarea::placeholder { color:var(--input-placeholderForeground); }
.an-cw__tools { display:flex; align-items:center; gap:10px; margin-top:6px; font-size:12px; color:var(--descriptionForeground); }
.an-cw__tool { display:flex; align-items:center; gap:4px; padding:2px 6px; border-radius:5px; cursor:pointer; user-select:none; }
.an-cw__tool:hover { background:var(--list-hoverBackground); color:var(--foreground); }
.an-cw__tools-spacer { flex:1; }
.an-cw__send { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; user-select:none; color:#fff; background:var(--button-background, #2563eb); border:none; font-weight:600; font-size:14px; }
.an-cw__send:hover:not(:disabled) { filter:brightness(1.1); }
.an-cw__send:disabled { opacity:.4; cursor:not-allowed; }
.an-cw__model { display:flex; align-items:center; gap:4px; padding:2px 6px; border-radius:5px; cursor:pointer; user-select:none; font-size:12px; }
.an-cw__model:hover { background:var(--list-hoverBackground); }
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
    if (!input.trim() || sending) return;
    setSending(true);
    setError('');
    const text = input;
    setInput('');
    try {
      let sid = sessionID;
      if (!sid) {
        // 自动创建 session (不设 title, opencode 自动生成)
        const r = await fetch(`${OPENCODE_BASE_URL}/session`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!r.ok) throw new Error('POST /session ' + r.status);
        const s = await r.json();
        sid = s.id;
        setSessionID(sid);
        try { localStorage.setItem(ACTIVE_SESSION_KEY, sid); } catch {}
        // 通知 session-manager 刷新
        window.dispatchEvent(new CustomEvent('zifu:session-changed', { detail: { id: sid } }));
      }
      await client.session.promptAsync({
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
    try { await client.session.abort({ sessionID }); } catch (e) { setError(String(e?.message || e)); }
  }, [sessionID]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); onSend(); }
  }, [onSend]);

  const statusText = !sessionID ? '未选择' : busy ? '生成中' : live ? '已连接' : '连接中';
  const statusClass = 'an-cw__hint-status' + (error ? ' is-error' : busy ? ' is-busy' : live && sessionID ? ' is-live' : '');

  return React.createElement('div', { className: 'an-cw' },
    // 顶部: session title (左) + 状态 (右)
    React.createElement('div', { className: 'an-cw__top' },
      React.createElement('span', { className: 'an-cw__top-label' },
        sessionTitle || (sessionID ? '对话中' : '欢迎使用')),
      React.createElement('span', { className: 'an-cw__top-status' },
        React.createElement('span', { className: 'an-cw__top-dot ' + (error ? 'is-error' : busy ? 'is-busy' : live && sessionID ? 'is-live' : '') }),
        statusText
      )
    ),
    error ? React.createElement('div', { className: 'an-cw__err' }, error) : null,
    // 介绍区 (无 session 时显示 Agent 介绍)
    !sessionID
      ? React.createElement('div', { className: 'an-cw__intro' },
          React.createElement('div', { className: 'an-cw__intro-title' }, 'Agent'),
          React.createElement('div', { className: 'an-cw__intro-desc' }, '轻松应对复杂项目开发\n• 擅长项目迭代、问题修复与架构重构\n• 智能任务规划, 确认后精准推进执行\n• 自主编排智能体, AI 专家团队协同开发')
        )
      : null,
    // 消息区
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
    // 底部: 输入框 + 工具栏 (Trae 风格)
    React.createElement('div', { className: 'an-cw__foot' },
      React.createElement('div', { className: 'an-cw__composer' },
        React.createElement('textarea', {
          placeholder: '输入消息, Enter 发送, Shift+Enter 换行',
          value: input,
          disabled: sending,
          onChange: (e) => setInput(e.target.value),
          onKeyDown,
          rows: 2,
        })
      ),
      React.createElement('div', { className: 'an-cw__tools' },
        React.createElement('span', { className: 'an-cw__tool', title: '提到文件' }, '@'),
        React.createElement('span', { className: 'an-cw__tool', title: '使用 # 引用' }, '#'),
        React.createElement('span', { className: 'an-cw__tool', title: '上传图片' }, '🖼'),
        React.createElement('span', { className: 'an-cw__tools-spacer' }),
        React.createElement('span', { className: 'an-cw__model', title: '切换模型', onClick: () => {/* TODO: 模型选择器 */} },
          'Auto · ' + model
        ),
        busy ? React.createElement('span', { className: 'an-cw__tool', onClick: onAbort, style: { color: 'var(--errorForeground)' } }, '停止') : null,
        React.createElement('button', { className: 'an-cw__send', disabled: !input.trim() || sending, onClick: onSend, title: '发送 (Enter)' },
          '↑'
        )
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