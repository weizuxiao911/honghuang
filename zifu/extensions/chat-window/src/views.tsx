const React = require('React');
const { useState, useEffect, useRef, useCallback, useMemo } = React;

import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { Event } from '@opencode-ai/sdk/v2/types';

const OPENCODE_BASE_URL = 'http://df-dev.localhost';
const ACTIVE_SESSION_KEY = 'zifu.activeSessionId';

const client = createOpencodeClient({
  baseUrl: OPENCODE_BASE_URL,
  responseStyle: 'fields',
  throwOnError: true,
});

interface Part {
  id: string;
  type: string;
  text?: string;
  messageID: string;
  sessionID: string;
  synthetic?: boolean;
  [k: string]: any;
}

interface Message {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  time: { created: number };
  error?: { name?: string; data?: { message?: string }; message?: string };
  [k: string]: any;
}

interface Row {
  info: Message;
  parts: Part[];
}

const STYLE_ID = 'zifu-chat-window-style';
const CSS = `
.an-cw { display:flex; flex-direction:column; height:100%; font-size:var(--font-size,13px); color:var(--sideBar-foreground,var(--foreground)); background:var(--sideBar-background); }
.an-cw__scroll { flex:1; min-height:0; overflow-y:auto; padding:14px 12px; display:flex; flex-direction:column; gap:14px; }
.an-cw__empty { margin:auto; padding:24px 16px; text-align:center; color:var(--descriptionForeground); line-height:1.7; user-select:none; }
.an-cw__msg { display:flex; flex-direction:column; gap:4px; }
.an-cw__msg-role { font-size:11px; font-weight:600; letter-spacing:.04em; color:var(--descriptionForeground); user-select:none; }
.an-cw__msg.is-user { align-items:flex-end; }
.an-cw__msg.is-user .an-cw__msg-role { color:var(--textLink-foreground,var(--focusBorder)); }
.an-cw__bubble { padding:8px 12px; border-radius:10px; max-width:100%; white-space:pre-wrap; word-break:break-word; line-height:1.55; }
.an-cw__msg.is-user .an-cw__bubble { background:var(--list-activeSelectionBackground); color:var(--list-activeSelectionForeground,inherit); border-top-right-radius:4px; }
.an-cw__msg.is-assistant .an-cw__bubble { background:var(--editorWidget-background,var(--input-background)); border:1px solid var(--editorWidget-border,var(--input-border,transparent)); border-top-left-radius:4px; }
.an-cw__bubble--err { color:var(--inputValidation-errorForeground,var(--errorForeground)); }
.an-cw__part-tool { display:inline-flex; align-items:center; gap:6px; padding:3px 8px; border-radius:5px; font-size:11px; margin:2px 4px 2px 0; background:var(--badge-background); color:var(--badge-foreground); }
.an-cw__part-reason { font-size:12px; opacity:.7; font-style:italic; }
.an-cw__cursor::after { content:'\\258C'; display:inline-block; animation:an-cw-blink 1s steps(2) infinite; margin-left:2px; opacity:.6; }
@keyframes an-cw-blink { 50% { opacity:0; } }
.an-cw__err { margin:10px 12px 0; padding:8px 10px; border-radius:6px; font-size:12px; color:var(--inputValidation-errorForeground,var(--errorForeground)); background:var(--inputValidation-errorBackground,transparent); border:1px solid var(--inputValidation-errorBorder,currentColor); }
.an-cw__foot { border-top:1px solid var(--sideBar-border,transparent); padding:10px 12px; display:flex; flex-direction:column; gap:6px; }
.an-cw__composer { display:flex; align-items:flex-end; gap:8px; padding:6px 8px; border-radius:8px; background:var(--input-background); border:1px solid var(--input-border,transparent); }
.an-cw__composer:focus-within { border-color:var(--focusBorder); }
.an-cw__composer textarea { flex:1; min-height:20px; max-height:180px; resize:none; border:none; outline:none; background:transparent; color:var(--input-foreground,inherit); font:inherit; line-height:1.5; padding:2px 0; }
.an-cw__composer textarea::placeholder { color:var(--input-placeholderForeground); }
.an-cw__send { flex:0 0 auto; padding:5px 12px; border-radius:6px; cursor:pointer; user-select:none; color:var(--button-foreground); background:var(--button-background); border:1px solid var(--button-border,transparent); font-weight:500; }
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
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

function upsertRow(rows: Row[], info: Message): Row[] {
  const idx = rows.findIndex((r) => r.info.id === info.id);
  if (idx >= 0) {
    const next = rows.slice();
    next[idx] = { ...next[idx], info: { ...next[idx].info, ...info } };
    return next;
  }
  return [...rows, { info, parts: [] }].sort(
    (a, b) => (a.info.time?.created || 0) - (b.info.time?.created || 0)
  );
}

function upsertPart(rows: Row[], part: Part): Row[] {
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

function applyDelta(rows: Row[], messageID: string, partID: string, field: string, delta: string): Row[] {
  const idx = rows.findIndex((r) => r.info.id === messageID);
  if (idx < 0) return rows;
  const row = rows[idx];
  const pi = row.parts.findIndex((p) => p.id === partID);
  const parts = row.parts.slice();
  if (pi >= 0) {
    const cur = parts[pi] as any;
    parts[pi] = { ...cur, [field]: (cur[field] || '') + delta };
  } else {
    parts.push({
      id: partID,
      type: 'text',
      messageID,
      sessionID: row.info.sessionID,
      [field]: delta,
    } as Part);
  }
  const next = rows.slice();
  next[idx] = { ...row, parts };
  return next;
}

function removePart(rows: Row[], messageID: string, partID: string): Row[] {
  const idx = rows.findIndex((r) => r.info.id === messageID);
  if (idx < 0) return rows;
  const next = rows.slice();
  next[idx] = { ...next[idx], parts: next[idx].parts.filter((p) => p.id !== partID) };
  return next;
}

function renderPart(part: Part, streaming: boolean) {
  if (part.synthetic) return null;
  switch (part.type) {
    case 'text': {
      if (!part.text) return null;
      const cls = 'an-cw__bubble' + (streaming ? ' an-cw__cursor' : '');
      return React.createElement('div', { key: part.id, className: cls }, part.text);
    }
    case 'reasoning':
      return part.text
        ? React.createElement('div', { key: part.id, className: 'an-cw__part-reason' }, '思考：' + part.text)
        : null;
    case 'tool': {
      const name = (part as any).tool || (part as any).name || 'tool';
      const state = (part as any).state?.status || 'running';
      return React.createElement('span', { key: part.id, className: 'an-cw__part-tool' }, `${name} · ${state}`);
    }
    default:
      return null;
  }
}

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

const ChatWindow = () => {
  useInjectStyle();
  const [sessionID, setSessionID] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_SESSION_KEY) || '';
    } catch {
      return '';
    }
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streamingPartID, setStreamingPartID] = useState<string>('');

  const sessionIDRef = useRef(sessionID);
  useEffect(() => {
    sessionIDRef.current = sessionID;
  }, [sessionID]);

  useEffect(() => {
    const onChange = (e: any) => setSessionID(e?.detail?.id || '');
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_SESSION_KEY) setSessionID(e.newValue || '');
    };
    window.addEventListener('zifu:session-changed', onChange as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('zifu:session-changed', onChange as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    if (!id) {
      setRows([]);
      return;
    }
    try {
      const { data } = await (client as any).session.messages({ sessionID: id, limit: 200 });
      const list = (data as Row[]).slice().sort(
        (a, b) => (a.info.time?.created || 0) - (b.info.time?.created || 0)
      );
      setRows(list);
      setError('');
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    setStreamingPartID('');
    loadMessages(sessionID);
  }, [sessionID, loadMessages]);

  // SSE 长连：全局单订阅 /global/event（含 message.part.delta，事件多一层 payload）
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let stream: AsyncGenerator<any> | null = null;

    (async () => {
      while (!cancelled) {
        try {
          const result = await (client as any).global.event();
          setLive(true);
          attempt = 0;
          stream = result.stream as AsyncGenerator<any>;
          for await (const ev of stream) {
            if (cancelled) break;
            // /global/event 事件结构：{directory, project, workspace, payload:{id,type,properties}}
            const payload = (ev as any)?.payload ?? ev;
            handleEvent(payload);
          }
        } catch {
          // fallthrough to reconnect
        }
        setLive(false);
        stream = null;
        if (cancelled) break;
        attempt++;
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 15000)));
      }
    })();

    function handleEvent(ev: any) {
      const type = ev.type as string;
      const props = ev.properties || {};
      const currentSid = sessionIDRef.current;
      const evSid: string | undefined = props.sessionID || props.info?.sessionID || props.part?.sessionID;
      // 会话隔离过滤（session 级事件除外，用于 busy 状态）
      if (evSid && currentSid && evSid !== currentSid) {
        // 但 session.idle / session.status 若匹配当前会话仍要处理
        return;
      }

      switch (type) {
        case 'message.updated': {
          const info = props.info as Message;
          if (!info) return;
          setRows((prev) => upsertRow(prev, info));
          if (info.role === 'assistant') setBusy(true);
          return;
        }
        case 'message.part.updated': {
          const part = props.part as Part;
          if (!part) return;
          setRows((prev) => upsertPart(prev, part));
          return;
        }
        case 'message.part.delta': {
          const { messageID, partID, field, delta } = props as {
            messageID: string;
            partID: string;
            field: string;
            delta: string;
          };
          if (!messageID || !partID || !field || typeof delta !== 'string') return;
          if (field === 'text') setStreamingPartID(partID);
          setRows((prev) => applyDelta(prev, messageID, partID, field, delta));
          return;
        }
        case 'message.part.removed': {
          setRows((prev) => removePart(prev, props.messageID, props.partID));
          return;
        }
        case 'message.removed': {
          setRows((prev) => prev.filter((r) => r.info.id !== props.messageID));
          return;
        }
        case 'session.status': {
          const status = props.status;
          const stype = typeof status === 'string' ? status : status?.type;
          setBusy(stype !== 'idle');
          return;
        }
        case 'session.idle': {
          setBusy(false);
          setStreamingPartID('');
          return;
        }
        case 'session.error': {
          const err = props.error;
          const msg = err?.data?.message || err?.message || '会话出错';
          setError(msg);
          setBusy(false);
          setStreamingPartID('');
          return;
        }
        default:
          return;
      }
    }

    return () => {
      cancelled = true;
      void stream?.return?.(undefined as any);
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
      await (client as any).session.promptAsync({
        sessionID,
        model: { providerID: 'opencode', modelID: 'ling-3.0-flash-free' },
        parts: [{ type: 'text', text }],
      });
      setBusy(true);
    } catch (e: any) {
      setError(String(e?.message || e));
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [sessionID, input, sending]);

  const onAbort = useCallback(async () => {
    if (!sessionID) return;
    try {
      await (client as any).session.abort({ sessionID });
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, [sessionID]);

  const onKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  const statusText = !sessionID ? '未选择' : busy ? '生成中' : live ? '已连接' : '连接中';
  const statusClass =
    'an-cw__hint-status' +
    (error ? ' is-error' : busy ? ' is-busy' : live && sessionID ? ' is-live' : '');

  return React.createElement(
    'div',
    { className: 'an-cw' },
    error ? React.createElement('div', { className: 'an-cw__err' }, error) : null,
    React.createElement(
      'div',
      { className: 'an-cw__scroll', ref: scrollRef },
      !sessionID
        ? React.createElement('div', { className: 'an-cw__empty' }, '请在左侧「洪荒 会话」选择或新建对话')
        : rows.length === 0
        ? React.createElement('div', { className: 'an-cw__empty' }, '发送第一条消息开始对话')
        : rows.map((r) => {
            const role = r.info.role;
            const errMsg = r.info.error?.data?.message || r.info.error?.message;
            const visibleParts = r.parts
              .filter((p) => !p.synthetic)
              .map((p) => renderPart(p, p.id === streamingPartID))
              .filter(Boolean);
            if (visibleParts.length === 0 && role !== 'assistant' && !errMsg) return null;
            return React.createElement(
              'div',
              { key: r.info.id, className: 'an-cw__msg is-' + role },
              React.createElement('span', { className: 'an-cw__msg-role' }, role === 'user' ? '你' : 'Assistant'),
              ...visibleParts,
              errMsg
                ? React.createElement('div', { className: 'an-cw__bubble an-cw__bubble--err' }, errMsg)
                : role === 'assistant' && visibleParts.length === 0
                ? React.createElement('div', { className: 'an-cw__part-reason' }, '正在生成…')
                : null
            );
          })
    ),
    React.createElement(
      'div',
      { className: 'an-cw__foot' },
      React.createElement(
        'div',
        { className: 'an-cw__composer' },
        React.createElement('textarea', {
          placeholder: sessionID ? '输入消息，Enter 发送，Shift+Enter 换行' : '选择会话后开始',
          value: input,
          disabled: !sessionID || sending,
          onChange: (e: any) => setInput(e.target.value),
          onKeyDown,
          rows: 1,
        }),
        React.createElement(
          'button',
          {
            className: 'an-cw__send',
            disabled: !sessionID || !input.trim() || sending,
            onClick: onSend,
          },
          sending ? '发送中…' : '发送'
        )
      ),
      React.createElement(
        'div',
        { className: 'an-cw__hint' },
        React.createElement('span', { className: statusClass }, statusText),
        React.createElement('span', { className: 'an-cw__hint-spacer' }),
        busy ? React.createElement('span', { className: 'an-cw__abort', onClick: onAbort }, '中止') : null
      )
    )
  );
};

exports['zifu.chatWindow'] = ChatWindow;
