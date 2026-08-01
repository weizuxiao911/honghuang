import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

// VSIX 扩展 component（OpenSumi sumiContributes.browserViews）需要 React + ReactDOM 全局可用。
// esbuild 把扩展的 React/ReactDOM external 掉，运行时通过 window 全局引用。
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;

// 预置一次布局状态，绕开 CodeBlitz `fixLayout` 把 undefined size 折成 ''、令 defaultPanels 失效的 bug。
// 用户后续拖动或折叠会覆盖此值；只有当 localStorage 完全没记录时才注入。
if (!localStorage.getItem('layout')) {
  localStorage.setItem(
    'layout',
    JSON.stringify({
      left: { currentId: 'taichu.taichu-session-manager:sessionManager', size: 280 },
      right: { currentId: 'taichu.taichu-chat-window:chatWindow', size: 420 },
      bottom: { currentId: '', size: 0 },
    })
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

ReactDOM.createRoot(container).render(<App />);

