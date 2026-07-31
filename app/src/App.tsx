import React, { useEffect, useState } from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { ExtensionService } from '@opensumi/ide-extension';

import { appConfig, runtimeConfig } from './config/codeblitz.config';
import { ExtensionRegistryClient } from './services/registry';
import { resolveRuntime } from './config/bootstrap';
import { setRuntimeConfig, type RuntimeConfig } from './config/runtime';
import './styles/overrides.css';

const REGISTRY_URL = process.env.EXTENSION_REGISTRY_URL || 'https://localhost:9000';

const registryClient = new ExtensionRegistryClient(REGISTRY_URL);

const LOADING_STYLE_ID = 'taichu-bootstrap-loading-style';
const LOADING_CSS = `
.tc-loading { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; background:#0b0d10; color:#e5e7eb; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; z-index:9999; }
.tc-loading__logo { width:56px; height:56px; border-radius:14px; background:linear-gradient(135deg,#8b5cf6,#6366f1); display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; font-weight:700; box-shadow:0 6px 24px rgba(99,102,241,.45); }
.tc-loading__title { font-size:18px; font-weight:600; letter-spacing:.02em; }
.tc-loading__msg { font-size:13px; color:#9ca3af; max-width:420px; text-align:center; line-height:1.6; }
.tc-loading__bar { width:240px; height:3px; border-radius:2px; background:#1f2937; overflow:hidden; }
.tc-loading__bar > span { display:block; height:100%; width:40%; background:linear-gradient(90deg,#8b5cf6,#6366f1); border-radius:2px; animation:tc-loading-slide 1.2s ease-in-out infinite; }
@keyframes tc-loading-slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
.tc-loading__err { margin-top:8px; padding:10px 14px; border-radius:8px; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.4); color:#fca5a5; font-size:12px; max-width:520px; text-align:left; }
`;

function injectLoadingStyle() {
  if (document.getElementById(LOADING_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = LOADING_STYLE_ID;
  el.textContent = LOADING_CSS;
  document.head.appendChild(el);
}

function LoadingView({ message, error }: { message: string; error?: string }) {
  injectLoadingStyle();
  return (
    <div className="tc-loading">
      <div className="tc-loading__logo">T</div>
      <div className="tc-loading__title">Taichu</div>
      <div className="tc-loading__msg">{message}</div>
      {!error && <div className="tc-loading__bar"><span /></div>}
      {error && <div className="tc-loading__err">{error}</div>}
    </div>
  );
}

export const App: React.FC = () => {
  const [extensionMetadata, setExtensionMetadata] = useState<any[] | null>(null);
  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null);
  const [bootstrapMsg, setBootstrapMsg] = useState<string>('正在初始化…');
  const [bootstrapError, setBootstrapError] = useState<string>('');

  useEffect(() => {
    registryClient
      .fetchMetadata()
      .then(setExtensionMetadata)
      .catch((error) => {
        console.error('[Taichu] 拉取扩展清单失败，将以零扩展启动', error);
        setExtensionMetadata([]);
      });
    resolveRuntime((msg) => setBootstrapMsg(msg))
      .then((r) => {
        if (!r.ready) {
          setBootstrapError(
            'sandbox 启动超时（90s）。请稍后刷新页面，或检查 gateway / agent-image 集群状态。',
          );
        }
        setRuntimeConfig(r);
        setRuntime(r);
      })
      .catch((err) => {
        const msg = String((err as Error)?.message || err);
        setBootstrapError(`bootstrap 失败: ${msg}`);
        setRuntime(null);
      });
  }, []);

  // 暴露给扩展 component（chat-window / session-manager / app 内部 client）共用。
  if (runtime) {
    (window as any).__TAICHU_RUNTIME__ = runtime;
  }

  if (extensionMetadata === null || runtime === null) {
    return <LoadingView message={bootstrapMsg} error={bootstrapError || undefined} />;
  }

  return (
    <AppRenderer
      appConfig={{ ...appConfig, extensionMetadata }}
      runtimeConfig={runtimeConfig}
      onLoad={(app) => {
        try {
          const injector: any = (app as any).injector;
          const layoutService: any = injector.get(IMainLayoutService);
          const extensionService: any = injector.get(ExtensionService);
          const SESSION_CONTAINER = 'taichu.taichu-session-manager:sessionManager';
          const CHAT_CONTAINER = 'taichu.taichu-chat-window:chatWindow';

          const activateSession = () => {
            const leftTabbar = layoutService?.getTabbarService?.('left');
            leftTabbar?.updateCurrentContainerId?.(SESSION_CONTAINER);
            layoutService?.toggleSlot?.('left', true, 280);
            const rightTabbar = layoutService?.getTabbarService?.('right');
            rightTabbar?.updateCurrentContainerId?.(CHAT_CONTAINER);
            layoutService?.toggleSlot?.('right', true, 420);
            window.dispatchEvent(new CustomEvent('app:extensions-ready'));
          };

          const ready = Promise.all([
            layoutService?.viewReady?.promise,
            extensionService?.eagerExtensionsActivated?.promise,
          ]);
          ready.then(activateSession).catch((err) => {
            console.warn('[Taichu] 等待扩展激活失败，直接激活布局', err);
            activateSession();
          });

          const revealChat = () => {
            try {
              const tabbar = layoutService?.getTabbarService?.('right');
              tabbar?.updateCurrentContainerId?.(CHAT_CONTAINER);
              layoutService?.toggleSlot?.('right', true, 420);
            } catch (err) {
              console.warn('[Taichu] 展开右侧对话面板失败', err);
            }
          };
          window.addEventListener('app:session-changed', revealChat);
        } catch (error) {
          console.warn('[Taichu] 初始化布局钩子失败', error);
        }
      }}
    />
  );
};
