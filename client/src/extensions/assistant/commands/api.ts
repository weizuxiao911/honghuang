/**
 * ai api 共享底层 — commands/ai
 *
 * 前置: opencode SDK 实例 (commands/opencode) 已创建.
 * 本文件提供 AI 会话/消息的底层封装, 供 AiCommandsContribution + components/ai webview 复用.
 * 全部走 SDK client (v2, @opencode-ai/sdk/v2), 不直连 HTTP.
 *
 * v2 client 参数为平铺结构: SDK 的 buildClientParams 内部把 id/agent/model 等
 * 映射到 body, sessionID 等映射到 path.
 */

import { getOpencodeClient, isOpencodeReady } from '../../../commands/sandbox/client';

export function getAiClient() {
  return getOpencodeClient();
}

export function isAiReady(): boolean {
  return isOpencodeReady();
}

export function assertAiReady(): void {
  if (!isAiReady()) {
    throw new Error('opencode client not ready (sandbox 未激活, 登录后会自动激活)');
  }
}

/** 创建新会话 — v2.session.create({ agent?, model?, location? }) */
export async function aiCreateSession(title?: string): Promise<string> {
  assertAiReady();
  const client = getAiClient()!;
  const params: any = {};
  if (title) params.id = title;
  const { data, error } = await (client as any).session.create(params);
  if (error) throw error;
  if (!data?.id) throw new Error('session.create 未返回 id');
  return data.id;
}

/** 历史会话列表 — v2.session.list */
export async function aiListSessions(): Promise<any[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await (client as any).session.list();
  if (error) throw error;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).data)) return (data as any).data;
  return [];
}

/** 会话消息列表 — v2.session.messages({ sessionID }) */
export async function aiListMessages(sessionID: string): Promise<any[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await (client as any).session.messages({ sessionID });
  if (error) throw error;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).data)) return (data as any).data;
  if (data && Array.isArray((data as any).messages)) return (data as any).messages;
  return [];
}

/** 发送消息 — v2.session.prompt (fire-and-forget, 官方 TUI 同款);
 *  必须传 agent + model ({providerID, modelID}) + variant, 否则服务端 400 */
/** 发送消息 — client.session.prompt (v1 兼容, 官方 TUI + app 统一用此端点);
 *  agent/model/variant 全部可选, 传则服务端按指定 agent/model 处理
 *  textOrParts: 字符串 (纯文本) 或 parts 数组 (官方 file part 等多 part 提交) */
export async function aiSendMessage(
  sessionID: string,
  textOrParts: string | any[],
  agent?: string,
  model?: { providerID: string; modelID: string },
  variant?: string,
): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const parts: any[] = typeof textOrParts === 'string'
    ? [{ type: 'text', text: textOrParts }]
    : textOrParts;
  const params: any = { sessionID, parts };
  if (agent) params.agent = agent;
  if (model) params.model = model;
  if (variant) params.variant = variant;
  const { error } = await (client as any).session.prompt(params);
  if (error) throw error;
}

/** 中断当前会话 — v2.session.interrupt({ sessionID }) */
export async function aiAbort(sessionID: string): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await (client as any).session.abort({ sessionID });
  if (error) throw error;
}

/** 删除会话 — client.session.delete({ sessionID }) */
export async function aiDeleteSession(sessionID: string): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await (client as any).session.delete({ sessionID });
  if (error) throw error;
}

/** 删除全部会话 — 分页遍历删除, 直到全部删完 */
export async function aiDeleteAllSessions(): Promise<number> {
  assertAiReady();
  const client = getAiClient()!;
  let deleted = 0;
  let cursor: string | undefined;
  // 循环翻页 (每次取 100 条), 删除所有会话
  for (;;) {
    const params: any = { limit: 100, order: 'desc' };
    if (cursor) params.cursor = cursor;
    const { data, error } = await (client as any).session.list(params);
    if (error) throw error;
    const list: any[] = Array.isArray(data) ? data : (data?.data || []);
    const next = data?.cursor?.next;
    for (const s of list || []) {
      if (!s?.id) continue;
      await aiDeleteSession(s.id);
      deleted += 1;
    }
    // 没有更多了或本页删空
    if (!next || !list || list.length === 0) break;
    cursor = next;
  }
  return deleted;
}

/** 会话内 agent 列表 — v2.agent.list */
export async function aiListAgents(): Promise<any[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await (client as any).v2.agent.list();
  if (error) throw error;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).data)) return (data as any).data;
  return [];
}

/** 切换会话 agent — v2.session.switchAgent({ sessionID, agent }) */
export async function aiSwitchAgent(sessionID: string, agent: string): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await (client as any).v2.session.switchAgent({ sessionID, agent });
  if (error) throw error;
}

/** 会话 todo 列表 — v2.session.todo (GET /session/{sessionID}/todo), 官方协议 */
export async function aiGetTodos(sessionID: string): Promise<any[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await (client as any).v2.session.todo({ sessionID });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** 回答 A2UI question — client.question.reply({ requestID, answers }) (v1 路径) */
export async function aiReplyQuestion(
  sessionID: string,
  requestID: string,
  answers: string[][]
): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await (client as any).question.reply({ requestID, answers });
  if (error) throw error;
}

/** 忽略 A2UI question — client.question.reject({ requestID }) (v1 路径, 告诉 AI 不再问) */
export async function aiRejectQuestion(sessionID: string, requestID: string): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await (client as any).question.reject({ requestID });
  if (error) throw error;
}

export interface ModelInfo {
  id: string;
  providerID: string;
  name: string;
  family?: string;
}

/** 模型列表 — v2.model.list */
export async function aiListModels(): Promise<ModelInfo[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await (client as any).v2.model.list();
  if (error) throw error;
  const list: any[] = Array.isArray(data) ? data : (data?.data || []);
  return list
    .filter((m) => m && m.id && m.providerID)
    .map((m) => ({
      id: m.id,
      providerID: m.providerID,
      name: m.name || m.id,
      family: m.family,
    }));
}

export interface ProviderInfo {
  id: string;
  name: string;
  disabled?: boolean;
}

/** 提供商列表 — v2.provider.list */
export async function aiListProviders(): Promise<ProviderInfo[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await (client as any).v2.provider.list();
  if (error) throw error;
  const list: any[] = Array.isArray(data) ? data : (data?.data || []);
  return list
    .filter((p) => p && p.id)
    .map((p) => ({
      id: p.id,
      name: p.name || p.id,
      disabled: p.disabled,
    }));
}
