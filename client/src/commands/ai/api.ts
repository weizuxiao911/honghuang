/**
 * ai api 共享底层 — commands/ai
 *
 * 前置: opencode SDK 实例 (commands/opencode) 已创建.
 * 本文件提供 AI 会话/消息的底层封装, 供 AiCommandsContribution + components/ai webview 复用.
 * 全部走 SDK client (v2), 不直连 HTTP.
 */

import { getOpencodeClient, isOpencodeReady } from '../opencode/client';

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

/** 创建新会话 */
export async function aiCreateSession(title?: string): Promise<string> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await client.session.create({ title });
  if (error) throw error;
  if (!data?.id) throw new Error('session.create 未返回 id');
  return data.id;
}

/** 历史会话列表 */
export async function aiListSessions(): Promise<any[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await client.session.list();
  if (error) throw error;
  return data || [];
}

/** 会话消息列表 */
export async function aiListMessages(sessionID: string): Promise<any[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await client.session.messages({ sessionID });
  if (error) throw error;
  return data || [];
}

/** 发送消息 (async_prompt) */
export async function aiSendMessage(
  sessionID: string,
  text: string,
  agent?: string
): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await client.session.promptAsync({
    sessionID,
    parts: [{ type: 'text', text }],
    agent,
  } as any);
  if (error) throw error;
}

/** 中断当前会话 */
export async function aiAbort(sessionID: string): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await client.session.abort({ sessionID });
  if (error) throw error;
}

/** 会话内 agent 列表 (subagent 选择) — v2 client */
export async function aiListAgents(): Promise<any[]> {
  assertAiReady();
  const client = getAiClient()!;
  const { data, error } = await (client as any).v2.agent.list();
  if (error) throw error;
  return data || [];
}

/** 切换会话 agent — v2 client */
export async function aiSwitchAgent(sessionID: string, agent: string): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await (client as any).v2.session.switchAgent({ sessionID, agent });
  if (error) throw error;
}

/** 回答 A2UI question — v2 client */
export async function aiReplyQuestion(
  sessionID: string,
  requestID: string,
  answers: string[]
): Promise<void> {
  assertAiReady();
  const client = getAiClient()!;
  const { error } = await (client as any).v2.question.reply({
    sessionID,
    requestID,
    questionV2Reply: { answers },
  });
  if (error) throw error;
}