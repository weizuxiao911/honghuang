import React, { useState, useEffect } from 'react';
import { SlotLocation } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';
import { readSession } from '../../commands/login/api';

/**
 * ActionsView — top 横条右侧 action 区 (extensions/actions/)
 *
 * 3 个布局 toggle (折叠左侧栏/底部栏/右侧栏) + 登录/账号按钮.
 * 无品牌 logo (用户要求去掉).
 */
export const ActionsView: React.FC = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const [leftVisible, setLeftVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  // 订阅三个 slot 的面板状态 (toggle 按钮 / 拖拽折叠都会触发)
  useEffect(() => {
    const sync = (slot: string, setter: (v: boolean) => void) => () => {
      setter(layoutService.isVisible(slot));
    };
    const slots = [
      { slot: SlotLocation.left, setter: setLeftVisible },
      { slot: SlotLocation.right, setter: setRightVisible },
      { slot: SlotLocation.bottom, setter: setBottomVisible },
    ];
    const disposables: { dispose(): void }[] = [];
    slots.forEach(({ slot, setter }) => {
      const service = layoutService.getTabbarService(slot);
      const syncFn = sync(slot, setter);
      syncFn();
      disposables.push(service.onCurrentChange(syncFn));
      disposables.push(service.onSizeChange(syncFn));
    });
    return () => disposables.forEach((d) => d.dispose());
  }, [layoutService]);

  // 监听登录状态变化
  useEffect(() => {
    const update = () => {
      const session = readSession();
      setLoggedIn(!!session?.userId);
      setUsername(session?.username || session?.userId || '');
    };
    update();
    window.addEventListener('taichu:login-session-changed', update);
    return () => window.removeEventListener('taichu:login-session-changed', update);
  }, []);

  const toggleLeft = () => {
    setLeftVisible((v) => !v);
    layoutService.toggleSlot(SlotLocation.left);
  };
  const toggleBottom = () => {
    setBottomVisible((v) => !v);
    layoutService.toggleSlot(SlotLocation.bottom);
  };
  const toggleRight = () => {
    setRightVisible((v) => !v);
    layoutService.toggleSlot(SlotLocation.right);
  };
  const showLogin = () => window.dispatchEvent(new CustomEvent('taichu:login-show'));
  const showUser = () => window.dispatchEvent(new CustomEvent('taichu:user-show'));

  const iconBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    color: 'var(--foreground, #e5e7eb)',
    cursor: 'pointer',
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const LeftIcon = ({ filled }: { filled: boolean }) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      {filled ? <rect x="3" y="4" width="6" height="16" fill="currentColor" stroke="none" /> : <line x1="9" y1="4" x2="9" y2="20" />}
    </svg>
  );
  const BottomIcon = ({ filled }: { filled: boolean }) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      {filled ? <rect x="3" y="16" width="18" height="4" fill="currentColor" stroke="none" /> : <line x1="3" y1="16" x2="21" y2="16" />}
    </svg>
  );
  const RightIcon = ({ filled }: { filled: boolean }) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      {filled ? <rect x="15" y="4" width="6" height="16" fill="currentColor" stroke="none" /> : <line x1="15" y1="4" x2="15" y2="20" />}
    </svg>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, width: '100%', height: '100%', padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <button type="button" title={leftVisible ? '折叠左侧栏' : '展开左侧栏'} onClick={toggleLeft} style={iconBtnStyle}>
        <LeftIcon filled={leftVisible} />
      </button>
      <button type="button" title={bottomVisible ? '折叠底部栏' : '展开底部栏'} onClick={toggleBottom} style={iconBtnStyle}>
        <BottomIcon filled={bottomVisible} />
      </button>
      <button type="button" title={rightVisible ? '折叠右侧栏' : '展开右侧栏'} onClick={toggleRight} style={iconBtnStyle}>
        <RightIcon filled={rightVisible} />
      </button>

      {loggedIn ? (
        <button type="button" title={username} onClick={showUser} style={{ marginLeft: 8, width: 22, height: 22, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
          {username ? username.slice(0, 1).toUpperCase() : 'U'}
        </button>
      ) : (
        <button type="button" title="登录" onClick={showLogin} style={{ marginLeft: 8, width: 28, height: 28, background: 'transparent', border: 'none', color: 'var(--foreground, #e5e7eb)', cursor: 'pointer', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
            <path d="M10 8l-4 4 4 4" />
            <line x1="6" y1="12" x2="16" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
};
