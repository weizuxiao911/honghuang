import React, { useState, useEffect, useRef } from 'react';

/**
 * LoadingView — 沙箱加载 overlay (extensions/loading/)
 *
 * 登录后到沙箱 opencode 正常访问之间显示全屏 loading, 带读秒计时
 * (直观感知冷启动耗时):
 *   - 'taichu:fs-loading'     → 显示 + 开始计时
 *   - 'taichu:opencode-ready' → 隐藏 (探活通过, SDK 可访问)
 *   - 'taichu:fs-teardown'    → 隐藏 (登出/沙箱失效)
 */
export const LoadingView: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const onLoading = () => {
      setSeconds(0);
      setVisible(true);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    };
    const onReady = () => {
      setVisible(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    const onTeardown = () => {
      setVisible(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    window.addEventListener('taichu:fs-loading', onLoading);
    window.addEventListener('taichu:opencode-ready', onReady);
    window.addEventListener('taichu:fs-teardown', onTeardown);
    return () => {
      window.removeEventListener('taichu:fs-loading', onLoading);
      window.removeEventListener('taichu:opencode-ready', onReady);
      window.removeEventListener('taichu:fs-teardown', onTeardown);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!visible) {
    // 不 return null: 槽位容器空时会占位撑高 root (810×3), 始终渲染
    // tc-loading-root (CSS height:0), 显示时再撑开 fixed overlay
    return <div className="tc-loading-root" style={{ height: 0, overflow: 'hidden' }} />;
  }

  return (
    <div
      className="tc-loading-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(14,14,18,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--foreground, #e5e7eb)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: '#a5b4fc',
          borderRadius: '50%',
          animation: 'tc-loading-spin 0.8s linear infinite',
        }}
      />
      <style>{`
        @keyframes tc-loading-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ fontSize: 14, fontWeight: 600 }}>沙箱加载中</div>
      <div style={{ fontSize: 12, opacity: 0.5 }}>已等待 {seconds} 秒</div>
    </div>
  );
};
