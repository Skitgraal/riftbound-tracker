/** Chargement des fichiers générés par `build-data` (servis sous ./data/). */
import { shallowRef, type ShallowRef } from 'vue';

export interface PriceRow {
  id: number;
  name: string;
  kind: 'single' | 'sealed';
  category: string;
  set: string;
  expansionId: number;
  /** Hors des sets de cartes (bundle, coffret, promo). */
  special: boolean;
  /** Langue d'une version non anglaise ; vide pour l'anglais. */
  lang: string;
  trend: number | null;
  low: number | null;
  avg: number | null;
  d1: number | null;
  d7: number | null;
  d30: number | null;
  watched: boolean;
  removed: boolean;
  spark?: (number | null)[];
}

export interface SiteMeta {
  generatedAt: string;
  priceGuideCreatedAt: string | null;
  catalogCreatedAt: string | null;
  lastSnapshotDate: string | null;
  historyStart: string | null;
  historyDays: number;
  thresholds: { d1: number; d7: number; minPrice: number };
  hideLanguageTags: string[];
  products: number;
  watched: number;
}

export interface JobStatus {
  lastRunAt?: string;
  lastSuccessAt?: string;
  consecutiveFailures?: number;
  lastError?: string;
  info?: Record<string, unknown>;
}

/** [date, tendance, plus bas, moyenne] */
export type SeriesPoint = [string, number | null, number | null, number | null];

const cache = new Map<string, Promise<unknown>>();

export function fetchData<T>(path: string): Promise<T> {
  let request = cache.get(path);
  if (!request) {
    request = fetch(`./data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path} : HTTP ${r.status}`);
      return r.json();
    });
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return request as Promise<T>;
}

export interface Loaded<T> {
  data: ShallowRef<T | undefined>;
  error: ShallowRef<string | undefined>;
}

/** Charge un fichier dans des refs réactives (pour les vues). */
export function useData<T>(path: string): Loaded<T> {
  const data = shallowRef<T>();
  const error = shallowRef<string>();
  fetchData<T>(path).then(
    (value) => (data.value = value),
    (e: unknown) => (error.value = e instanceof Error ? e.message : String(e)),
  );
  return { data, error };
}

/** Lien vers les offres Cardmarket du produit, filtrées sur l'anglais. */
export function cardmarketUrl(name: string): string {
  return `https://www.cardmarket.com/en/Riftbound/Products/Search?searchString=${encodeURIComponent(name)}&language=1`;
}

/** Minuscules, sans accents ni ponctuation : pour la recherche. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
