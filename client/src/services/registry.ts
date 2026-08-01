const DEFAULT_REGISTRY_URL = 'https://localhost:9000';

export class ExtensionRegistryClient {
  constructor(private readonly baseUrl: string = DEFAULT_REGISTRY_URL) {}

  async fetchMetadata(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/metadata.json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`GET /metadata.json failed: ${res.status}`);
    }
    return res.json();
  }
}
