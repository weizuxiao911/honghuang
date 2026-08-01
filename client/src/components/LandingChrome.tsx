import React from 'react';

import '../styles/landing.css';

/**
 * Taichu main area landing layout chrome
 *
 * 仅提供 Trae 风格布局骨架与 spacing:
 *   - 居中深色渐变背景
 *   - 5 颗动作按钮(纵向堆叠, gap 10px)
 *   - 4 行最近项目(纵向堆叠, gap 4px)
 *
 * 不写业务内容(无图片 / 无数据 / 无点击行为), 实际内容由调用方传入或由 VSIX 替换
 */
const DEFAULT_ACTIONS = [
  { key: 'openFolder', title: '打开文件夹', sub: '在本地浏览已克隆的项目' },
  { key: 'newProject', title: '新建项目', sub: '从模板创建一个新工作区' },
  { key: 'cloneGit', title: '克隆 Git 仓库', sub: '拉取远程仓库到本地工作区' },
  { key: 'remoteHost', title: '连接远程主机', sub: '通过 SSH 在远端打开工作区' },
  { key: 'newFile', title: '新建文件', sub: '在工作区里直接创建一个空文件' },
];

const DEFAULT_RECENTS = [
  { name: '产品设计', path: '~/Documents' },
  { name: '水下机器人项目', path: '~/Documents' },
  { name: '开源项目', path: '~/Documents' },
  { name: 'studio', path: '~/Documents' },
];

function ActionIcon({ name }: { name: string }) {
  const size = 20;
  switch (name) {
    case 'openFolder':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'newProject':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'cloneGit':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="18" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 8v8M8 6h6a4 4 0 0 1 4 4v0" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'remoteHost':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'newFile':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-7-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M13 3v5h7M12 13v6M9 16h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const LandingChrome: React.FC = () => {
  return (
    <div className="tc-landing">
      <div className="tc-landing__inner">
        <div className="tc-landing__actions">
          {DEFAULT_ACTIONS.map((a) => (
            <button key={a.key} className="tc-landing__action" type="button">
              <span className="tc-landing__action-icon">
                <ActionIcon name={a.key} />
              </span>
              <span className="tc-landing__action-text">
                <span className="tc-landing__action-title">{a.title}</span>
                <span className="tc-landing__action-sub">{a.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="tc-landing__recents">
          {DEFAULT_RECENTS.map((r) => (
            <div key={r.name} className="tc-landing__recent">
              <span className="tc-landing__recent-icon">
                <FolderIcon />
              </span>
              <span className="tc-landing__recent-name">{r.name}</span>
              <span className="tc-landing__recent-path">{r.path}</span>
            </div>
          ))}
        </div>
        <div className="tc-landing__hint">
          client 框架默认空态内容 · 业务能力由 VSIX 通过 contributes.views 注入
        </div>
      </div>
    </div>
  );
};
