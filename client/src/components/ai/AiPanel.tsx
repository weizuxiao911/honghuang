import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  getAiClient,
  aiCreateSession,
  aiListSessions,
  aiListMessages,
  aiSendMessage,
  aiAbort,
  aiListAgents,
  aiSwitchAgent,
  aiReplyQuestion,
} from '../../commands/ai/api';

/**
 * AI 助手面板 — right 槽位默认 webview (components/ai/)
 *
 * 参考实现: web-opencode-agent/webview (Trae 风格)
 * https://github.com/weizuxiao911/taichu/tree/main/client (本地)
 * https://web-opencode-agent/webview/src/ui/AssistantHistoryMessage/renderParts.tsx
 *
 * 架构:
 *   消息流 = Message[] (每个含 parts: Part[])
 *   Part 分发按 part.type:
 *     - text      → MarkdownRenderer (流式打字机)
 *     - reasoning → 可折叠 (默认折叠, 流式时展开)
 *     - tool      → getToolRenderKind(tool.tool):
 *         - 'question'   → QuestionToolView (A2UI 选项弹窗)
 *         - 'todowrite'  → TodowriteToolView (任务列表)
 *         - 'subagent'   → SubAgentToolView (子 agent banner)
 *         - 'default'    → DefaultToolGroupView (可折叠, input/output)
 *
 * 事件驱动: SDK client 从 window.__TAICHU_OPENCODE__ 读 (commands/opencode 事件驱动)
 * 不 import opencode 模块.
 *
 * SDK v2 数据结构示例:
 *   Message.parts: Part[] = TextPart | ReasoningPart | ToolPart | StepStartPart | ...
 *   ToolPart.tool: 'bash' | 'read' | 'write' | 'edit' | 'todowrite' | 'question' | 'task' | 'subagent' | ...
 *   ToolPart.state.status: 'pending' | 'running' | 'completed' | 'error'
 *   ToolPart.state.input: 工具输入
 *   ToolPart.state.output: 工具输出
 *   ToolPart.state.metadata: { todos?: Todo[], answers?: string[][], sessionId?: string }
 */

interface Row {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  parts?: any[];       // OpenCode Message.parts
  error?: any;
  streaming?: boolean; // 流式中
}

type ToolRenderKind = 'question' | 'subagent' | 'todowrite' | 'default';

function isQuestionToolName(toolName: string): boolean {
  return toolName === 'question' || toolName.toLowerCase().includes('question');
}
function isSubAgentTaskToolName(toolName: string): boolean {
  if (!toolName) return false;
  const n = toolName.toLowerCase();
  return n === 'task' || n === 'subagent' || n === 'subagent_task';
}
function isTodoWriteToolName(toolName: string): boolean {
  return toolName === 'todowrite' || toolName.toLowerCase() === 'todowrite';
}
function getToolRenderKind(toolName: string): ToolRenderKind {
  if (isQuestionToolName(toolName)) return 'question';
  if (isSubAgentTaskToolName(toolName)) return 'subagent';
  if (isTodoWriteToolName(toolName)) return 'todowrite';
  return 'default';
}

// 从 ToolPart.state.metadata 提取 todos (与 webview 一致)
function extractAssistantTodos(value: any): Array<{ content: string; status: string; priority?: string }> {
  if (!value) return [];
  const arr = (value as any)?.todos ?? (Array.isArray(value) ? value : null);
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const items: Array<{ content: string; status: string; priority?: string }> = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const content = (e as any).content;
    const status = (e as any).status;
    const priority = (e as any).priority;
    if (typeof content !== 'string' || content.trim().length === 0) continue;
    const normalizedStatus =
      status === 'completed' || status === 'in_progress' || status === 'pending'
        ? status
        : 'pending';
    items.push({
      content: content.trim(),
      status: normalizedStatus,
      priority: typeof priority === 'string' ? priority.trim().toLowerCase() : undefined,
    });
  }
  return items;
}

