export interface OpencodeFileEntry {
  name: string;
  path: string;
  absolute: string;
  type: 'file' | 'directory';
  ignored: boolean;
}

export interface OpencodeFileContent {
  type: string;
  content: string;
}

export interface OpencodePtySession {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  status: string;
  pid: number;
}

const WORKSPACE_ROOT = '/workspace';

function normalizeDirPath(p: string): string {
  const trimmed = p.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed === '' ? '.' : trimmed;
}

function normalizeFilePath(p: string): string {
  return p.replace(/^\/+/, '');
}

function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function dirname(absolutePath: string): string {
  const idx = absolutePath.lastIndexOf('/');
  return idx <= 0 ? '/' : absolutePath.slice(0, idx);
}

export class OpencodeFileClient {
  constructor(private readonly baseUrl: string) {}

  async readDirectory(dirPath: string): Promise<OpencodeFileEntry[]> {
    const path = normalizeDirPath(dirPath);
    const res = await fetch(`${this.baseUrl}/file?path=${encodeURIComponent(path)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`opencode /file failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async readFile(filePath: string): Promise<Uint8Array> {
    const path = normalizeFilePath(filePath);
    const res = await fetch(`${this.baseUrl}/file/content?path=${encodeURIComponent(path)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`opencode /file/content failed: ${res.status} ${res.statusText}`);
    }
    const data: OpencodeFileContent = await res.json();
    return new TextEncoder().encode(data.content);
  }

  async writeFile(filePath: string, content: string): Promise<OpencodePtySession> {
    const absolute = this.toAbsolute(filePath);
    const base64 = toBase64(content);
    const script = `printf %s ${shellQuote(base64)} | base64 -d > ${shellQuote(absolute)}`;
    return this.runShell(script, `write ${filePath}`);
  }

  async createFile(filePath: string): Promise<OpencodePtySession> {
    const absolute = this.toAbsolute(filePath);
    const script = `mkdir -p ${shellQuote(dirname(absolute))} && touch ${shellQuote(absolute)}`;
    return this.runShell(script, `create ${filePath}`);
  }

  async createDirectory(dirPath: string): Promise<OpencodePtySession> {
    const absolute = this.toAbsolute(dirPath);
    const script = `mkdir -p ${shellQuote(absolute)}`;
    return this.runShell(script, `mkdir ${dirPath}`);
  }

  async deletePath(targetPath: string): Promise<OpencodePtySession> {
    const absolute = this.toAbsolute(targetPath);
    const script = `rm -rf ${shellQuote(absolute)}`;
    return this.runShell(script, `delete ${targetPath}`);
  }

  private toAbsolute(p: string): string {
    return `${WORKSPACE_ROOT}/${normalizeFilePath(p)}`;
  }

  private async runShell(script: string, title: string): Promise<OpencodePtySession> {
    const res = await fetch(`${this.baseUrl}/pty`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: '/bin/bash',
        args: ['-c', script],
        cwd: WORKSPACE_ROOT,
        title,
      }),
    });
    if (!res.ok) {
      throw new Error(`opencode /pty failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }
}
