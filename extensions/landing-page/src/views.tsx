// 通过 window 全局读取 host 端 (app/index.tsx) 注入的 React + ReactDOM，
// 避免 CodeBlitz requireInterceptor 对 'react' 返回 undefined 导致 hooks 报 null。
// React 由 CodeBlitz 注入时机晚于 views.js 模块执行, 必须轮询直到 window.React 可用
// 才执行依赖 React 的 hooks 解构 / 全局注册; 否则 require_views() 会在扩展.ts 阶段抛错。
let React: any = (window as any).React;
let useEffect: any;
function bindReact() {
  if (React && React.useEffect) return true;
  React = (window as any).React;
  if (!React) return false;
  useEffect = React.useEffect;
  return true;
}
// 立即尝试一次 (OpenSumi 加载浏览器主入口时 window.React 多半已就绪)
if (bindReact()) {
  // OK
} else {
  // 延后到 React 可用再继续: 轮询 50ms / 200 次 (10 秒)
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (bindReact()) {
      clearInterval(timer);
      registerGlobals();
    } else if (attempts >= 200) {
      clearInterval(timer);
      console.warn('>>>[landing-page][views] gave up waiting for window.React');
    }
  }, 50);
}

const CSS = `
.tc-lp { display:flex; align-items:center; justify-content:center; height:100%; width:100%; box-sizing:border-box; background:radial-gradient(ellipse at 65% 35%, rgba(112,130,200,.10) 0%, transparent 55%), radial-gradient(ellipse at 25% 75%, rgba(60,80,130,.10) 0%, transparent 55%), linear-gradient(180deg, #0f131a 0%, #0a0d12 100%); color:var(--foreground, #e5e7eb); font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; user-select:none; overflow-y:auto; padding:48px 24px; }
.tc-lp__inner { display:flex; flex-direction:column; gap:48px; width:100%; max-width:620px; position:relative; z-index:1; }
.tc-lp__title-row { display:flex; flex-direction:column; gap:8px; }
.tc-lp__title { font-size:22px; font-weight:600; letter-spacing:.01em; }
.tc-lp__sub { font-size:13px; color:var(--descriptionForeground, #8b929b); line-height:1.6; }
.tc-lp__actions { display:flex; flex-direction:column; gap:10px; }
.tc-lp__action { display:flex; align-items:center; gap:14px; padding:14px 18px; border-radius:10px; background:rgba(20,24,32,.7); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,.05); color:var(--foreground); font-size:14px; cursor:pointer; transition:background .15s, border-color .15s, transform .15s; text-align:left; }
.tc-lp__action:hover { background:rgba(36,42,56,.85); border-color:rgba(139,158,220,.35); }
.tc-lp__action:active { transform:translateY(1px); }
.tc-lp__icon { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; background:rgba(99,102,241,.12); color:#a5b4fc; flex-shrink:0; }
.tc-lp__text { display:flex; flex-direction:column; gap:2px; }
.tc-lp__action-title { font-weight:500; }
.tc-lp__action-sub { font-size:12px; color:var(--descriptionForeground, #8b929b); }
.tc-lp__recents { display:flex; flex-direction:column; gap:4px; }
.tc-lp__recent { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:6px; cursor:pointer; font-size:13px; transition:background .15s; }
.tc-lp__recent:hover { background:rgba(255,255,255,.04); }
.tc-lp__recent-icon { width:18px; height:18px; color:#c9b88d; opacity:.9; flex-shrink:0; }
.tc-lp__recent-name { color:var(--foreground); }
.tc-lp__recent-path { margin-left:auto; color:var(--descriptionForeground, #8b929b); font-size:12px; }
.tc-lp__hint { font-size:11px; color:var(--descriptionForeground, #8b929b); opacity:.7; text-align:center; margin-top:8px; }
`;

