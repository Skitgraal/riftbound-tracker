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

export interface WatchSettings {
  keywords: string[];
  llm_model: string;
  llm_fallback_model?: string;
  max_extractions_per_run: number;
  /** Au premier passage, seuls les articles plus récents que ça sont lus (les plus anciens sont marqués vus). */
  bootstrap_days: number;
}

const DEFAULT_WATCH: WatchSettings = {
  keywords: [],
  llm_model: 'gemini-3.8-flash',
  llm_fallback_model: 'gemini-3.5-flash-lite',
  max_extractions_per_run: 6,
  bootstrap_days: 150,
};

export async function loadWatchSettings(): Promise<WatchSettings> {
  const settings = await readYaml<{ watch: Partial<WatchSettings> }>('config/settings.yml');
  return { ...DEFAULT_WATCH, ...settings.watch };
}

export async function loadSources<T>(): Promise<T[]> {
  const config = await readYaml<{ sources: T[] | null }>('config/sources.yml');
  return config.sources ?? [];
}

export async function loadWatchedCards(): Promise<WatchedCard[]> {
  const watchlist = await readYaml<{ cards: WatchedCard[] | null }>('config/watchlist.yml');
  return (watchlist.cards ?? []).filter((c) => Number.isInteger(c?.id));
}
