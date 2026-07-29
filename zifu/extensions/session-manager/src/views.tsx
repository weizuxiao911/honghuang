const React = require('React');
const { useState, useEffect, useCallback, useMemo } = React;

const OPENCODE_BASE_URL = 'http://df-dev.localhost';
const ACTIVE_SESSION_KEY = 'zifu.activeSessionId';
const POLL_INTERVAL = 15000;

interface Session {
  id: string;
  slug?: string;
  title: string;
  time?: { created: number; updated: number };
}

async function listSessions(): Promise<Session[]> {
  const res = await fetch(`${OPENCODE_BASE_URL}/session`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET /session ${res.status}`);
  return res.json();
}

async function createSession(): Promise<Session> {
  const res = await fetch(`${OPENCODE_BASE_URL}/session`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '新对话' }),
  });
  if (!res.ok) throw new Error(`POST /session ${res.status}`);
  return res.json();
}

async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${OPENCODE_BASE_URL}/session/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`DELETE /session/${id} ${res.status}`);
}

const STYLE_ID = 'zifu-session-manager-style';
const CSS = `
.an-sm { display:flex; flex-direction:column; height:100%; font-size:var(--font-size,13px); color:var(--sideBar-foreground,var(--foreground)); background:var(--sideBar-background); }
.an-sm__top { padding:10px 10px 2px; display:flex; flex-direction:column; gap:8px; }
.an-sm__search { display:flex; align-items:center; gap:6px; height:28px; padding:0 8px; border-radius:6px; color:var(--input-foreground); background:var(--input-background); border:1px solid var(--input-border,transparent); }
.an-sm__search:focus-within { border-color:var(--focusBorder); outline:1px solid var(--focusBorder); outline-offset:-2px; }
.an-sm__search-icon { flex:0 0 auto; display:flex; color:var(--input-placeholderForeground); }
.an-sm__search input { flex:1; min-width:0; border:none; outline:none; background:transparent; color:inherit; font:inherit; }
.an-sm__search input::placeholder { color:var(--input-placeholderForeground); }
.an-sm__new { display:flex; align-items:center; gap:8px; height:30px; padding:0 10px; border-radius:6px; cursor:pointer; font-weight:500; user-select:none; color:var(--foreground); background:var(--input-background); border:1px solid var(--input-border,transparent); }
.an-sm__new:hover { background:var(--list-hoverBackground); }
.an-sm__new:focus-visible { outline:1px solid var(--focusBorder); outline-offset:1px; }
.an-sm__new-kbd { margin-left:auto; font-size:11px; color:var(--descriptionForeground); }
.an-sm__err { margin:8px 10px 2px; padding:8px 10px; border-radius:6px; font-size:12px; display:flex; align-items:center; gap:8px; color:var(--inputValidation-errorForeground,var(--errorForeground)); background:var(--inputValidation-errorBackground,transparent); border:1px solid var(--inputValidation-errorBorder,currentColor); }
.an-sm__err-msg { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.an-sm__err-retry { flex:0 0 auto; padding:2px 8px; border-radius:4px; cursor:pointer; user-select:none; color:var(--button-secondaryForeground); background:var(--button-secondaryBackground); border:1px solid var(--button-border,transparent); }
.an-sm__err-retry:hover { background:var(--button-secondaryHoverBackground); }
.an-sm__list { flex:1; overflow-y:auto; padding:2px 6px 10px; }
.an-sm__group { padding:12px 8px 4px; font-size:11px; font-weight:600; letter-spacing:.04em; user-select:none; color:var(--sideBarSectionHeader-foreground,var(--descriptionForeground)); }
.an-sm__item { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; }
.an-sm__item:hover { background:var(--list-hoverBackground); color:var(--list-hoverForeground,inherit); }
.an-sm__item.is-active, .an-sm__item.is-active:hover { background:var(--list-activeSelectionBackground); color:var(--list-activeSelectionForeground,inherit); }
.an-sm__item:focus-visible { outline:1px solid var(--focusBorder); outline-offset:-1px; }
.an-sm__item-icon { flex:0 0 auto; display:flex; opacity:.75; }
.an-sm__item-title { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.an-sm__item-time { flex:0 0 auto; font-size:11px; color:var(--descriptionForeground); }
.an-sm__item.is-active .an-sm__item-time { color:inherit; opacity:.65; }
.an-sm__item-del { flex:0 0 auto; visibility:hidden; padding:3px; border-radius:4px; display:flex; color:inherit; }
.an-sm__item:hover .an-sm__item-del { visibility:visible; opacity:.65; }
.an-sm__item-del:hover { opacity:1 !important; background:var(--toolbar-hoverBackground); }
.an-sm__empty { padding:28px 16px; text-align:center; line-height:1.7; color:var(--descriptionForeground); user-select:none; }
.an-sm__foot { border-top:1px solid var(--sideBar-border,transparent); padding:10px 12px; display:flex; align-items:center; gap:8px; }
.an-sm__avatar { width:24px; height:24px; border-radius:50%; flex:0 0 auto; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; user-select:none; background:var(--badge-background); color:var(--badge-foreground); }
.an-sm__user { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
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

function relativeTime(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString();
}

const GROUP_ORDER = ['今天', '昨天', '过去 7 天', '更早'];

function groupOf(ts?: number): string {
  if (!ts) return '更早';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  if (ts >= startOfToday) return '今天';
  if (ts >= startOfToday - day) return '昨天';
  if (ts >= startOfToday - 7 * day) return '过去 7 天';
  return '更早';
}

const SearchIcon = () =>
  React.createElement(
    'svg',
    { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none' },
    React.createElement('circle', { cx: 7, cy: 7, r: 4.5, stroke: 'currentColor', strokeWidth: 1.2 }),
    React.createElement('path', { d: 'M13 13l-2.5-2.5', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' })
  );

const ChatIcon = () =>
  React.createElement(
    'svg',
    { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none' },
    React.createElement('path', {
      d: 'M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H6l-3 3v-3H3.5A1.5 1.5 0 0 1 2 9.5v-6Z',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinejoin: 'round',
    })
  );

const PlusIcon = () =>
  React.createElement(
    'svg',
    { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none' },
    React.createElement('path', { d: 'M8 3v10M3 8h10', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' })
  );

const TrashIcon = () =>
  React.createElement(
    'svg',
    { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none' },
    React.createElement('path', {
      d: 'M3 4h10M6.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M5 4l.5 8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L11 4',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    })
  );

const SessionManager = () => {
  useInjectStyle();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_SESSION_KEY) || '';
    } catch {
      return '';
    }
  });
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateSessionTitle = useCallback(async (id: string, title: string) => {
    const res = await fetch(`${OPENCODE_BASE_URL}/session/${id}`, {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`PATCH /session/${id} ${res.status}`);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const list = await listSessions();
      list.sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0));
      setSessions(list);
      setError('');
    } catch (e: any) {
      if (!silent) setError(String(e?.message || e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // 监听 chat-window 消息发送事件, 自动更新会话标题 (设计文档第四章: A2UI 协议前端本地管控表单双向绑定)
  useEffect(() => {
    const handler = async (e: any) => {
      const { sessionID, messageText } = e.detail || {};
      if (!sessionID || !messageText) return;
      const newTitle = messageText.slice(0, 20);
      try {
        await updateSessionTitle(sessionID, newTitle);
        await refresh(true);
      } catch (err: any) {
        console.error('[zifu-session-manager] 更新标题失败', err);
      }
    };
    window.addEventListener('zifu:message-sent', handler as any);
    return () => window.removeEventListener('zifu:message-sent', handler as any);
  }, [updateSessionTitle, refresh]);

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, id);
    } catch {}
    window.dispatchEvent(new CustomEvent('zifu:session-changed', { detail: { id } }));
  }, []);

  const onCreate = useCallback(async () => {
    setError('');
    try {
      const s = await createSession();
      selectSession(s.id);
      await refresh(true);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, [refresh, selectSession]);

  const onDelete = useCallback(
    async (e: any, id: string) => {
      e.stopPropagation();
      setError('');
      try {
        await deleteSession(id);
        if (id === activeId) {
          setActiveId('');
          try {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
          } catch {}
        }
        await refresh(true);
      } catch (err: any) {
        setError(String(err?.message || err));
      }
    },
    [refresh, activeId]
  );

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(true), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        onCreate();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onCreate]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return sessions;
    return sessions.filter((s) => (s.title || s.slug || '').toLowerCase().includes(kw));
  }, [sessions, keyword]);

  const sections = useMemo(() => {
    if (keyword.trim()) return [{ label: '', items: filtered }];
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const g = groupOf(s.time?.updated);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }));
  }, [filtered, keyword]);

  const renderItem = (s: Session) =>
    React.createElement(
      'div',
      {
        key: s.id,
        className: 'an-sm__item' + (s.id === activeId ? ' is-active' : ''),
        onClick: () => selectSession(s.id),
        title: `${s.title || s.slug || s.id} · ${relativeTime(s.time?.updated)}`,
      },
      React.createElement('span', { className: 'an-sm__item-icon' }, React.createElement(ChatIcon, null)),
      React.createElement('span', { className: 'an-sm__item-title' }, s.title || s.slug || '新对话'),
      React.createElement('span', { className: 'an-sm__item-time' }, relativeTime(s.time?.updated)),
      React.createElement(
        'span',
        { className: 'an-sm__item-del', title: '删除', onClick: (e: any) => onDelete(e, s.id) },
        React.createElement(TrashIcon, null)
      )
    );

  return React.createElement(
    'div',
    { className: 'an-sm' },
    React.createElement(
      'div',
      { className: 'an-sm__top' },
      React.createElement(
        'div',
        { className: 'an-sm__search' },
        React.createElement('span', { className: 'an-sm__search-icon' }, React.createElement(SearchIcon, null)),
        React.createElement('input', {
          placeholder: '搜索对话',
          value: keyword,
          onChange: (e: any) => setKeyword(e.target.value),
        })
      ),
      React.createElement(
        'div',
        { className: 'an-sm__new', onClick: onCreate, role: 'button', tabIndex: 0 },
        React.createElement(PlusIcon, null),
        React.createElement('span', null, '新对话'),
        React.createElement('span', { className: 'an-sm__new-kbd' }, '⌘K')
      )
    ),
    error
      ? React.createElement(
          'div',
          { className: 'an-sm__err' },
          React.createElement('span', { className: 'an-sm__err-msg', title: error }, error),
          React.createElement('span', { className: 'an-sm__err-retry', onClick: () => refresh() }, '重试')
        )
      : null,
    React.createElement(
      'div',
      { className: 'an-sm__list' },
      filtered.length === 0
        ? React.createElement(
            'div',
            { className: 'an-sm__empty' },
            loading ? '加载中…' : keyword ? '无匹配对话' : '暂无对话，点击“新对话”开始'
          )
        : sections.map((sec) =>
            React.createElement(
              'div',
              { key: sec.label || '__search' },
              sec.label ? React.createElement('div', { className: 'an-sm__group' }, sec.label) : null,
              sec.items.map(renderItem)
            )
          )
    ),
    React.createElement(
      'div',
      { className: 'an-sm__foot' },
      React.createElement('span', { className: 'an-sm__avatar' }, 'A'),
      React.createElement('span', { className: 'an-sm__user' }, '洪荒')
    )
  );
};

exports['zifu.sessionManager'] = SessionManager;
