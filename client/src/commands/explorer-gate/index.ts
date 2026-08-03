import { Injectable, Autowired } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import { BrowserModule, ClientAppContribution } from '@opensumi/ide-core-browser';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences/types';

import { readSession } from '../login/api';

/**
 * Explorer / 编辑器 登录态门禁 — commands/explorer-gate/
 *
 * 未登录 = 只读模式:
 *   - 文件树写操作命令 (新建/重命名/删除/复制/剪切/粘贴/保存) 执行前拦截
 *   - 编辑器只读 (editor.readOnly = true, 可打开浏览但不可编辑)
 * 读操作 (浏览/打开) 放行.
 */

/** 文件写操作命令 */
const WRITE_COMMANDS = [
  'file.new',
  'file.folder.new',
  'file.delete',
  'file.rename',
  'file.copy.file',
  'file.cut.file',
  'file.paste.file',
  // 保存 (编辑器 Ctrl+S / 保存全部)
  'file.save',
  'file.saveAll',
  'workbench.action.files.save',
  'workbench.action.files.saveAll',
];

function loggedIn(): boolean {
  return !!readSession()?.userId;
}

function hintLogin(): void {
  window.dispatchEvent(new CustomEvent('taichu:gate-hint', { detail: { text: '登录后可使用此功能' } }));
}

@Injectable()
@Domain(CommandContribution)
export class ExplorerGateContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    for (const id of WRITE_COMMANDS) {
      commands.beforeExecuteCommand(id, (): boolean | any[] => {
        if (!loggedIn()) {
          hintLogin();
          return false; // 阻止执行
        }
        return true; // 放行
      });
    }
  }
}

/** 编辑器只读门禁: 未登录 editor.readOnly=true (可浏览不可编辑), 登录后 false */
@Injectable()
@Domain(ClientAppContribution)
export class EditorReadonlyContribution implements ClientAppContribution {
  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  onStart(): void {
    const apply = () => {
      try {
        this.preferenceService.set('editor.readOnly', !loggedIn());
      } catch {
        /* ignore */
      }
    };
    apply();
    window.addEventListener('taichu:login-session-changed', apply);
  }
}

@Injectable()
export class ExplorerGateModule extends BrowserModule {
  providers = [ExplorerGateContribution, EditorReadonlyContribution];

  contributionProvider = [CommandContribution, ClientAppContribution];
}
