import { describe, expect, it } from 'vitest';
import { validatePriceGuide, validateProductList, type CmPrice, type CmProduct } from '../src/prices/cardmarket.ts';
import { deriveExpansions, languageTagOf, mergeCatalog } from '../src/prices/catalog.ts';
import { appendDay, CSV_HEADER, hasDate, monthFileOf, priceRows } from '../src/prices/history.ts';

const product = (id: number, name: string, extra: Partial<CmProduct> = {}): CmProduct => ({
  idProduct: id,
  name,
  idCategory: 1657,
  categoryName: 'Riftbound Display',
  idExpansion: 6286,
  idMetacard: 0,
  dateAdded: '2025-08-28 14:25:13',
  ...extra,
});

// Valeurs réelles du guide de prix du 13/11/2026
const originsBox: CmPrice = {
  idProduct: 845721, idCategory: 1657, avg: 183.85, low: 64.97, trend: 178.6, avg1: null, avg7: null, avg30: null,
  'avg-foil': null, 'low-foil': null, 'trend-foil': 0, 'avg1-foil': null, 'avg7-foil': null, 'avg30-foil': null,
};
const single: CmPrice = {
  idProduct: 845712, idCategory: 1655, avg: 0.04, low: 0.02, trend: 0.06, avg1: 0.04, avg7: 0.05, avg30: 0.04,
  'avg-foil': 0.24, 'low-foil': 0.02, 'trend-foil': 0.17, 'avg1-foil': 0.1, 'avg7-foil': 0.18, 'avg30-foil': 0.21,
};

describe('validation des fichiers', () => {
  it('accepte un catalogue conforme', () => {
    expect(() => validateProductList({ version: 1, createdAt: 'x', products: [product(1, 'A')] }, 'test')).not.toThrow();
  });

  it('refuse un catalogue vide ou mal formé', () => {
    expect(() => validateProductList({ createdAt: 'x', products: [] }, 'test')).toThrow('vide');
    expect(() => validateProductList({ products: [] }, 'test')).toThrow('Format Cardmarket inattendu');
  });

  it('refuse un guide de prix sans lignes', () => {
    expect(() => validatePriceGuide({ createdAt: 'x', priceGuides: [] })).toThrow('vide');
  });
});

describe('catalogue', () => {
  it('repère les versions chinoises au nom', () => {
    expect(languageTagOf('Origins Booster Box (Chinese, Slim)')).toBe('ZH');
    expect(languageTagOf('Origins Booster Box')).toBe('');
  });

  it('ne signale aucun nouveau produit au tout premier passage', () => {
    const { catalog, newSealed } = mergeCatalog({}, [product(1, 'Carte', { categoryName: 'Riftbound Single' })], [product(2, 'Origins Booster Box')], 'T1');
    expect(Object.keys(catalog)).toEqual(['1', '2']);
    expect(catalog['1']!.kind).toBe('single');
    expect(catalog['2']!.kind).toBe('sealed');
    expect(newSealed).toEqual([]);
  });

  it('signale un scellé apparu ensuite, garde la date de première apparition', () => {
    const first = mergeCatalog({}, [], [product(2, 'Origins Booster Box')], 'T1').catalog;
    const { catalog, newSealed } = mergeCatalog(first, [], [product(2, 'Origins Booster Box'), product(3, 'Set 3 Booster Box')], 'T2');
    expect(newSealed.map((p) => p.id)).toEqual([3]);
    expect(catalog['2']!.firstSeenAt).toBe('T1');
  });

  it('ne modifie pas un produit inchangé', () => {
    const first = mergeCatalog({}, [], [product(2, 'A')], 'T1').catalog;
    const { catalog } = mergeCatalog(first, [], [product(2, 'A')], 'T2');
    expect(catalog).toEqual(first);
  });

  it('garde un produit retiré des fichiers, avec sa date de retrait', () => {
    const first = mergeCatalog({}, [], [product(2, 'A'), product(3, 'B')], 'T1').catalog;
    const second = mergeCatalog(first, [], [product(2, 'A')], 'T2').catalog;
    expect(second['3']!.removedAt).toBe('T2');
    expect(mergeCatalog(second, [], [product(2, 'A')], 'T3').catalog['3']!.removedAt).toBe('T2');
    expect(mergeCatalog(second, [], [product(2, 'A'), product(3, 'B')], 'T3').catalog['3']!.removedAt).toBeUndefined();
  });

  it('déduit le nom des extensions sans écraser un nom connu', () => {
    const products = [
      product(1, 'Origins Booster Box (Chinese, Slim)'),
      product(2, 'Origins Booster Box'),
      product(3, 'Spiritforged Booster Box', { idExpansion: 6400 }),
      product(4, 'Proving Grounds', { idExpansion: 6500 }),
    ];
    expect(deriveExpansions({}, products)).toEqual({ '6286': 'Origins', '6400': 'Spiritforged' });
    expect(deriveExpansions({ '6400': 'Nom manuel' }, products)['6400']).toBe('Nom manuel');
  });
});

describe('historique', () => {
  it('écrit les valeurs, vide pour null, trié par produit', () => {
    expect(priceRows([originsBox, single], '2026-11-13')).toEqual([
      '2026-11-13,845712,0.04,0.02,0.06,0.04,0.05,0.04,0.24,0.02,0.17,0.1,0.18,0.21',
      '2026-11-13,845721,183.85,64.97,178.6,,,,,,0,,,',
    ]);
  });

  it('crée le fichier avec son en-tête', () => {
    const csv = appendDay(undefined, ['2026-11-13,1,,,,,,,,,,,,'], '2026-11-13');
    expect(csv).toBe(`${CSV_HEADER}\n2026-11-13,1,,,,,,,,,,,,\n`);
  });

  it('ajoute un jour à la suite, une seule fois', () => {
    const day1 = appendDay(undefined, ['2026-11-13,1,,,,,,,,,,,,'], '2026-11-13')!;
    const day2 = appendDay(day1, ['2026-11-14,1,,,,,,,,,,,,'], '2026-11-14')!;
    expect(day2.split('\n').filter(Boolean)).toHaveLength(3);
    expect(hasDate(day2, '2026-11-14')).toBe(true);
    expect(appendDay(day2, ['2026-11-14,1,,,,,,,,,,,,'], '2026-11-14')).toBeUndefined();
  });

  it('range chaque jour dans le fichier de son mois', () => {
    expect(monthFileOf('2026-11-30')).toBe('2026-11.csv');
    expect(monthFileOf('2026-12-01')).toBe('2026-12.csv');
  });
});
