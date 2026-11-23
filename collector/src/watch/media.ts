/** Copie locale des visuels (data/media/) : la fiche garde son image même si la source la retire. */
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { fetchBinary } from '../shared/http.ts';
import { repoPath } from '../shared/fs.ts';

/** Les CDN de Riot (Sanity) redimensionnent à la volée : on demande une version légère, en WebP pour garder la transparence. */
export function resizedUrl(url: string): string {
  if (/cdn\.sanity\.io|cmsassets\.rgpub\.io/.test(url)) return `${url.replace(/\?.*$/, '')}?w=1200&fm=webp&q=82`;
  return url;
}

/** Télécharge le visuel et renvoie son chemin relatif à data/ (ex. `media/radiance-booster-display-1a2b3c4d.jpg`). */
export async function storeImage(slug: string, url: string): Promise<string> {
  const { bytes, type } = await fetchBinary(resizedUrl(url), { timeoutMs: 30_000, retries: 2 });
  if (!type.startsWith('image/')) throw new Error(`pas une image (${type || 'type inconnu'})`);
  if (bytes.length > 3_000_000) throw new Error('image trop lourde');
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const file = `media/${slug}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}.${ext}`;
  await mkdir(repoPath('data/media'), { recursive: true });
  await writeFile(repoPath('data', file), bytes);
  return file;
}
