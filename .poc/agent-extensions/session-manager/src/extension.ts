import * as vscode from 'vscode';

const log = (...args: unknown[]) => console.log('>>>[session-manager][extension]', ...args);

export function activate(context: vscode.ExtensionContext) {
  log('activate');

  context.subscriptions.push(
    vscode.commands.registerCommand('agentnest.session.refresh', () => {
      log('command: refresh');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('agentnest.session.create', () => {
      log('command: create');
    })
  );
}

export function deactivate() {
  log('deactivate');
}
