/** Watchlist : tout le scellé anglais (automatique) + les cartes de config/watchlist.yml. */
import type { PriceSettings, WatchedCard } from '../shared/config.ts';
import { languageTagOf, type Catalog, type CatalogEntry } from './catalog.ts';
import { variations, type SeriesMap, type Variations } from './series.ts';

export interface Watched {
  entry: CatalogEntry;
  alert1d: number;
  alert7d: number;
}

export function watchedProducts(catalog: Catalog, cards: WatchedCard[], settings: PriceSettings): Watched[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const result: Watched[] = [];
  for (const entry of Object.values(catalog)) {
    if (entry.removedAt) continue;
    const card = byId.get(entry.id);
    const autoSealed = entry.kind === 'sealed' && !languageTagOf(entry.name);
    if (!autoSealed && !card) continue;
    result.push({
      entry,
      alert1d: card?.alert_1d_pct ?? settings.alert_1d_pct,
      alert7d: card?.alert_7d_pct ?? settings.alert_7d_pct,
    });
  }
  return result;
}

export interface Move {
  entry: CatalogEntry;
  date: string;
  trend: number;
  variations: Variations;
  /** Fenêtre qui a dépassé son seuil. */
  window: '1d' | '7d';
  pct: number;
}

/** Produits suivis dont le prix tendance du dernier relevé (`date`) a franchi un seuil. */
export function findMoves(watched: Watched[], series: SeriesMap, date: string, settings: PriceSettings): Move[] {
  const moves: Move[] = [];
  for (const w of watched) {
    const points = series.get(w.entry.id);
    const last = points?.at(-1);
    if (!points || !last || last.date !== date || last.trend === null || last.trend < settings.min_price_eur) continue;
    const v = variations(points);
    const window = v.d1 !== null && Math.abs(v.d1) >= w.alert1d ? '1d' : v.d7 !== null && Math.abs(v.d7) >= w.alert7d ? '7d' : undefined;
    if (!window) continue;
    moves.push({ entry: w.entry, date, trend: last.trend, variations: v, window, pct: (window === '1d' ? v.d1 : v.d7)! });
  }
  return moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}
