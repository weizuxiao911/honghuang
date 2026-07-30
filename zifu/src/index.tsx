import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

// 预置一次布局状态，绕开 CodeBlitz `fixLayout` 把 undefined size 折成 ''、令 defaultPanels 失效的 bug。
// 用户后续拖动或折叠会覆盖此值；只有当 localStorage 完全没记录时才注入。
if (!localStorage.getItem('layout')) {
  localStorage.setItem(
    'layout',
    JSON.stringify({
      left: { currentId: 'honghuang.zifu-session-manager:zifu.sessionManager', size: 280 },
      right: { currentId: 'honghuang.zifu-chat-window:zifu.chatWindow', size: 420 },
      bottom: { currentId: '', size: 0 },
    })
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

ReactDOM.createRoot(container).render(<App />);