function useInjectStyle() {
  useEffect(() => {
    if (document.getElementById('tc-lp-style')) return;
    const el = document.createElement('style');
    el.id = 'tc-lp-style';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const ACTIONS = [
  {
    key: 'openFolder',
    title: '打开文件夹',
    sub: '在本地浏览已克隆的项目',
    icon: (
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round' }),
        React.createElement('path', { d: 'M3 9.5h18', stroke: 'currentColor', strokeWidth: 1.4 }),
      )
    ),
  },
  {
    key: 'newProject',
    title: '新建项目',
    sub: '从模板创建一个新工作区',
    icon: (
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('path', { d: 'M12 4v16M4 12h16', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
      )
    ),
  },
  {
    key: 'cloneGit',
    title: '克隆 Git 仓库',
    sub: '拉取远程仓库到本地工作区',
    icon: (
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('circle', { cx: 6, cy: 6, r: 2, stroke: 'currentColor', strokeWidth: 1.4 }),
        React.createElement('circle', { cx: 6, cy: 18, r: 2, stroke: 'currentColor', strokeWidth: 1.4 }),
        React.createElement('circle', { cx: 18, cy: 12, r: 2, stroke: 'currentColor', strokeWidth: 1.4 }),
        React.createElement('path', { d: 'M6 8v8M8 6h6a4 4 0 0 1 4 4v0', stroke: 'currentColor', strokeWidth: 1.4 }),
      )
    ),
  },
  {
    key: 'remoteHost',
    title: '连接远程主机',
    sub: '通过 SSH 在远端打开工作区',
    icon: (
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('rect', { x: 3, y: 5, width: 18, height: 11, rx: 2, stroke: 'currentColor', strokeWidth: 1.4 }),
        React.createElement('path', { d: 'M8 20h8M12 16v4', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
      )
    ),
  },
  {
    key: 'newFile',
    title: '新建文件',
    sub: '在工作区里直接创建一个空文件',
    icon: (
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('path', { d: 'M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-7-5z', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round' }),
        React.createElement('path', { d: 'M13 3v5h7M12 13v6M9 16h6', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
      )
    ),
  },
];

// 最近项目示例 (本扩展不直连 Agent API / fs; 占位文案由后续 VSIX 替换为真实数据)
const RECENTS = [
  { name: '水下机器人项目', path: '~/Documents' },
  { name: '开源项目', path: '~/Documents' },
  { name: 'studio', path: '~/Documents' },
  { name: '日常工作', path: '~/Documents' },
];

function onAction(key: string) {
  // 派发全局 CustomEvent, 给 app 接走 (file dialog / 跳转其它模块等)
  window.dispatchEvent(
    new CustomEvent('taichu:landing-action', { detail: { key } }),
  );
  // 同步触发同名 VSIX command, 给后续激活的 VSIX 一个接管钩子
  void (window as any).__TAICHU_RUNTIME__?.dispatchCommand?.(
    `taichu.landing.${key}`,
  );
}

function onRecent(name: string) {
  window.dispatchEvent(
    new CustomEvent('taichu:landing-recent', { detail: { name } }),
  );
}

const FolderIcon = () =>
  React.createElement(
    'svg',
    { className: 'tc-lp__recent-icon', viewBox: '0 0 24 24', fill: 'none' },
    React.createElement('path', {
      d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinejoin: 'round',
    }),
  );

const LandingPage = () => {
  useInjectStyle();
  return React.createElement(
    'div',
    { className: 'tc-lp' },
    React.createElement(
      'div',
      { className: 'tc-lp__inner' },
      React.createElement(
        'div',
        { className: 'tc-lp__title-row' },
        React.createElement('div', { className: 'tc-lp__title' }, '开始'),
        React.createElement(
          'div',
          { className: 'tc-lp__sub' },
          '打开一个文件夹、克隆一个仓库、或者直接新建一个文件',
        ),
      ),
      React.createElement(
        'div',
        { className: 'tc-lp__actions' },
        ACTIONS.map((a) =>
          React.createElement(
            'button',
            {
              key: a.key,
              className: 'tc-lp__action',
              onClick: () => onAction(a.key),
            },
            React.createElement('span', { className: 'tc-lp__icon' }, a.icon),
            React.createElement(
              'span',
              { className: 'tc-lp__text' },
              React.createElement(
                'span',
                { className: 'tc-lp__action-title' },
                a.title,
              ),
              React.createElement(
                'span',
                { className: 'tc-lp__action-sub' },
                a.sub,
              ),
            ),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'tc-lp__recents' },
        RECENTS.map((r) =>
          React.createElement(
            'div',
            {
              key: r.name,
              className: 'tc-lp__recent',
              onClick: () => onRecent(r.name),
            },
            React.createElement(FolderIcon, null),
            React.createElement(
              'span',
              { className: 'tc-lp__recent-name' },
              r.name,
            ),
            React.createElement(
              'span',
              { className: 'tc-lp__recent-path' },
              r.path,
            ),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'tc-lp__hint' },
        '所有 IO 派发为全局 command，由 app 或其他 VSIX 接走',
      ),
    ),
  );
};

exports['taichuLanding'] = LandingPage;

// 同时挂一个全局工厂, 让 app/src WelcomePage 薄壳可以拉到这个组件;
// VSIX 的 extension.ts activate() 会把这个工厂搬到 window.__TAICHU_LANDING__
// 仅在 React 可用后才注册 (避免扩展.ts 早期调用时 window.React undefined)
function registerGlobals() {
  window.__tcLandingFactory = (props: any) => LandingPage(props);
  window.__TAICHU_LANDING_COMPONENT__ = LandingPage;
  window.dispatchEvent(new CustomEvent('taichu:landing-component-ready'));
  console.log('>>>[landing-page][views] registered __TAICHU_LANDING_COMPONENT__');
}
if (React && useEffect) {
  registerGlobals();
}