// 从 ToolPart.state 提取 question (v2 QuestionV2Info[] 格式)
function extractQuestions(part: any): Array<{ question: string; header?: string; options: Array<{ label: string; description: string }> }> | null {
  const candidates = [
    part?.state?.output,
    part?.state?.input,
    part?.state?.status === 'pending' ? part?.state?.raw : null,
  ];
  for (const cand of candidates) {
    const v = typeof cand === 'string' ? (() => { try { return JSON.parse(cand); } catch { return null; } })() : cand;
    const qs = (v as any)?.questions;
    if (Array.isArray(qs) && qs.length > 0 && qs.every((q: any) => typeof q.question === 'string' && Array.isArray(q.options))) {
      return qs.map((q: any) => ({
        question: q.question,
        header: q.header,
        options: q.options.map((o: any) => ({
          label: typeof o === 'string' ? o : (o.label ?? String(o)),
          description: typeof o === 'object' ? (o.description ?? '') : '',
        })),
      }));
    }
  }
  return null;
}

// 从 part 提取 requestID
function extractRequestId(part: any): string {
  return (
    part?.state?.metadata?.requestID ??
    part?.state?.metadata?.requestId ??
    part?.id
  );
}

export const AiPanel: React.FC = () => {
  const [sessionID, setSessionID] = useState<string>('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>('build');
  const [showSessions, setShowSessions] = useState(false);
  const [error, setError] = useState('');
  const sessionIDRef = useRef(sessionID);
  sessionIDRef.current = sessionID;
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初始化: 加载 subagent 列表
  useEffect(() => {
    (async () => {
      try {
        const list = await aiListAgents();
        setAgents(list || []);
      } catch (e) { console.warn('[ai] load agents failed', e); }
    })();
  }, []);

  // 监听 taichu:ai-reveal (TopBar 右栏 toggle 展开) → focus
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

  // 加载历史会话
  const loadSessions = useCallback(async () => {
    try {
      const list = await aiListSessions();
      setSessions(list || []);
    } catch (e) { setError(String((e as any)?.message || e)); }
  }, []);

  // 加载会话消息
  const loadMessages = useCallback(async (sid?: string) => {
    const target = sid || sessionIDRef.current;
    if (!target) { setRows([]); return; }
    try {
      const msgs = await aiListMessages(target);
      const rs: Row[] = (msgs || []).map((m: any) => {
        const info = m.info || m;
        const parts = m.parts || info?.parts;
        const text = extractText(parts);
        return {
          id: info?.id || m.id,
          role: info?.role || m.role,
          text,
          parts: parts || [],
        };
      });
      setRows(rs);
    } catch (e) { setError(String((e as any)?.message || e)); }
  }, [sessionID]);

  // 会话切换 → 加载消息
  useEffect(() => {
    if (sessionID) {
      loadMessages(sessionID);
    } else {
      setRows([]);
    }
  }, [sessionID, loadMessages]);

  // SSE 监听 — global.event 流
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
          // 流式文本增量 (text part) — append
          const { messageID, partID, field, delta } = props;
          if (field !== 'text' || typeof delta !== 'string') return;
          setRows((prev) =>
            prev.map((r) =>
              r.id === messageID && r.parts
                ? {
                    ...r,
                    parts: r.parts.map((p: any) =>
                      p.id === partID && p.type === 'text'
                        ? { ...p, text: (p.text || '') + delta }
                        : p
                    ),
                    text: extractText(r.parts.map((p: any) =>
                      p.id === partID && p.type === 'text' ? { ...p, text: (p.text || '') + delta } : p
                    )),
                  }
                : r
            )
          );
          break;
        }
        case 'message.part.updated':
        case 'message.updated': {
          // 全量或局部更新 — 触发 reload 当前消息(避免复杂的增量合并)
          if (cur) loadMessages(cur);
          break;
        }
        case 'message.removed':
        case 'message.part.removed': {
          if (cur) loadMessages(cur);
          break;
        }
        case 'session.status': {
          const stype = typeof props.status === 'string' ? props.status : props.status?.type;
          setBusy(stype !== 'idle');
          break;
        }
        case 'session.idle':
          setBusy(false);
          break;
        case 'session.error':
          setBusy(false);
          setError(props.error?.data?.message || props.error?.message || '会话出错');
          break;
        case 'question.asked':
        case 'question.v2.asked':
          // question 已在 part 渲染 (当 tool=question 时), 这里不需要单独处理
          break;
        default:
          break;
      }
    }

    return () => {
      cancelled = true;
      stream?.return?.(undefined);
    };
  }, [loadMessages]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rows, busy]);

  const onNewSession = useCallback(async () => {
    try {
      const sid = await aiCreateSession();
      setSessionID(sid);
      setRows([]);
      setShowSessions(false);
    } catch (e) { setError(String((e as any)?.message || e)); }
  }, []);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    const localId = `local-${Date.now()}`;
    // 立即显示用户消息 (乐观)
    setRows((prev) => [...prev, { id: localId, role: 'user', text, parts: [{ type: 'text', text }] }]);
    try {
      let sid = sessionID;
      if (!sid) {
        sid = await aiCreateSession();
        setSessionID(sid);
      }
      await aiSendMessage(sid, text, currentAgent);
      setBusy(true);
    } catch (e) {
      setRows((prev) => prev.filter((r) => r.id !== localId));
      setInput(text);
      setError(String((e as any)?.message || e));
    }
  }, [input, busy, sessionID, currentAgent]);

  const onAbort = useCallback(async () => {
    if (!sessionID) return;
    try { await aiAbort(sessionID); } catch (e) { setError(String((e as any)?.message || e)); }
  }, [sessionID]);

  const onSwitchSession = useCallback((sid: string) => {
    setSessionID(sid);
    setShowSessions(false);
    setRows([]);
  }, []);

  const onSwitchAgent = useCallback(async (agent: string) => {
    setCurrentAgent(agent);
    if (sessionID) {
      try { await aiSwitchAgent(sessionID, agent); } catch (e) { setError(String((e as any)?.message || e)); }
    }
  }, [sessionID]);

  const onReplyQuestion = useCallback(async (sid: string, rid: string, answers: any) => {
    try {
      await aiReplyQuestion(sid, rid, answers);
    } catch (e) { setError(String((e as any)?.message || e)); }
  }, []);

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
      <style>{styles}</style>

      <div className="tc-ai__header" style={{ position: 'relative' }}>
        <span className="tc-ai__header-title">AI 助手</span>
        {sessionID && (
          <span style={{ fontSize: 10, color: 'var(--descriptionForeground)', marginRight: 4, fontFamily: 'monospace' }}>
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
                onClick={() => onSwitchSession(s.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || `会话 ${(s.id || '').slice(0, 8)}`}
                  </span>
                  <span style={{ fontSize: 11, color: '#8b929b', marginLeft: 8 }}>
                    {(s.time?.created || s.updated) ? new Date(s.time?.created || s.updated).toLocaleDateString() : ''}
                  </span>
                </div>
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
          <EmptyState onSend={onSend} />
        )}
        {rows.map((r) => (
          <MessageView
            key={r.id}
            row={r}
            streaming={busy && r.role === 'assistant' && r.id === rows[rows.length - 1]?.id}
            onReplyQuestion={onReplyQuestion}
          />
        ))}
        {busy && rows.length > 0 && <TypingIndicator />}
      </div>

      {error && (
        <div className="tc-ai__err">
          <span>{error}</span>
          <button className="tc-ai__btn" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }} onClick={async () => {
            setError('');
            if (!sessionID) return;
            try {
              await loadMessages(sessionID);
            } catch (e) { setError(String((e as any)?.message || e)); }
          }}>重试</button>
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

// ============== 组件 ==============

const EmptyState: React.FC<{ onSend: () => void }> = ({ onSend }) => (
  <div className="tc-ai__empty">
    <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 8 }}>✨</div>
    轻松应对复杂项目开发
    <br />
    <span style={{ fontSize: 12, opacity: 0.7 }}>输入消息开始对话 · 支持多 subagent / 任务规划 / A2UI 交互</span>
  </div>
);

