import type { PriceRow } from './data.ts';

const CATEGORY_ORDER = ['Display', 'Booster', 'Deck', 'Box set', 'Set de cartes'];

/** Scellé : sets de cartes avant les produits hors série, set le plus récent d'abord, puis display → booster → deck…, puis nom. */
export function bySetThenType(a: PriceRow, b: PriceRow): number {
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return Number(a.special) - Number(b.special) || b.expansionId - a.expansionId || rank(a.category) - rank(b.category) || a.name.localeCompare(b.name);
}

/** Cartes : les plus chères d'abord. */
export function byTrendDesc(a: PriceRow, b: PriceRow): number {
  return (b.trend ?? -1) - (a.trend ?? -1) || a.name.localeCompare(b.name);
}
