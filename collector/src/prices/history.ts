import type { CmPrice } from './cardmarket.ts';

/** Colonnes du CSV d'historique, dans l'ordre (voir docs/DATA_MODEL.md). */
export const CSV_COLUMNS = [
  'date', 'id',
  'avg', 'low', 'trend', 'avg1', 'avg7', 'avg30',
  'avg_foil', 'low_foil', 'trend_foil', 'avg1_foil', 'avg7_foil', 'avg30_foil',
] as const;

export const CSV_HEADER = CSV_COLUMNS.join(',');

const PRICE_FIELDS: (keyof CmPrice)[] = [
  'avg', 'low', 'trend', 'avg1', 'avg7', 'avg30',
  'avg-foil', 'low-foil', 'trend-foil', 'avg1-foil', 'avg7-foil', 'avg30-foil',
];

const cell = (value: unknown): string => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');

/** Lignes CSV d'un guide de prix pour une date de relevé, triées par produit. */
export function priceRows(prices: CmPrice[], date: string): string[] {
  return [...prices]
    .sort((a, b) => a.idProduct - b.idProduct)
    .map((p) => [date, String(p.idProduct), ...PRICE_FIELDS.map((f) => cell(p[f]))].join(','));
}

/** Fichier mensuel d'une date AAAA-MM-JJ. */
export const monthFileOf = (date: string): string => `${date.slice(0, 7)}.csv`;

/** Vrai si le CSV contient déjà des lignes pour cette date. */
export function hasDate(csv: string | undefined, date: string): boolean {
  return csv !== undefined && csv.includes(`\n${date},`);
}

/**
 * Ajoute les lignes d'une date au contenu d'un CSV mensuel.
 * Renvoie undefined si la date y est déjà : un relevé par jour, le premier fichier du jour fait foi.
 */
export function appendDay(csv: string | undefined, rows: string[], date: string): string | undefined {
  if (hasDate(csv, date)) return undefined;
  const base = csv && csv.length > 0 ? (csv.endsWith('\n') ? csv : `${csv}\n`) : `${CSV_HEADER}\n`;
  return `${base}${rows.join('\n')}\n`;
}
