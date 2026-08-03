import React, { useState, useEffect, useRef } from 'react';

/**
 * ToastView — 全局轻提示 (extensions/toast/)
 *
 * 监听 'taichu:gate-hint' 事件 (detail.text), fixed 底部居中显示 2s.
 * 用于 explorer 登录门禁等场景的轻提示 (不打断操作, 不跳登录).
 */
export const ToastView: React.FC = () => {
  const [text, setText] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onHint = (e: Event) => {
      const text = (e as CustomEvent).detail?.text;
      if (!text) return;
      setText(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setText(''), 2000);
    };
    window.addEventListener('taichu:gate-hint', onHint);
    return () => {
      window.removeEventListener('taichu:gate-hint', onHint);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!text) {
    // 不 return null: 槽位容器空时会占位撑高 root, 始终渲染 tc-toast-root
    return <div className="tc-toast-root" style={{ height: 0, overflow: 'hidden' }} />;
  }

  return (
    <div
      className="tc-toast-root"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        background: 'rgba(30,30,35,0.95)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '8px 16px',
        color: 'var(--foreground, #e5e7eb)',
        fontSize: 13,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        userSelect: 'none',
      }}
    >
      {text}
    </div>
  );
};
