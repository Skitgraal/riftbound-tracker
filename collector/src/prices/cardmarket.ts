import { fetchJson } from '../shared/http.ts';

/** Riftbound dans les fichiers publics Cardmarket (vérifié le 14/11/2026). */
export const RIFTBOUND_GAME_ID = 22;

const BASE = 'https://downloads.s3.cardmarket.com/productCatalog';

export const CARDMARKET_URLS = {
  singles: `${BASE}/productList/products_singles_${RIFTBOUND_GAME_ID}.json`,
  nonsingles: `${BASE}/productList/products_nonsingles_${RIFTBOUND_GAME_ID}.json`,
  priceGuide: `${BASE}/priceGuide/price_guide_${RIFTBOUND_GAME_ID}.json`,
} as const;

export interface CmProduct {
  idProduct: number;
  name: string;
  idCategory: number;
  categoryName: string;
  idExpansion: number;
  idMetacard: number;
  dateAdded: string;
}

export interface CmProductList {
  version: number;
  createdAt: string;
  products: CmProduct[];
}

/** Une ligne du guide de prix. Les champs absents ou nuls sont normalisés en null. */
export interface CmPrice {
  idProduct: number;
  idCategory: number;
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  'avg-foil': number | null;
  'low-foil': number | null;
  'trend-foil': number | null;
  'avg1-foil': number | null;
  'avg7-foil': number | null;
  'avg30-foil': number | null;
}

export interface CmPriceGuide {
  version: number;
  createdAt: string;
  priceGuides: CmPrice[];
}

function assertShape(ok: boolean, what: string): asserts ok {
  if (!ok) throw new Error(`Format Cardmarket inattendu : ${what}. Le fichier a peut-être changé de structure.`);
}

export function validateProductList(data: unknown, label: string): CmProductList {
  const d = data as CmProductList;
  assertShape(typeof d?.createdAt === 'string' && Array.isArray(d.products), `${label} sans createdAt ou products`);
  assertShape(d.products.length > 0, `${label} vide`);
  const p = d.products[0]!;
  assertShape(typeof p.idProduct === 'number' && typeof p.name === 'string', `${label} : produit sans idProduct ou name`);
  return d;
}

export function validatePriceGuide(data: unknown): CmPriceGuide {
  const d = data as CmPriceGuide;
  assertShape(typeof d?.createdAt === 'string' && Array.isArray(d.priceGuides), 'guide de prix sans createdAt ou priceGuides');
  assertShape(d.priceGuides.length > 0, 'guide de prix vide');
  assertShape(typeof d.priceGuides[0]!.idProduct === 'number', 'ligne de prix sans idProduct');
  return d;
}

export async function downloadAll(): Promise<{ singles: CmProductList; nonsingles: CmProductList; priceGuide: CmPriceGuide }> {
  const [singles, nonsingles, priceGuide] = await Promise.all([
    fetchJson<unknown>(CARDMARKET_URLS.singles),
    fetchJson<unknown>(CARDMARKET_URLS.nonsingles),
    fetchJson<unknown>(CARDMARKET_URLS.priceGuide),
  ]);
  return {
    singles: validateProductList(singles, 'catalogue cartes'),
    nonsingles: validateProductList(nonsingles, 'catalogue scellé'),
    priceGuide: validatePriceGuide(priceGuide),
  };
}

/**
 * Lien vers Cardmarket. L'URL exacte d'une fiche produit contient un chemin que les fichiers ne donnent pas :
 * on passe par la recherche, filtrée sur l'anglais (language=1). Format à affiner au jalon 2.
 */
export function cardmarketSearchUrl(name: string): string {
  return `https://www.cardmarket.com/en/Riftbound/Products/Search?searchString=${encodeURIComponent(name)}&language=1`;
}
