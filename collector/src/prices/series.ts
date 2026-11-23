/** Lecture de l'historique CSV et calcul des variations de prix. */
import { readdir } from 'node:fs/promises';
import { readText, repoPath } from '../shared/fs.ts';

export interface Point {
  date: string;
  trend: number | null;
  low: number | null;
  avg: number | null;
}

/** Historique par idProduct, points triés par date croissante. */
export type SeriesMap = Map<number, Point[]>;

const HISTORY_DIR = repoPath('data/prices/history');

/** Un prix nul ou absent veut dire « pas de prix » (Cardmarket met 0 quand il n'y a pas de vente). */
function price(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseHistory(csvTexts: string[]): SeriesMap {
  const series: SeriesMap = new Map();
  for (const text of csvTexts) {
    const lines = text.split('\n');
    const header = (lines[0] ?? '').split(',');
    const col = (name: string) => header.indexOf(name);
    const [iDate, iId, iTrend, iLow, iAvg] = [col('date'), col('id'), col('trend'), col('low'), col('avg')];
    for (const line of lines.slice(1)) {
      if (!line) continue;
      const cells = line.split(',');
      const id = Number(cells[iId]);
      const point: Point = {
        date: cells[iDate] ?? '',
        trend: price(cells[iTrend]),
        low: price(cells[iLow]),
        avg: price(cells[iAvg]),
      };
      const list = series.get(id);
      if (list) list.push(point);
      else series.set(id, [point]);
    }
  }
  for (const list of series.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return series;
}

/** Charge les derniers mois d'historique (tous si `months` est absent). */
export async function loadHistory(months?: number): Promise<SeriesMap> {
  let files: string[];
  try {
    files = (await readdir(HISTORY_DIR)).filter((f) => /^\d{4}-\d{2}\.csv$/.test(f)).sort();
  } catch {
    return new Map();
  }
  if (months !== undefined) files = files.slice(-months);
  const texts = await Promise.all(files.map((f) => readText(`${HISTORY_DIR}/${f}`)));
  return parseHistory(texts.filter((t): t is string => t !== undefined));
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Variations {
  d1: number | null;
  d7: number | null;
  d30: number | null;
}

/**
 * Variation du prix tendance (en %) entre le dernier relevé et le relevé le plus récent datant d'au moins N jours avant.
 * `null` tant que l'historique est trop court ou qu'un des deux prix manque.
 */
export function variations(points: Point[]): Variations {
  const last = points.at(-1);
  const at = (days: number): number | null => {
    if (!last || last.trend === null) return null;
    const target = shiftDate(last.date, -days);
    for (let i = points.length - 2; i >= 0; i--) {
      const p = points[i]!;
      if (p.date <= target) return p.trend === null ? null : ((last.trend - p.trend) / p.trend) * 100;
    }
    return null;
  };
  return { d1: at(1), d7: at(7), d30: at(30) };
}
