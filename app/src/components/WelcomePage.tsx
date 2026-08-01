import React, { useEffect, useState } from 'react';

type LandingComponent = React.ComponentType<unknown> | null;

/**
 * Taichu 欢迎页 - 薄壳
 *
 * 框架仅提供"无文件时主编辑区"的占位 slot。本组件本身不渲染任何业务 UI;
 * 真正内容由业务 VSIX(默认实现: taichu-landing-page)通过
 * `window.__TAICHU_LANDING__` 全局注册,VSIX activate 后通知本组件重新渲染。
 *
 * 流程:
 *   1. CodeBlitz 在编辑器空态时挂载本组件
 *   2. 本组件检查 window.__TAICHU_LANDING__; 命中则渲染,否则显示最小 placeholder
 *   3. 业务 VSIX 在 activate 时注册组件, 通过 'taichu:landing-registered' 事件通知
 *   4. 本组件订阅事件后切换渲染分支
 *
 * 文件 IO / Agent API 都由 VSIX 处理 (VSIX 通过全局 command 与 app 通信)。
 */
export const WelcomePage: React.FC = () => {
  const [Landing, setLanding] = useState<LandingComponent>(
    () => (window as any).__TAICHU_LANDING__ ?? null,
  );

  useEffect(() => {
    const onRegistered = () => {
      const next = (window as any).__TAICHU_LANDING__ ?? null;
      setLanding(() => next);
    };
    window.addEventListener('taichu:landing-registered', onRegistered);
    // 兜底: 已注册但事件漏掉的情况
    const existing = (window as any).__TAICHU_LANDING__ ?? null;
    if (existing && existing !== Landing) setLanding(() => existing);
    return () => window.removeEventListener('taichu:landing-registered', onRegistered);
  }, []);

  if (Landing) {
    const Comp = Landing as React.ComponentType<unknown>;
    return React.createElement(Comp);
  }

  // 极简 placeholder: 无 VSIX 注册时, 提示用户安装/加载扩展。
  return React.createElement(
    'div',
    {
      className: 'app-welcome-empty',
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        color: 'var(--descriptionForeground, #8b929b)',
        fontSize: 13,
        userSelect: 'none',
        gap: 8,
      },
    },
    React.createElement('div', { style: { fontSize: 18, color: 'var(--foreground, #e5e7eb)', fontWeight: 600 } }, '太初'),
    React.createElement('div', null, '等待业务扩展加载...'),
  );
};
