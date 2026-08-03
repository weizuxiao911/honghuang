import React from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';


import { slots } from './config/slots';
import { LoginCommandsModule } from './commands/login';
import { SandboxCommandsModule, installSandboxClient, installRuntimeAutoActivate } from './commands/sandbox';
import { FsCommandsModule, installFsApi, bindFsSync } from './commands/sandbox/fs';
import { TerminalModule } from './commands/sandbox/terminal';
import { TerminalNextModule } from '@opensumi/ide-terminal-next/lib/browser';
import { ExplorerGateModule } from './commands/explorer-gate';
import { LoginModule } from './extensions/login';
import { UserModule } from './extensions/user';
import { AssistantModule } from './extensions/assistant';
import { LoadingModule } from './extensions/loading';
import { ToastModule } from './extensions/toast';
import { ActionsModule } from './extensions/actions';
import { preferences } from './config/preferences';
import { runtimeConfig } from './config/runtime';
import './styles/overrides.css';

// App 渲染前手动装 runtime 拉取 + SDK 监听 + fs API + 沙箱读写同步 (BrowserModule.onDidStart 钩子时序不可靠)
installRuntimeAutoActivate();
installSandboxClient();
installFsApi();
bindFsSync();

export const App: React.FC = () => {
  return (
    <AppRenderer
      appConfig={{
        ...slots,
        defaultPreferences: preferences,
        modules: [
          LoginCommandsModule,
          SandboxCommandsModule,
          FsCommandsModule,
          ExplorerGateModule,
          TerminalNextModule,
          TerminalModule,
          LoginModule,
          UserModule,
          AssistantModule,
          LoadingModule,
          ToastModule,
          ActionsModule,
        ],
      }}
      runtimeConfig={runtimeConfig as any}
    />
  );
};