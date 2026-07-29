export interface Session {
  id: string;
  title: string;
  [key: string]: unknown;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:24096';

export class OpencodeSessionClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  async list(): Promise<Session[]> {
    const res = await fetch(`${this.baseUrl}/session`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`GET /session failed: ${res.status}`);
    }
    return res.json();
  }

  async create(title: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/session`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      throw new Error(`POST /session failed: ${res.status}`);
    }
    return res.json();
  }

  async remove(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/session/${id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`DELETE /session/${id} failed: ${res.status}`);
    }
  }
}
