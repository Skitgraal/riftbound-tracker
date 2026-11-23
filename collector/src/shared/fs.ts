import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt (collector/src/shared → ../../..). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const repoPath = (...parts: string[]): string => resolve(REPO_ROOT, ...parts);

export async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  const text = await readText(path);
  return text === undefined ? fallback : (JSON.parse(text) as T);
}

export async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
}

/** JSON indenté avec retour à la ligne final : des diffs Git lisibles. */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}
