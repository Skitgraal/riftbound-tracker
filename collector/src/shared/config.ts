/** Lecture des fichiers de configuration modifiables à la main (config/*.yml). */
import { parse } from 'yaml';
import { readText, repoPath } from './fs.ts';

export interface PriceSettings {
  alert_1d_pct: number;
  alert_7d_pct: number;
  min_price_eur: number;
  hide_language_tags: string[];
}

export interface WatchedCard {
  id: number;
  alert_1d_pct?: number;
  alert_7d_pct?: number;
}

const DEFAULT_PRICES: PriceSettings = { alert_1d_pct: 10, alert_7d_pct: 20, min_price_eur: 5, hide_language_tags: [] };

async function readYaml<T>(file: string): Promise<Partial<T>> {
  const text = await readText(repoPath(file));
  return text ? ((parse(text) as Partial<T> | null) ?? {}) : {};
}

export async function loadPriceSettings(): Promise<PriceSettings> {
  const settings = await readYaml<{ prices: Partial<PriceSettings> }>('config/settings.yml');
  return { ...DEFAULT_PRICES, ...settings.prices };
}

export async function loadWatchedCards(): Promise<WatchedCard[]> {
  const watchlist = await readYaml<{ cards: WatchedCard[] | null }>('config/watchlist.yml');
  return (watchlist.cards ?? []).filter((c) => Number.isInteger(c?.id));
}
