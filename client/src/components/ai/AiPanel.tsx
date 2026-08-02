import React, { useState, useEffect, useRef, useCallback } from 'react';

import { getAiClient, aiCreateSession, aiListSessions, aiListMessages, aiSendMessage, aiAbort, aiListAgents, aiSwitchAgent, aiReplyQuestion } from '../../commands/ai/api';

/**
 * AI 助手面板 — right 槽位默认 webview (components/ai/)
 *
 * 功能 (参考 AionUi / OpenCode web UI):
 *   1. 新会话: session.create, 空会话不重复创建
 *   2. 历史会话: session.list 展示, 点击进入
 *   3. 聊天消息: 用户右 / AI 左, SSE 打字机效果
 *   4. 消息发送: async_prompt (promptAsync) + global.event SSE 监听
 *   5. A2UI: question.asked → 选项弹窗 → question.reply
 *   6. subagent: agent.list 展示, 会话内切换
 *
 * SDK 实例从 window.__TAICHU_OPENCODE__ 读取 (commands/opencode 事件驱动), 不 import 同步.
 */

interface Row {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  parts?: any[];
  error?: string;
}

interface Question {
  id: string;
  sessionID: string;
  questions: any[];
}

export const AiPanel: React.FC = () => {
  const [sessionID, setSessionID] = useState<string>('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>('build');
  const [question, setQuestion] = useState<Question | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [error, setError] = useState('');
  const [streamingPartID, setStreamingPartID] = useState('');
  const sessionIDRef = useRef(sessionID);
  sessionIDRef.current = sessionID;
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初始化: 加载 subagent 列表
  useEffect(() => {
    const load = async () => {
      try {
        const list = await aiListAgents();
        setAgents(list || []);
      } catch (e) {
        console.warn('[ai] load agents failed', e);
      }
    };
    load();
  }, []);

  // 监听 taichu:ai-reveal 事件 (TopBar 右栏 toggle 展开时) → 自动 focus 输入框
  useEffect(() => {
    const onReveal = () => {
      setTimeout(() => {
        const ta = document.querySelector('.tc-ai__input textarea');
        (ta as HTMLTextAreaElement | null)?.focus();
      }, 100);
    };
    window.addEventListener('taichu:ai-reveal', onReveal);
    return () => window.removeEventListener('taichu:ai-reveal', onReveal);
  }, []);

  // 会话切换: 加载消息
  useEffect(() => {
    if (!sessionID) {
      setRows([]);
      return;
    }
    const load = async () => {
      try {
        const msgs = await aiListMessages(sessionID);
        // messages 返回结构可能是直接 { info, parts } 或 { info: { parts } }, 兼容处理
        const rs: Row[] = (msgs || []).map((m: any) => {
          const info = m.info || m;
          const parts = m.parts || info?.parts;
          return {
            id: info?.id || m.id,
            role: info?.role || m.role,
            text: extractText(parts),
            parts,
          };
        });
        setRows(rs);
      } catch (e) {
        setError(String((e as any)?.message || e));
      }
    };
    load();
  }, [sessionID]);

  // 加载历史会话
  const loadSessions = useCallback(async () => {
    try {
      const list = await aiListSessions();
      setSessions(list || []);
    } catch (e) {
      setError(String((e as any)?.message || e));
    }
  }, []);

  // SSE 监听 (打字机效果 + A2UI question)
  useEffect(() => {
    let cancelled = false;
    let stream: any = null;

    (async () => {
      while (!cancelled) {
        try {
          const result = await getAiClient()!.global.event();
          stream = result.stream;
          for await (const ev of stream) {
            if (cancelled) break;
            handleEvent(ev?.payload ?? ev);
          }
        } catch {
          /* reconnect */
        }
        if (cancelled) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();

    function handleEvent(ev: any) {
      const type = ev.type;
      const props = ev.properties || {};
      const cur = sessionIDRef.current;
      const evSid = props.sessionID || props.info?.sessionID || props.part?.sessionID;
      if (evSid && cur && evSid !== cur) return;

      switch (type) {
        case 'message.part.delta': {
          const { messageID, partID, field, delta } = props;
          if (field === 'text') setStreamingPartID(partID);
          setRows((prev) => applyDelta(prev, messageID, partID, field, delta));
          break;
        }
        case 'message.part.updated': {
          const part = props.part;
          if (part) setRows((prev) => upsertPart(prev, part));
          break;
        }
        case 'message.updated': {
          const info = props.info;
          if (info?.role === 'assistant') setBusy(true);
          break;
        }
        case 'session.status': {
          const stype = typeof props.status === 'string' ? props.status : props.status?.type;
          setBusy(stype !== 'idle');
          break;
        }
        case 'session.idle':
          setBusy(false);
          setStreamingPartID('');
          break;
        case 'session.error':
          setBusy(false);
          setStreamingPartID('');
          setError(props.error?.data?.message || props.error?.message || '会话出错');
          break;
        case 'question.asked':
        case 'question.v2.asked': {
          setQuestion({
            id: props.requestID || props.id,
            sessionID: props.sessionID,
            questions: props.questions || [],
          });
          break;
        }
        case 'question.replied':
        case 'question.v2.replied':
          setQuestion(null);
          break;
        default:
          break;
      }
    }

    return () => {
      cancelled = true;
      stream?.return?.(undefined);
    };
  }, []);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rows, streamingPartID]);

  const onNewSession = useCallback(async () => {
    try {
      const sid = await aiCreateSession();
      setSessionID(sid);
      setRows([]);
      setShowSessions(false);
    } catch (e) {
      setError(String((e as any)?.message || e));
    }
  }, []);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    // 本地先显示用户消息
    const localId = `local-${Date.now()}`;
    setRows((prev) => [...prev, { id: localId, role: 'user', text }]);
    try {
      let sid = sessionID;
      if (!sid) {
        sid = await aiCreateSession();
        setSessionID(sid);
      }
      await aiSendMessage(sid, text, currentAgent);
      setBusy(true);
    } catch (e) {
      // 失败回滚: 删除本地占位消息 + 恢复输入
      setRows((prev) => prev.filter((r) => r.id !== localId));
      setInput(text);
      setError(String((e as any)?.message || e));
    }
  }, [input, busy, sessionID, currentAgent]);

  const onAbort = useCallback(async () => {
    if (!sessionID) return;
    try {
      await aiAbort(sessionID);
    } catch (e) {
      setError(String((e as any)?.message || e));
    }
  }, [sessionID]);

  const onReplyQuestion = useCallback(
    async (answers: string[]) => {
      if (!question) return;
      try {
        await aiReplyQuestion(question.sessionID, question.id, answers);
        setQuestion(null);
      } catch (e) {
        setError(String((e as any)?.message || e));
      }
    },
    [question]
  );

  const onSwitchAgent = useCallback(
    async (agent: string) => {
      setCurrentAgent(agent);
      if (sessionID) {
        try {
          await aiSwitchAgent(sessionID, agent);
        } catch (e) {
          setError(String((e as any)?.message || e));
        }
      }
    },
    [sessionID]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  return (
    <div className="tc-ai">
      <style>{`
        .tc-ai { display:flex; flex-direction:column; height:100%; background:var(--panel-background,#0e0e12); color:var(--foreground,#e5e7eb); font-size:13px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; user-select:none; }
        .tc-ai__header { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
        .tc-ai__header-title { flex:1; font-weight:600; font-size:14px; }
        .tc-ai__btn { padding:5px 10px; font-size:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:var(--foreground); cursor:pointer; transition:background .15s; }
        .tc-ai__btn:hover { background:rgba(255,255,255,0.1); }
        .tc-ai__btn--primary { background:linear-gradient(135deg,#6366f1,#8b5cf6); border-color:transparent; color:#fff; }
        .tc-ai__agent-select { display:flex; align-items:center; gap:6px; padding:6px 14px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; font-size:12px; }
        .tc-ai__agent-select select { background:#1c1c22; color:var(--foreground); border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:3px 8px; font-size:12px; }
        .tc-ai__scroll { flex:1; min-height:0; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
        .tc-ai__empty { margin:auto; text-align:center; color:var(--descriptionForeground,#8b929b); font-size:13px; line-height:1.7; }
        .tc-ai__msg { display:flex; flex-direction:column; gap:3px; }
        .tc-ai__msg.is-user { align-items:flex-end; }
        .tc-ai__msg-role { font-size:11px; color:var(--descriptionForeground,#8b929b); padding:0 6px; }
        .tc-ai__bubble { padding:8px 12px; border-radius:12px; max-width:85%; white-space:pre-wrap; word-break:break-word; line-height:1.55; }
        .tc-ai__msg.is-user .tc-ai__bubble { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border-top-right-radius:4px; }
        .tc-ai__msg.is-assistant .tc-ai__bubble { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-top-left-radius:4px; }
        .tc-ai__cursor::after { content:'▍'; display:inline-block; animation:tc-ai-blink 1s steps(2) infinite; margin-left:2px; }
        @keyframes tc-ai-blink { 50% { opacity:0; } }
        .tc-ai__err { margin:0 14px 8px; padding:8px 12px; border-radius:8px; font-size:12px; color:#fecaca; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.3); }
        .tc-ai__input { display:flex; gap:8px; padding:10px 14px; border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
        .tc-ai__input textarea { flex:1; resize:none; background:#1c1c22; color:var(--foreground); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:8px 10px; font-size:13px; font-family:inherit; outline:none; min-height:36px; max-height:120px; }
        .tc-ai__input textarea:focus { border-color:#6366f1; }
        .tc-ai__send { padding:6px 14px; border-radius:8px; border:none; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; font-size:13px; cursor:pointer; align-self:flex-end; }
        .tc-ai__send:disabled { opacity:.5; cursor:not-allowed; }
        /* 历史会话列表 */
        .tc-ai__sessions { position:absolute; top:40px; left:10px; right:10px; z-index:100; background:#1c1c22; border:1px solid rgba(255,255,255,0.1); border-radius:10px; box-shadow:0 10px 40px rgba(0,0,0,.5); max-height:60%; overflow-y:auto; }
        .tc-ai__sessions-header { display:flex; align-items:center; justify-content:space-between; padding:8px 14px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px; color:var(--descriptionForeground); }
        .tc-ai__sessions-close { background:transparent; border:none; color:var(--descriptionForeground); cursor:pointer; font-size:16px; padding:0 6px; }
        .tc-ai__sessions-item { padding:10px 14px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px; }
        .tc-ai__sessions-item:hover { background:rgba(255,255,255,0.06); }
        .tc-ai__sessions-item.active { background:rgba(99,102,241,.12); }
        /* A2UI question 弹窗 */
        .tc-ai__question { position:absolute; bottom:70px; left:10px; right:10px; z-index:100; background:#1c1c22; border:1px solid rgba(99,102,241,.3); border-radius:10px; padding:14px; box-shadow:0 10px 40px rgba(0,0,0,.5); }
        .tc-ai__question h4 { margin:0 0 10px; font-size:13px; color:#c7d2fe; }
        .tc-ai__question-opt { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; cursor:pointer; font-size:13px; }
        .tc-ai__question-opt:hover { background:rgba(99,102,241,.1); }
        .tc-ai__question-opt input { accent-color:#6366f1; }
        .tc-ai__question-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:10px; }
        .tc-ai__badge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:#10b981; color:#fff; font-size:11px; }
      `}</style>

      <div className="tc-ai__header" style={{ position: 'relative' }}>
        <span className="tc-ai__header-title">AI 助手</span>
        {sessionID && (
          <span style={{ fontSize: 11, color: 'var(--descriptionForeground)', marginRight: 4 }}>
            {(sessionID || '').slice(0, 6)}
          </span>
        )}
        <button className="tc-ai__btn" onClick={() => { setShowSessions(!showSessions); if (!showSessions) loadSessions(); }}>
          历史会话
        </button>
        <button className="tc-ai__btn tc-ai__btn--primary" onClick={onNewSession}>新会话</button>

        {showSessions && (
          <div className="tc-ai__sessions">
            <div className="tc-ai__sessions-header">
              <span>历史会话</span>
              <button className="tc-ai__sessions-close" onClick={() => setShowSessions(false)}>×</button>
            </div>
            {sessions.length === 0 && (
              <div style={{ padding: 14, color: '#8b929b', fontSize: 12 }}>暂无历史会话</div>
            )}
            {sessions.map((s: any) => (
              <div
                key={s.id}
                className={`tc-ai__sessions-item ${s.id === sessionID ? 'active' : ''}`}
                onClick={() => { setSessionID(s.id); setShowSessions(false); setRows([]); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || `会话 ${(s.id || '').slice(0, 8)}`}
                  </span>
                  <span style={{ fontSize: 11, color: '#8b929b', marginLeft: 8 }}>
                    {(s.time?.created || s.updated) ? new Date(s.time?.created || s.updated).toLocaleDateString() : ''}
                  </span>
                </div>
                {(s.time?.updated) && (
                  <div style={{ fontSize: 11, color: '#8b929b', marginTop: 2 }}>
                    {new Date(s.time.updated).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tc-ai__agent-select">
        <span>助手:</span>
        <select value={currentAgent} onChange={(e) => onSwitchAgent(e.target.value)}>
          {agents.map((a: any) => (
            <option key={a.id || a.name} value={a.id || a.name}>{a.name || a.id}</option>
          ))}
          {agents.length === 0 && <option value="build">build</option>}
        </select>
      </div>

      <div className="tc-ai__scroll" ref={scrollRef}>
        {rows.length === 0 && !busy && (
          <div className="tc-ai__empty">
            轻松应对复杂项目开发
            <br />
            <span style={{ fontSize: 12, opacity: 0.7 }}>输入消息开始对话 · 支持新会话 / 历史会话 / 多助手</span>
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className={`tc-ai__msg ${r.role === 'user' ? 'is-user' : 'is-assistant'}`}>
            <div className="tc-ai__msg-role">{r.role === 'user' ? '你' : 'AI'}</div>
            <div className={`tc-ai__bubble ${r.id === streamingPartID ? 'tc-ai__cursor' : ''}`}>
              {r.text || (r.role === 'assistant' ? '…' : '')}
            </div>
          </div>
        ))}
        {busy && rows.length > 0 && (
          <div className="tc-ai__msg is-assistant">
            <div className="tc-ai__msg-role">AI</div>
            <div className="tc-ai__bubble tc-ai__cursor">思考中</div>
          </div>
        )}
      </div>

      {error && (
        <div className="tc-ai__err">
          <span>{error}</span>
          <button className="tc-ai__btn" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }} onClick={async () => {
            setError('');
            if (!sessionID) return;
            try {
              const msgs = await aiListMessages(sessionID);
              const rs: Row[] = (msgs || []).map((m: any) => ({
                id: m.id || m.info?.id,
                role: m.role || m.info?.role,
                text: extractText(m.parts || m.info?.parts),
                parts: m.parts || m.info?.parts,
              }));
              setRows(rs);
            } catch (e) { setError(String((e as any)?.message || e)); }
          }}>重试</button>
        </div>
      )}

      {question && (
        <div className="tc-ai__question" style={{ position: 'relative', margin: '0 14px 8px' }}>
          <h4>AI 需要确认</h4>
          {question.questions.map((q: any, qi: number) => (
            <div key={qi}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>{q.question || q.title}</div>
              {/* 根据 question.multiselect 判断: 多选 / 单选; 默认 radio */}
              {((q.options || []).length > 0) ? (
                (q.multiselect || q.multiSelect) ? (
                  (q.options || []).map((opt: any, oi: number) => (
                    <label key={oi} className="tc-ai__question-opt">
                      <input type="checkbox" name={`q-${qi}`} value={opt.label || opt} />
                      <span>{opt.label || opt}{opt.description ? ` — ${opt.description}` : ''}</span>
                    </label>
                  ))
                ) : (
                  (q.options || []).map((opt: any, oi: number) => (
                    <label key={oi} className="tc-ai__question-opt">
                      <input type="radio" name={`q-${qi}`} value={opt.label || opt} />
                      <span>{opt.label || opt}{opt.description ? ` — ${opt.description}` : ''}</span>
                    </label>
                  ))
                )
              ) : (
                <input
                  type="text"
                  placeholder="输入答案"
                  className="tc-ai__question-input"
                  name={`q-${qi}`}
                  style={{ width: '100%', padding: 6, marginTop: 4, background: '#1c1c22', color: 'var(--foreground)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6 }}
                />
              )}
            </div>
          ))}
          <div className="tc-ai__question-actions">
            <button className="tc-ai__btn" onClick={() => onReplyQuestion(['reject'])}>拒绝</button>
            <button
              className="tc-ai__btn tc-ai__btn--primary"
              onClick={() => {
                const answers = question.questions.map((_: any, qi: number) => {
                  const checked = Array.from(document.querySelectorAll(`input[name="q-${qi}"]:checked`)) as HTMLInputElement[];
                  if (checked.length > 0) return checked.map(c => c.value);
                  const text = document.querySelector(`input[type="text"][name="q-${qi}"]`) as HTMLInputElement;
                  return text?.value ? [text.value] : [];
                });
                const flat = ([] as string[]).concat(...answers);
                onReplyQuestion(flat.length > 0 ? flat : ['reject']);
              }}
            >
              确认
            </button>
          </div>
        </div>
      )}

      <div className="tc-ai__input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入消息, Enter 发送, Shift+Enter 换行"
          rows={1}
        />
        {busy ? (
          <button className="tc-ai__btn" onClick={onAbort}>中断</button>
        ) : (
          <button className="tc-ai__send" onClick={onSend} disabled={!input.trim()}>发送</button>
        )}
      </div>
    </div>
  );
};

/** 从 parts 提取文本 */
function extractText(parts: any[] | undefined): string {
  if (!parts || !Array.isArray(parts)) return '';
  return parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

/** SSE delta 应用到 rows */
function applyDelta(rows: Row[], messageID: string, partID: string, field: string, delta: string): Row[] {
  const target = rows.find((r) => r.id === messageID);
  if (target) {
    return rows.map((r) =>
      r.id === messageID ? { ...r, text: (r.text || '') + delta } : r
    );
  }
  // 没找到: 新增一条 assistant 消息
  if (field === 'text') {
    return [...rows, { id: messageID, role: 'assistant', text: delta }];
  }
  return rows;
}

/** SSE part.updated 更新 rows */
function upsertPart(rows: Row[], part: any): Row[] {
  const mid = part.messageID;
  if (part.type === 'text' && typeof part.text === 'string') {
    const existing = rows.find((r) => r.id === mid);
    if (existing) {
      return rows.map((r) => (r.id === mid ? { ...r, text: part.text } : r));
    }
    return [...rows, { id: mid, role: 'assistant', text: part.text }];
  }
  return rows;
}