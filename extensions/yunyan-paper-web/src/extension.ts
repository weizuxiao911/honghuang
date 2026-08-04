import * as vscode from 'vscode'

import { PAPER_CUSTOM_EDITOR_VIEW_TYPE, PaperCustomEditorProvider } from './panels/PaperCustomEditorProvider'
import { initConfig } from './services/config'

export function activate(context: vscode.ExtensionContext) {
  // 初始化 YAML 配置路径（/app/.env 或扩展目录下 app/.env）
  initConfig(context.extensionPath)

  const customEditorDisposable = vscode.window.registerCustomEditorProvider(
    PAPER_CUSTOM_EDITOR_VIEW_TYPE,
    new PaperCustomEditorProvider(context),
    {
      webviewOptions: {
        retainContextWhenHidden: true
      },
      supportsMultipleEditorsPerDocument: false
    }
  )
  context.subscriptions.push(customEditorDisposable)

  // tab 栏 action: 存入试卷库 — 通知当前 paper webview 执行保存
  context.subscriptions.push(
    vscode.commands.registerCommand('yunyan.paper.saveToLibrary', async () => {
      const panel = PaperCustomEditorProvider.activePanel
      if (!panel) {
        vscode.window.showWarningMessage('未打开试卷文件')
        return
      }
      try {
        await panel.webview.postMessage({ type: 'paper:save' })
      } catch (err) {
        vscode.window.showErrorMessage(`存入试卷库失败: ${String(err)}`)
      }
    })
  )
}

export function deactivate() {
  return undefined
}
