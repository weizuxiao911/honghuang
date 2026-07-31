import React, { useEffect, useState } from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { ExtensionService } from '@opensumi/ide-extension';

import { appConfig, runtimeConfig } from './config/codeblitz.config';
import { ExtensionRegistryClient } from './services/registry';
import './styles/overrides.css';

const REGISTRY_URL = process.env.EXTENSION_REGISTRY_URL || 'https://localhost:9000';

const registryClient = new ExtensionRegistryClient(REGISTRY_URL);

export const App: React.FC = () => {
  const [extensionMetadata, setExtensionMetadata] = useState<any[] | null>(null);

  useEffect(() => {
    registryClient
      .fetchMetadata()
      .then(setExtensionMetadata)
      .catch((error) => {
        console.error('[洪荒] 拉取扩展清单失败，将以零扩展启动', error);
        setExtensionMetadata([]);
      });
  }, []);

  if (extensionMetadata === null) {
    return null;
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
          const SESSION_CONTAINER = 'honghuang.zifu-session-manager:zifu.sessionManager';
          const CHAT_CONTAINER = 'honghuang.zifu-chat-window:zifu.chatWindow';

          const activateSession = () => {
            const leftTabbar = layoutService?.getTabbarService?.('left');
            leftTabbar?.updateCurrentContainerId?.(SESSION_CONTAINER);
            layoutService?.toggleSlot?.('left', true, 280);
            const rightTabbar = layoutService?.getTabbarService?.('right');
            rightTabbar?.updateCurrentContainerId?.(CHAT_CONTAINER);
            layoutService?.toggleSlot?.('right', true, 420);
            // 通知视图：扩展已就绪，可以重新拉数据。
            window.dispatchEvent(new CustomEvent('zifu:extensions-ready'));
          };

          // 等：布局视图注册完 + 扩展全部激活完，再触发默认展开与刷新。
          const ready = Promise.all([
            layoutService?.viewReady?.promise,
            extensionService?.eagerExtensionsActivated?.promise,
          ]);
          ready.then(activateSession).catch((err) => {
            console.warn('[洪荒] 等待扩展激活失败，直接激活布局', err);
            activateSession();
          });

          // 事件桥：session-manager 点选/新建会话 → 展开右侧 chat panel。
          const revealChat = () => {
            try {
              const tabbar = layoutService?.getTabbarService?.('right');
              tabbar?.updateCurrentContainerId?.(CHAT_CONTAINER);
              layoutService?.toggleSlot?.('right', true, 420);
            } catch (err) {
              console.warn('[洪荒] 展开右侧对话面板失败', err);
            }
          };
          window.addEventListener('zifu:session-changed', revealChat);
        } catch (error) {
          console.warn('[洪荒] 初始化布局钩子失败', error);
        }
      }}
    />
  );
};
