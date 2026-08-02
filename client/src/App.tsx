import React from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';


import { slots } from './config/slots';
import { TopBarModule } from './components/layout/topbar';
import { LoginModule } from './components/login';
import { LoginCommandsModule } from './commands/login';
import { UserModule } from './components/user';
import { OpencodeCommandsModule, installOpencodeClient, installRuntimeAutoActivate } from './commands/opencode';
import { FsCommandsModule, installFsApi, bindFsSync } from './commands/fs';
import { AiModule } from './components/ai';
import { AiCommandsModule } from './commands/ai';
import { RightBarModule, BottomModule } from './components/layout';
import { preferences } from './config/preferences';
import { runtimeConfig } from './config/runtime';
import './styles/overrides.css';

// App 渲染前手动装 runtime 拉取 + SDK 监听 + fs API + 沙箱读写同步 (BrowserModule.onDidStart 钩子时序不可靠)
installRuntimeAutoActivate();
installOpencodeClient();
installFsApi();
bindFsSync();

/**
 * 框架级 chrome 注册 — 内置 Module 注入
 *
 * 业务能力全部在 commands/ 目录按工具集分组维护 (commands/opencode SDK 封装 +
 * runtime 拉取; commands/fs 文件 IO; commands/login 登录会话):
 *   - OpencodeCommandsModule (@Domain(ClientAppContribution)) 装 runtime 拉取 + SDK 监听
 *   - FsCommandsModule      (@Domain(CommandContribution))       注册 taichu.fs.* commands
 *   - LoginCommandsModule   (@Domain(CommandContribution))       注册 taichu.login.session.* commands
 *   - LoginModule            (@Domain(ComponentContribution))     注册 'login-default' view
 *   - UserModule             (@Domain(ComponentContribution))     注册 'user-default' view
 *   - TopBarModule / BottomModule / RightBarModule              IDE 框架容器
 *
 * layout.tsx 的 LayoutComponent 用 <SlotRenderer slot="login|userPage"> 渲染 webview,
 * <SandboxLoading /> 渲染沙箱启动 loading.
 *
 * 业务 VSIX 通过 contributes.views + viewsContainers 注册自定义 view container
 * 替换默认 webview (铁律 12); 通过 window.__TAICHU_OPENCODE__ / window.__TAICHU_LOGIN_API__
 * / window.__TAICHU_FS_API__ 跨拓展能力.
 */

export const App: React.FC = () => {
  return (
    <AppRenderer
      appConfig={{
        ...slots,
        defaultPreferences: preferences,
        modules: [
          TopBarModule,
          LoginModule,
          LoginCommandsModule,
          UserModule,
          OpencodeCommandsModule,
          FsCommandsModule,
          AiModule,
          AiCommandsModule,
          BottomModule,
          RightBarModule,
        ],
      }}
      runtimeConfig={runtimeConfig as any}
    />
  );
};