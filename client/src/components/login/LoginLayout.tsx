import React, { useState, useEffect } from 'react';
import { SlotRenderer } from '@opensumi/ide-core-browser';

import { readSession } from './api';

/**
 * login 槽位 — full-screen overlay (操作触发时显示)
 *
 * 默认 hidden, 用户操作触发后显示 (例: 用户点击 ai-panel 的"新会话"按钮,
 * 但未登录, 触发 'taichu:login-show' 事件 → LoginLayout 显示).
 *
 * 触发 entry:
 *   - window.dispatchEvent(new CustomEvent('taichu:login-show')) 显示
 *   - window.dispatchEvent(new CustomEvent('taichu:login-hide')) 隐藏
 *   - 登录 session 写入后 (writeSession), LoginView 派发 'taichu:login-session-changed',
 *     LoginLayout 监听 → 自动隐藏
 *
 * 当前版本: 全屏覆盖, z-index 顶层. 后续可改为 modal 形式.
 */
export const LoginLayout: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showHandler = () => setVisible(true);
    const hideHandler = () => setVisible(false);
    const sessionHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        // 登录成功, 关闭 overlay
        setVisible(false);
      } else {
        // 登出, 也关闭 overlay
        setVisible(false);
      }
    };

    window.addEventListener('taichu:login-show', showHandler);
    window.addEventListener('taichu:login-hide', hideHandler);
    window.addEventListener('taichu:login-session-changed', sessionHandler);

    return () => {
      window.removeEventListener('taichu:login-show', showHandler);
      window.removeEventListener('taichu:login-hide', hideHandler);
      window.removeEventListener('taichu:login-session-changed', sessionHandler);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="tc-login-overlay">
      <SlotRenderer slot="login" />
    </div>
  );
};
