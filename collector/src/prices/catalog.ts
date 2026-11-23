import type { CmProduct } from './cardmarket.ts';

export interface CatalogEntry {
  id: number;
  name: string;
  kind: 'single' | 'sealed';
  category: string;
  expansionId: number;
  /** `ZH` pour les versions chinoises, repérées au nom ; vide sinon. */
  languageTag: string;
  dateAdded: string;
  firstSeenAt: string;
  /** Date de disparition des fichiers Cardmarket ; absent tant que le produit y figure. */
  removedAt?: string;
}

/** Catalogue indexé par idProduct (clé texte pour le JSON). */
export type Catalog = Record<string, CatalogEntry>;

export function languageTagOf(name: string): string {
  return /\(chinese\b/i.test(name) ? 'ZH' : '';
}

export interface MergeResult {
  catalog: Catalog;
  /** Produits scellés apparus depuis le dernier passage (vide au tout premier passage). */
  newSealed: CatalogEntry[];
}

/**
 * Fusionne les catalogues Cardmarket dans le catalogue existant.
 * Un produit retiré des fichiers reste au catalogue avec sa date de retrait (son historique reste consultable).
 * Un produit inchangé garde exactement la même entrée : pas de modification inutile dans Git.
 */
export function mergeCatalog(existing: Catalog, singles: CmProduct[], nonsingles: CmProduct[], now: string): MergeResult {
  const bootstrap = Object.keys(existing).length === 0;
  const catalog: Catalog = { ...existing };
  const newSealed: CatalogEntry[] = [];
  const present = new Set<string>();

  const upsert = (p: CmProduct, kind: CatalogEntry['kind']) => {
    const key = String(p.idProduct);
    present.add(key);
    const previous = catalog[key];
    const entry: CatalogEntry = {
      id: p.idProduct,
      name: p.name,
      kind,
      category: p.categoryName,
      expansionId: p.idExpansion,
      languageTag: languageTagOf(p.name),
      dateAdded: p.dateAdded,
      firstSeenAt: previous?.firstSeenAt ?? now,
    };
    catalog[key] = entry;
    if (!previous && !bootstrap && kind === 'sealed') newSealed.push(entry);
  };

  for (const p of singles) upsert(p, 'single');
  for (const p of nonsingles) upsert(p, 'sealed');

  for (const [key, entry] of Object.entries(catalog)) {
    if (!present.has(key) && !entry.removedAt) catalog[key] = { ...entry, removedAt: now };
  }

  return { catalog: sortById(catalog), newSealed };
}

function sortById(catalog: Catalog): Catalog {
  return Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => Number(a) - Number(b)));
}

/** idExpansion → nom de l'extension. */
export type Expansions = Record<string, string>;

/**
 * Les fichiers ne nomment pas les extensions : on déduit le nom des produits « <Nom> Booster Box »
 * en version standard (sans parenthèse). Un nom déjà connu n'est jamais remplacé.
 */
export function deriveExpansions(existing: Expansions, nonsingles: CmProduct[]): Expansions {
  const result: Expansions = { ...existing };
  for (const p of nonsingles) {
    const match = /^(.+?) Booster Box$/.exec(p.name);
    const key = String(p.idExpansion);
    if (match && !result[key]) result[key] = match[1]!;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => Number(a) - Number(b)));
}
