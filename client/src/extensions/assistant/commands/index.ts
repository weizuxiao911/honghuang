import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';

import {
  aiCreateSession,
  aiListSessions,
  aiListMessages,
  aiSendMessage,
  aiAbort,
  aiListAgents,
  aiSwitchAgent,
  aiReplyQuestion,
} from './api';

/**
 * ai commands — AI 会话/消息/agent 能力 (按工具集分组维护)
 *
 * 命名约定: taichu.ai.{action}
 *   taichu.ai.session.create      (title?)           → sessionID   创建新会话
 *   taichu.ai.session.list        ()                 → Session[]   历史会话
 *   taichu.ai.session.switch      (sessionID)        → void        切换会话
 *   taichu.ai.message.list        (sessionID)        → Message[]   会话消息
 *   taichu.ai.message.send        (sessionID, text)  → void        发送消息 (async_prompt)
 *   taichu.ai.message.abort       (sessionID)        → void        中断
 *   taichu.ai.agent.list          ()                 → Agent[]     subagent 列表
 *   taichu.ai.agent.switch        (sessionID, agent) → void        切换 agent
 *   taichu.ai.a2ui.question.reply (sessionID, requestID, answers) → void
 *
 * 全部走 @opencode-ai/sdk (v2) client, 不直连 HTTP.
 * Module: AiCommandsModule, appConfig.modules: [AiCommandsModule] 注入 DI.
 */

export const AI_CMD = {
  SESSION_CREATE: 'taichu.ai.session.create',
  SESSION_LIST: 'taichu.ai.session.list',
  SESSION_SWITCH: 'taichu.ai.session.switch',
  MESSAGE_LIST: 'taichu.ai.message.list',
  MESSAGE_SEND: 'taichu.ai.message.send',
  MESSAGE_ABORT: 'taichu.ai.message.abort',
  AGENT_LIST: 'taichu.ai.agent.list',
  AGENT_SWITCH: 'taichu.ai.agent.switch',
  A2UI_QUESTION_REPLY: 'taichu.ai.a2ui.question.reply',
} as const;

@Injectable()
@Domain(CommandContribution)
export class AiCommandsContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: AI_CMD.SESSION_CREATE },
      { execute: (title?: string) => aiCreateSession(title) }
    );
    commands.registerCommand(
      { id: AI_CMD.SESSION_LIST },
      { execute: () => aiListSessions() }
    );
    commands.registerCommand(
      { id: AI_CMD.SESSION_SWITCH },
      { execute: (sessionID: string) => aiSwitchSession(sessionID) }
    );
    commands.registerCommand(
      { id: AI_CMD.MESSAGE_LIST },
      { execute: (sessionID: string) => aiListMessages(sessionID) }
    );
    commands.registerCommand(
      { id: AI_CMD.MESSAGE_SEND },
      { execute: (sessionID: string, text: string) => aiSendMessage(sessionID, text) }
    );
    commands.registerCommand(
      { id: AI_CMD.MESSAGE_ABORT },
      { execute: (sessionID: string) => aiAbort(sessionID) }
    );
    commands.registerCommand(
      { id: AI_CMD.AGENT_LIST },
      { execute: () => aiListAgents() }
    );
    commands.registerCommand(
      { id: AI_CMD.AGENT_SWITCH },
      { execute: (sessionID: string, agent: string) => aiSwitchAgent(sessionID, agent) }
    );
    commands.registerCommand(
      { id: AI_CMD.A2UI_QUESTION_REPLY },
      {
        execute: (sessionID: string, requestID: string, answers: string[][]) =>
          aiReplyQuestion(sessionID, requestID, answers),
      }
    );
  }
}

async function aiSwitchSession(sessionID: string): Promise<void> {
  // 切换会话由 webview 直接处理 (更新 UI 状态), command 只做透传
  return;
}

@Injectable()
export class AiCommandsModule extends BrowserModule {
  providers = [AiCommandsContribution];

  contributionProvider = CommandContribution;
}