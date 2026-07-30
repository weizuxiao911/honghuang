import React from 'react';

/**
 * 洪荒顶部标题栏
 * 抄 Trae 风格：左 IDE 标识 + 工作区下拉 + 搜索；右版本/导航/布局/设置/账户。
 * 渲染于 zifu 自定义 LayoutComponent 的 top slot。
 */
export const TopBar: React.FC = () => {
  const [workspaceOpen, setWorkspaceOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const workspaceLabel = 'studio';

  return (
    <div className="zifu-topbar">
      <style>{`
        .zifu-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 36px;
          padding: 0 10px;
          background: var(--menubar-background, #1a1c20);
          color: var(--foreground);
          font-size: 12px;
          user-select: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .zifu-topbar__left, .zifu-topbar__right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .zifu-topbar__brand {
          width: 32px;
          height: 22px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }
        .zifu-topbar__sep {
          width: 1px;
          height: 16px;
          background: rgba(255, 255, 255, 0.08);
          margin: 0 2px;
        }
        .zifu-topbar__workspace {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 24px;
          padding: 0 8px;
          border-radius: 5px;
          cursor: pointer;
          color: var(--foreground);
        }
        .zifu-topbar__workspace:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .zifu-topbar__workspace svg {
          opacity: 0.6;
        }
        .zifu-topbar__search {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 24px;
          padding: 0 8px;
          width: 220px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid transparent;
          color: var(--input-foreground, var(--foreground));
        }
        .zifu-topbar__search:focus-within {
          border-color: var(--focusBorder);
        }
        .zifu-topbar__search input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          color: inherit;
          font: inherit;
        }
        .zifu-topbar__search input::placeholder {
          color: var(--input-placeholderForeground);
        }
        .zifu-topbar__search svg {
          color: var(--input-placeholderForeground);
        }
        .zifu-topbar__pro {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 24px;
          padding: 0 10px;
          border-radius: 12px;
          background: rgba(16, 163, 127, 0.12);
          color: #20c997;
          font-size: 11px;
          cursor: pointer;
        }
        .zifu-topbar__pro:hover {
          background: rgba(16, 163, 127, 0.2);
        }
        .zifu-topbar__btn {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: var(--descriptionForeground);
          cursor: pointer;
        }
        .zifu-topbar__btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--foreground);
        }
        .zifu-topbar__divider {
          width: 1px;
          height: 16px;
          background: rgba(255, 255, 255, 0.08);
          margin: 0 2px;
        }
        .zifu-topbar__avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fb923c, #f43f5e);
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .zifu-topbar__avatar::after {
          content: '';
          position: absolute;
          right: -2px;
          bottom: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid var(--menubar-background, #1a1c20);
        }
      `}</style>
      <div className="zifu-topbar__left">
        <div className="zifu-topbar__brand" title="IDE">洪</div>
        <div className="zifu-topbar__sep" />
        <div
          className="zifu-topbar__workspace"
          onClick={() => setWorkspaceOpen((v) => !v)}
          title="切换工作区"
        >
          <span>{workspaceLabel}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <label className="zifu-topbar__search">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5.5" cy="5.5" r="3.8" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            placeholder="搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="zifu-topbar__right">
        <span className="zifu-topbar__pro" title="升级到 Pro">
          升级到 Pro
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2 6L6 2M6 2H3.5M6 2V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="zifu-topbar__btn" title="后退">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L4 7L9 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="zifu-topbar__btn" title="前进">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L10 7L5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="zifu-topbar__divider" />
        <div className="zifu-topbar__btn" title="拆分编辑器">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="3" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="8" y="3" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="zifu-topbar__btn" title="布局控制">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <line x1="5" y1="2" x2="5" y2="12" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="zifu-topbar__divider" />
        <div className="zifu-topbar__btn" title="设置">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M7 1.5V3M7 11V12.5M12.5 7H11M3 7H1.5M11.3 2.7L10.2 3.8M3.8 10.2L2.7 11.3M11.3 11.3L10.2 10.2M3.8 3.8L2.7 2.7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="zifu-topbar__avatar" title="账户">Y</div>
      </div>
    </div>
  );
};