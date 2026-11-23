export const USER_AGENT = 'riftbound-tracker/1.0 (+https://github.com/Skitgraal/riftbound-tracker)';

interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
}

/** GET JSON avec délai maximal et nouvelles tentatives espacées (erreurs réseau et 5xx). */
export async function fetchJson<T>(url: string, { timeoutMs = 30_000, retries = 3 }: FetchOptions = {}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} pour ${url}`);
        if (response.status < 500) throw Object.assign(error, { permanent: true });
        throw error;
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if ((error as { permanent?: boolean }).permanent || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
