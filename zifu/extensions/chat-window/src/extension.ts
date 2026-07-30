import * as vscode from 'vscode';

const log = (...args: unknown[]) => console.log('>>>[chat-window][extension]', ...args);

export function activate(context: vscode.ExtensionContext) {
  log('activate');

  const cmd = vscode.commands.registerCommand('zifu.chat.reveal', async () => {
    try {
      await vscode.commands.executeCommand('main-layout.right-panel.show', 420);
    } catch (err) {
      log('reveal error', err);
    }
  });
  context.subscriptions.push(cmd);
}

export function deactivate() {
  log('deactivate');
}
