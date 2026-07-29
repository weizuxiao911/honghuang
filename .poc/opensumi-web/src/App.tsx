import React, { useEffect, useState } from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';

import { appConfig, runtimeConfig } from './config/codeblitz.config';
import { ExtensionRegistryClient } from './services/registry';

const REGISTRY_URL = process.env.EXTENSION_REGISTRY_URL || 'https://localhost:9000';

const registryClient = new ExtensionRegistryClient(REGISTRY_URL);

export const App: React.FC = () => {
  const [extensionMetadata, setExtensionMetadata] = useState<any[] | null>(null);

  useEffect(() => {
    registryClient
      .fetchMetadata()
      .then(setExtensionMetadata)
      .catch((error) => {
        console.error('[AgentNest] 拉取扩展清单失败，将以零扩展启动', error);
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
    />
  );
};
