import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

// VSIX 兼容层: 业务 VSIX (如 taichu-landing-page) 通过 window.React 共享
// host 的 React 实例 (OpenSumi/CodeBlitz 扩展宿主约定), 不暴露会导致
// VSIX 组件里 useEffect 等为 undefined 崩溃
(window as any).React = React;

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

ReactDOM.createRoot(container).render(<App />);
