/**
 * Registry 客户端 — commands/registry/
 *
 * 启动期拉取业务 VSIX 元数据清单 (registry /metadata.json),
 * 填充 runtimeConfig.extensionMetadata (CodeBlitz 扩展元数据),
 * 由 CodeBlitz 动态安装 VSIX (业务拓展: paper / chat-window / landing-page 等).
 */

declare const process: { env: Record<string, string | undefined> };

function getRegistryUrl(): string {
  return (
    process.env.REGISTRY_URL ||
    (window as any).__TAICHU_REGISTRY_URL__ ||
    'http://registry.taichu.localhost'
  );
}

export async function fetchRegistryMetadata(): Promise<any[]> {
  const url = getRegistryUrl().replace(/\/$/, '') + '/metadata.json';
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`registry metadata fetch failed: ${res.status} ${url}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

/** 拉取 registry 元数据并填充 window 全局 (供 config/runtime 引用) */
export async function installRegistryMetadata(): Promise<any[]> {
  try {
    const metadata = await fetchRegistryMetadata();
    (window as any).__TAICHU_REGISTRY_METADATA__ = metadata;
    return metadata;
  } catch (e) {
    console.warn('[registry] metadata fetch failed:', (e as Error)?.message || e);
    (window as any).__TAICHU_REGISTRY_METADATA__ = [];
    return [];
  }
}
