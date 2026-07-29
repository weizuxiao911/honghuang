import * as vscode from 'vscode';

const log = (...args: unknown[]) => console.log('>>>[chat-window][extension]', ...args);

export function activate(_context: vscode.ExtensionContext) {
  log('activate');
}

export function deactivate() {
  log('deactivate');
}
