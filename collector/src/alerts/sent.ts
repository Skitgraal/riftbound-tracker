import { readJson, repoPath, writeJson } from '../shared/fs.ts';

const FILE = repoPath('data/alerts.json');
const RETENTION_DAYS = 180;

/** Clé d'alerte → date d'envoi (ISO). Empêche d'envoyer deux fois la même alerte. */
export type SentLog = Record<string, string>;

export const loadSent = (): Promise<SentLog> => readJson<SentLog>(FILE, {});

export async function saveSent(log: SentLog, now = new Date()): Promise<void> {
  const cutoff = now.getTime() - RETENTION_DAYS * 86_400_000;
  const kept = Object.fromEntries(
    Object.entries(log)
      .filter(([, at]) => new Date(at).getTime() >= cutoff)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeJson(FILE, kept);
}