const TypingIndicator: React.FC = () => (
  <div className="tc-ai__msg is-assistant">
    <div className="tc-ai__msg-role">AI</div>
    <div className="tc-ai__bubble tc-ai__cursor">思考中</div>
  </div>
);

const MessageView: React.FC<{
  row: Row;
  streaming: boolean;
  onReplyQuestion: (sid: string, rid: string, answers: any) => Promise<void>;
}> = ({ row, streaming, onReplyQuestion }) => {
  if (row.role === 'user') {
    return (
      <div className="tc-ai__msg is-user">
        <div className="tc-ai__msg-role">你</div>
        <div className="tc-ai__bubble">{row.text || '...'}</div>
      </div>
    );
  }

  return (
    <div className="tc-ai__msg is-assistant">
      <div className="tc-ai__msg-role">AI</div>
      <div className="tc-ai__bubble">
        {(row.parts || []).map((part: any, i: number) => (
          <PartView
            key={part.id || i}
            part={part}
            streaming={streaming}
            onReplyQuestion={onReplyQuestion}
          />
        ))}
      </div>
    </div>
  );
};

const PartView: React.FC<{
  part: any;
  streaming: boolean;
  onReplyQuestion: (sid: string, rid: string, answers: any) => Promise<void>;
}> = ({ part, streaming, onReplyQuestion }) => {
  // 跳过合成/系统 part
  if (part?.synthetic || part?.ignored) return null;

  switch (part.type) {
    case 'text':
      return <div className={streaming ? 'tc-ai__cursor' : ''}>{part.text || ''}</div>;
    case 'reasoning':
      return <ReasoningView part={part} />;
    case 'tool':
      return <ToolDispatch part={part} onReplyQuestion={onReplyQuestion} />;
    default:
      // step-start / step-finish / snapshot / patch / agent / retry / compaction 隐藏
      return null;
  }
};

