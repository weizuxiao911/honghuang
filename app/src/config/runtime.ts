/**
 * Taichu 运行时配置
 *
 * 解析流程：app 启动时 resolveRuntime() 调 gateway 拿 runtimeId 注入
 * window.__TAICHU_RUNTIME__。扩展 component 通过 getRuntimeConfig() 读取。
 * 不在代码中写死任何 URL，按 deployEnv + gatewayUrl 推导。
 */
export type DeployEnv = 'dev' | 'staging' | 'prod';

export interface RuntimeConfig {
  /** 当前用户运行时实例 baseUrl（如 http://<runtimeId>.runtime.localhost） */
  baseUrl: string;
  /** gateway API baseUrl */
  gatewayUrl: string;
  /** 运行时 host 后缀 */
  runtimeHostSuffix: string;
  /** 用户 ID（来自 app 服务端注入的 __TAICHU_DEPLOY_CONFIG__） */
  userId?: string;
  /** 租户 ID */
  tenantId?: string;
  /** 当前 runtime 实例 ID（gateway 分配） */
  runtimeId?: string;
  /** sandbox 已就绪（/global/health 返回 healthy） */
  ready?: boolean;
}

declare global {
  interface Window {
    __TAICHU_RUNTIME__?: RuntimeConfig;
    React?: any;
    ReactDOM?: any;
  }
}

let cached: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (!cached) {
    cached = (typeof window !== 'undefined' && window.__TAICHU_RUNTIME__) || {
      baseUrl: '',
      gatewayUrl: '',
      runtimeHostSuffix: '',
    };
  }
  return cached;
}

export function setRuntimeConfig(config: RuntimeConfig): void {
  cached = config;
  if (typeof window !== 'undefined') {
    window.__TAICHU_RUNTIME__ = config;
  }
}
