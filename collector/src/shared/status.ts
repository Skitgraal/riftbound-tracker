import { readJson, repoPath, writeJson } from './fs.ts';

const FILE = repoPath('data/status.json');

export interface JobStatus {
  lastRunAt: string;
  lastSuccessAt?: string;
  consecutiveFailures: number;
  lastError?: string;
  /** Détails propres à chaque tâche (ex. date du dernier fichier Cardmarket). */
  info?: Record<string, unknown>;
}

export type StatusFile = Record<string, JobStatus>;

/** Enregistre l'issue d'une tâche et renvoie son nouvel état. */
export async function recordJob(
  job: string,
  outcome: { ok: true; info?: Record<string, unknown> } | { ok: false; error: string },
  now = new Date(),
): Promise<JobStatus> {
  const status = await readJson<StatusFile>(FILE, {});
  const previous = status[job];
  const at = now.toISOString();
  const next: JobStatus = outcome.ok
    ? { lastRunAt: at, lastSuccessAt: at, consecutiveFailures: 0, info: outcome.info ?? previous?.info }
    : {
        lastRunAt: at,
        lastSuccessAt: previous?.lastSuccessAt,
        consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
        lastError: outcome.error,
        info: previous?.info,
      };
  status[job] = next;
  await writeJson(FILE, Object.fromEntries(Object.entries(status).sort(([a], [b]) => a.localeCompare(b))));
  return next;
}