const ReasoningView: React.FC<{ part: any }> = ({ part }) => {
  const [expanded, setExpanded] = useState(false);
  const text = String(part.text || '').trim();
  if (!text) return null;
  return (
    <details
      className="tc-ai__reasoning"
      style={{ marginBottom: 6 }}
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--descriptionForeground)', userSelect: 'none' }}>
        思考过程
      </summary>
      <div style={{ padding: '4px 0', fontSize: 12, color: 'var(--descriptionForeground)', whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    </details>
  );
};

const ToolDispatch: React.FC<{
  part: any;
  onReplyQuestion: (sid: string, rid: string, answers: any) => Promise<void>;
}> = ({ part, onReplyQuestion }) => {
  const kind = getToolRenderKind(String(part.tool || ''));
  switch (kind) {
    case 'question':
      return <QuestionToolView part={part} onReply={onReplyQuestion} />;
    case 'todowrite':
      return <TodowriteToolView part={part} />;
    case 'subagent':
      return <SubAgentToolView part={part} />;
    default:
      return <DefaultToolGroupView parts={[part]} />;
  }
};

const QuestionToolView: React.FC<{
  part: any;
  onReply: (sid: string, rid: string, answers: any) => Promise<void>;
}> = ({ part, onReply }) => {
  const questions = extractQuestions(part);
  const requestId = extractRequestId(part);
  const status = part?.state?.status; // pending | running | completed | error
  const [selected, setSelected] = useState<Record<number, string | string[]>>({});
  const [customAnswer, setCustomAnswer] = useState<Record<number, string>>({});

  if (!questions) {
    return <DefaultToolGroupView parts={[part]} />;
  }

  const handleConfirm = async () => {
    const answers = questions.map((q, i) => {
      const opts = q.options || [];
      const isMulti = opts.length > 0 && opts.length >= 2; // 多选启发式
      const sel = selected[i];
      const custom = customAnswer[i]?.trim();
      if (sel && Array.isArray(sel)) return sel;
      if (custom) return [custom];
      return sel ? [sel] : [];
    });
    await onReply(part.sessionID, requestId, answers);
  };

  return (
    <div className="tc-ai__question">
      <div className="tc-ai__question-header">
        <span>AI 需要确认 · 状态 {status}</span>
      </div>
      {questions.map((q, qi) => (
        <div key={qi} className="tc-ai__question-item">
          <div className="tc-ai__question-q">{q.question}</div>
          <div className="tc-ai__question-options">
            {(q.options || []).map((opt, oi) => (
              <label key={oi} className="tc-ai__question-opt">
                <input
                  type="checkbox"
                  checked={Array.isArray(selected[qi]) && (selected[qi] as string[]).includes(opt.label)}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const cur = Array.isArray(prev[qi]) ? (prev[qi] as string[]) : [];
                      return {
                        ...prev,
                        [qi]: e.target.checked
                          ? Array.from(new Set([...cur, opt.label]))
                          : cur.filter((s) => s !== opt.label),
                      };
                    });
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
            <input
              type="text"
              className="tc-ai__question-custom"
              placeholder="自定义答案"
              value={customAnswer[qi] || ''}
              onChange={(e) => setCustomAnswer((prev) => ({ ...prev, [qi]: e.target.value }))}
            />
          </div>
        </div>
      ))}
      <div className="tc-ai__question-actions">
        <button className="tc-ai__btn" onClick={handleConfirm}>提交</button>
      </div>
    </div>
  );
};

const TodowriteToolView: React.FC<{ part: any }> = ({ part }) => {
  const [expanded, setExpanded] = useState(true);
  const todos = useMemo(() => {
    const candidates = [part?.state?.output, part?.state?.input];
    for (const c of candidates) {
      const list = extractAssistantTodos(c);
      if (list.length > 0) return list;
    }
    return [];
  }, [part]);
  const stats = useMemo(() => {
    let total = todos.length, completed = 0, inProgress = 0;
    for (const t of todos) {
      if (t.status === 'completed') completed += 1;
      else if (t.status === 'in_progress') inProgress += 1;
    }
    return { total, completed, inProgress };
  }, [todos]);

  return (
    <div className="tc-ai__todo">
      <div className="tc-ai__todo-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <span className="tc-ai__todo-icon">{part.state.status === 'completed' ? '✓' : (part.state.status === 'running' ? '◐' : '○')}</span>
        <span style={{ flex: 1 }}>
          {part.state.status === 'pending' && stats.total === 0
            ? '正在规划任务...'
            : `任务 ${stats.completed}/${stats.total}${stats.inProgress > 0 ? ` · ${stats.inProgress} 进行中` : ''}`}
        </span>
        <span style={{ fontSize: 11, color: 'var(--descriptionForeground)' }}>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && todos.length > 0 && (
        <div className="tc-ai__todo-list">
          {todos.map((t, i) => (
            <div key={i} className={`tc-ai__todo-item is-${t.status}`}>
              <span className="tc-ai__todo-bullet">
                {t.status === 'completed' ? '✓' : (t.status === 'in_progress' ? '◐' : '○')}
              </span>
              <span className="tc-ai__todo-content">{t.content}</span>
              {t.priority && <span className="tc-ai__todo-priority">{t.priority}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SubAgentToolView: React.FC<{ part: any }> = ({ part }) => {
  const status = part?.state?.status || 'pending';
  const subId = part?.state?.metadata?.sessionId || part?.state?.metadata?.sessionID;
  const input = part?.state?.input || {};
  return (
    <div className="tc-ai__subagent">
      <span className="tc-ai__subagent-icon">🤖</span>
      <span className="tc-ai__subagent-name">
        {input?.agent_name || input?.name || '子 agent'} ({input?.model || '?'})
      </span>
      <span className="tc-ai__subagent-status">{status}</span>
      {subId && <span style={{ fontSize: 10, color: 'var(--descriptionForeground)', fontFamily: 'monospace' }}>{(subId || '').slice(0, 8)}</span>}
    </div>
  );
};

const DefaultToolGroupView: React.FC<{ parts: any[] }> = ({ parts }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="tc-ai__tool-group">
      <div className="tc-ai__tool-group-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <span className="tc-ai__tool-group-icon">⚙</span>
        <span style={{ flex: 1 }}>{parts[0]?.tool || 'tool'}</span>
        <span style={{ fontSize: 11, color: 'var(--descriptionForeground)' }}>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="tc-ai__tool-group-body">
          {parts.map((p, i) => (
            <div key={i} className="tc-ai__tool-detail">
              {p?.state?.input && (
                <div className="tc-ai__tool-section">
                  <div className="tc-ai__tool-section-label">输入</div>
                  <pre>{typeof p.state.input === 'string' ? p.state.input : JSON.stringify(p.state.input, null, 2)}</pre>
                </div>
              )}
              {p?.state?.output && (
                <div className="tc-ai__tool-section">
                  <div className="tc-ai__tool-section-label">输出</div>
                  <pre>{typeof p.state.output === 'string' ? p.state.output : JSON.stringify(p.state.output, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============== Helpers ==============

function extractText(parts: any[] | undefined): string {
  if (!parts || !Array.isArray(parts)) return '';
  return parts
    .filter((p) => p?.type === 'text' && !p?.synthetic && !p?.ignored)
    .map((p) => p.text || '')
    .join('');
}

// ============== Styles ==============

const styles = `
.tc-ai { display:flex; flex-direction:column; height:100%; background:var(--panel-background,#0e0e12); color:var(--foreground,#e5e7eb); font-size:13px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; user-select:none; }
.tc-ai__header { display:flex; align-items:center; gap:6px; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
.tc-ai__header-title { flex:1; font-weight:600; font-size:13px; }
.tc-ai__btn { padding:4px 8px; font-size:11px; border-radius:5px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:var(--foreground); cursor:pointer; transition:background .15s; }
.tc-ai__btn:hover { background:rgba(255,255,255,0.1); }
.tc-ai__btn--primary { background:linear-gradient(135deg,#6366f1,#8b5cf6); border-color:transparent; color:#fff; }
.tc-ai__agent-select { display:flex; align-items:center; gap:6px; padding:4px 12px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; font-size:11px; }
.tc-ai__agent-select select { background:#1c1c22; color:var(--foreground); border:1px solid rgba(255,255,255,0.12); border-radius:5px; padding:2px 6px; font-size:11px; }
.tc-ai__scroll { flex:1; min-height:0; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:8px; }
.tc-ai__empty { margin:auto; text-align:center; color:var(--descriptionForeground,#8b929b); padding:30px 16px; line-height:1.6; }
.tc-ai__msg { display:flex; flex-direction:column; gap:2px; }
.tc-ai__msg.is-user { align-items:flex-end; }
.tc-ai__msg-role { font-size:10px; color:var(--descriptionForeground,#8b929b); padding:0 4px; }
.tc-ai__bubble { padding:8px 12px; border-radius:10px; max-width:95%; line-height:1.55; font-size:13px; word-break:break-word; }
.tc-ai__msg.is-user .tc-ai__bubble { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border-top-right-radius:4px; }
.tc-ai__msg.is-assistant .tc-ai__bubble { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); padding:6px 10px; border-top-left-radius:4px; }
.tc-ai__cursor::after { content:'▍'; display:inline-block; animation:tc-ai-blink 1s steps(2) infinite; margin-left:2px; }
@keyframes tc-ai-blink { 50% { opacity:0; } }
.tc-ai__err { margin:0 12px 8px; padding:6px 10px; border-radius:6px; font-size:11px; color:#fecaca; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.3); display:flex; align-items:center; }
.tc-ai__input { display:flex; gap:6px; padding:8px 12px; border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
.tc-ai__input textarea { flex:1; resize:none; background:#1c1c22; color:var(--foreground); border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:6px 8px; font-size:13px; font-family:inherit; outline:none; min-height:28px; max-height:80px; }
.tc-ai__input textarea:focus { border-color:#6366f1; }
.tc-ai__send { padding:4px 12px; border-radius:6px; border:none; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; font-size:12px; cursor:pointer; align-self:flex-end; }
.tc-ai__send:disabled { opacity:.5; cursor:not-allowed; }
.tc-ai__sessions { position:absolute; top:36px; left:8px; right:8px; z-index:100; background:#1c1c22; border:1px solid rgba(255,255,255,0.1); border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,.5); max-height:50%; overflow-y:auto; }
.tc-ai__sessions-header { display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:11px; color:var(--descriptionForeground); }
.tc-ai__sessions-close { background:transparent; border:none; color:var(--descriptionForeground); cursor:pointer; font-size:14px; padding:0 4px; }
.tc-ai__sessions-item { padding:8px 10px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); font-size:11px; }
.tc-ai__sessions-item:hover { background:rgba(255,255,255,0.06); }
.tc-ai__sessions-item.active { background:rgba(99,102,241,.12); }
/* Question */
.tc-ai__question { margin:6px 0; padding:8px 10px; border:1px solid rgba(99,102,241,.3); border-radius:8px; background:rgba(99,102,241,.04); }
.tc-ai__question-header { font-size:11px; color:#c7d2fe; margin-bottom:6px; }
.tc-ai__question-item { margin-top:6px; }
.tc-ai__question-q { font-size:12px; margin-bottom:4px; }
.tc-ai__question-options { display:flex; flex-direction:column; gap:3px; }
.tc-ai__question-opt { display:flex; align-items:center; gap:6px; padding:3px 4px; font-size:12px; }
.tc-ai__question-opt input { accent-color:#6366f1; }
.tc-ai__question-custom { background:#1c1c22; color:var(--foreground); border:1px solid rgba(255,255,255,0.12); border-radius:4px; padding:3px 6px; font-size:11px; margin-top:3px; }
.tc-ai__question-actions { display:flex; gap:6px; justify-content:flex-end; margin-top:8px; }
/* Todo (todowrite tool) */
.tc-ai__todo { margin:6px 0; padding:6px 8px; border:1px solid rgba(255,255,255,0.06); border-radius:6px; background:rgba(99,102,241,.04); }
.tc-ai__todo-header { display:flex; align-items:center; gap:6px; font-size:12px; padding:2px 0; }
.tc-ai__todo-icon { font-size:14px; }
.tc-ai__todo-list { margin-top:6px; padding-left:4px; border-left:1px solid rgba(255,255,255,0.08); }
.tc-ai__todo-item { display:flex; align-items:center; gap:6px; padding:3px 6px; font-size:11px; opacity:0.9; }
.tc-ai__todo-item.is-completed { opacity:0.5; }
.tc-ai__todo-item.is-completed .tc-ai__todo-content { text-decoration:line-through; }
.tc-ai__todo-bullet { font-size:11px; opacity:0.8; }
.tc-ai__todo-priority { font-size:9px; padding:0 4px; border-radius:3px; background:rgba(255,255,255,0.08); color:var(--descriptionForeground); margin-left:auto; }
/* SubAgent */
.tc-ai__subagent { display:flex; align-items:center; gap:6px; padding:6px 8px; margin:4px 0; border-radius:6px; background:rgba(139,92,246,.06); border:1px solid rgba(139,92,246,.18); font-size:11px; }
.tc-ai__subagent-icon { font-size:14px; }
.tc-ai__subagent-name { font-weight:500; }
.tc-ai__subagent-status { font-size:10px; padding:0 4px; border-radius:3px; background:rgba(255,255,255,0.08); color:var(--descriptionForeground); }
/* Default tool */
.tc-ai__tool-group { margin:4px 0; padding:6px 8px; border:1px solid rgba(255,255,255,0.06); border-radius:6px; }
.tc-ai__tool-group-header { display:flex; align-items:center; gap:6px; font-size:11px; }
.tc-ai__tool-group-icon { font-size:13px; }
.tc-ai__tool-group-body { margin-top:6px; }
.tc-ai__tool-section { margin-top:4px; }
.tc-ai__tool-section-label { font-size:10px; color:var(--descriptionForeground); margin-bottom:2px; }
.tc-ai__tool-section pre { overflow-x:auto; background:rgba(0,0,0,.15); padding:4px 6px; border-radius:4px; font-size:11px; margin:0; white-space:pre-wrap; word-break:break-word; }
/* Reasoning (collapsed) */
.tc-ai__reasoning { background:rgba(255,255,255,0.02); }
.tc-ai__reasoning summary { list-style:none; cursor:pointer; }
.tc-ai__reasoning summary::-webkit-details-marker { display:none; }
`;