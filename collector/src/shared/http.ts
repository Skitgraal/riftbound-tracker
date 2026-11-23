export const USER_AGENT = 'riftbound-tracker/1.0 (+https://github.com/Skitgraal/riftbound-tracker)';

interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

/** GET avec délai maximal et nouvelles tentatives espacées (erreurs réseau et 5xx ; une 4xx est définitive). */
async function get(url: string, { timeoutMs = 30_000, retries = 3, accept = '*/*' }: FetchOptions): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} pour ${url}`);
        if (response.status < 500) throw Object.assign(error, { permanent: true });
        throw error;
      }
      return response;
    } catch (error) {
      lastError = error;
      if ((error as { permanent?: boolean }).permanent || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  return (await (await get(url, { accept: 'application/json', ...options })).json()) as T;
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  return (await get(url, { accept: 'text/html,application/xhtml+xml', ...options })).text();
}

export async function fetchBinary(url: string, options: FetchOptions = {}): Promise<{ bytes: Buffer; type: string }> {
  const response = await get(url, { accept: 'image/*', ...options });
  return { bytes: Buffer.from(await response.arrayBuffer()), type: response.headers.get('content-type') ?? '' };
}
