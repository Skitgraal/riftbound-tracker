import { describe, expect, it } from 'vitest';
import { categoryLabel, languageTagOf, type Catalog, type CatalogEntry } from '../src/prices/catalog.ts';
import { CSV_HEADER } from '../src/prices/history.ts';
import { parseHistory, shiftDate, variations, type Point } from '../src/prices/series.ts';
import { findMoves, watchedProducts } from '../src/prices/watchlist.ts';
import type { PriceSettings } from '../src/shared/config.ts';

const settings: PriceSettings = { alert_1d_pct: 10, alert_7d_pct: 20, min_price_eur: 5, hide_language_tags: [] };

const entry = (id: number, name: string, kind: CatalogEntry['kind'] = 'sealed', extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id,
  name,
  kind,
  category: kind === 'sealed' ? 'Riftbound Display' : 'Riftbound Single',
  expansionId: 6286,
  languageTag: '',
  dateAdded: '2025-08-28 14:25:13',
  firstSeenAt: '2026-11-23T00:00:00.000Z',
  ...extra,
});

const pt = (date: string, trend: number | null): Point => ({ date, trend, low: null, avg: null });

describe('langues et catégories', () => {
  it('repère les versions non anglaises au nom', () => {
    expect(languageTagOf('Origins Booster (French)')).toBe('FR');
    expect(languageTagOf('Origins Booster Box (Chinese, Slim)')).toBe('ZH');
    expect(languageTagOf('Unleashed Sleeved Booster ')).toBe('');
  });
  it('raccourcit les catégories', () => {
    expect(categoryLabel('Riftbound Riftbound Box Sets')).toBe('Box set');
    expect(categoryLabel('Riftbound Playmats')).toBe('Playmats');
  });
});

describe('historique', () => {
  it('lit plusieurs mois, trie par date et traite 0 comme « pas de prix »', () => {
    const series = parseHistory([
      `${CSV_HEADER}\n2026-12-01,1,10,8,0,,,,,,,,,\n`,
      `${CSV_HEADER}\n2026-11-30,1,9,7,9.5,,,,,,,,,\n2026-11-30,2,1,1,1,,,,,,,,,\n`,
    ]);
    expect(series.get(1)).toEqual([
      { date: '2026-11-30', trend: 9.5, low: 7, avg: 9 },
      { date: '2026-12-01', trend: null, low: 8, avg: 10 },
    ]);
    expect(series.get(2)).toHaveLength(1);
  });

  it('décale les dates par-delà les mois', () => {
    expect(shiftDate('2026-12-01', -1)).toBe('2026-11-30');
    expect(shiftDate('2026-03-30', -30)).toBe('2026-02-28');
  });
});

describe('variations', () => {
  it('compare au relevé le plus récent datant d’au moins N jours', () => {
    const v = variations([pt('2026-11-01', 50), pt('2026-11-16', 80), pt('2026-11-22', 90), pt('2026-11-23', 100)]);
    expect(v.d1).toBeCloseTo(11.11, 2);
    expect(v.d7).toBeCloseTo(25, 5);
    expect(v.d30).toBeNull();
  });
  it('tolère un jour manquant', () => {
    expect(variations([pt('2026-11-20', 100), pt('2026-11-23', 90)]).d1).toBeCloseTo(-10, 5);
  });
  it('reste vide avec un seul relevé', () => {
    expect(variations([pt('2026-11-23', 100)])).toEqual({ d1: null, d7: null, d30: null });
  });
});

describe('watchlist et alertes', () => {
  const catalog: Catalog = {
    1: entry(1, 'Origins Booster Box'),
    2: entry(2, 'Origins Booster Box (French)'),
    3: entry(3, 'Blazing Scorcher', 'single'),
    4: entry(4, 'Spiritforged Booster', 'sealed', { removedAt: '2026-11-20T00:00:00.000Z' }),
    5: entry(5, 'Cheap Booster'),
  };

  it('suit le scellé anglais et les cartes demandées', () => {
    const watched = watchedProducts(catalog, [{ id: 3, alert_1d_pct: 30 }], settings);
    expect(watched.map((w) => w.entry.id).sort()).toEqual([1, 3, 5]);
    expect(watched.find((w) => w.entry.id === 3)?.alert1d).toBe(30);
  });

  it('alerte au-delà du seuil, pas en dessous ni sous le prix plancher', () => {
    const watched = watchedProducts(catalog, [{ id: 3, alert_1d_pct: 30 }], settings);
    const series = new Map([
      [1, [pt('2026-11-22', 100), pt('2026-11-23', 112)]],
      [3, [pt('2026-11-22', 10), pt('2026-11-23', 12)]], // +20 %, mais seuil carte à 30 %
      [5, [pt('2026-11-22', 2), pt('2026-11-23', 4)]], // +100 %, mais sous 5 €
    ]);
    const moves = findMoves(watched, series, '2026-11-23', settings);
    expect(moves).toHaveLength(1);
    expect(moves[0]?.entry.id).toBe(1);
    expect(moves[0]?.window).toBe('1d');
    expect(moves[0]?.pct).toBeCloseTo(12, 5);
  });

  it('ignore un produit sans relevé à la date du jour', () => {
    const watched = watchedProducts(catalog, [], settings);
    const series = new Map([[1, [pt('2026-11-21', 100), pt('2026-11-22', 150)]]]);
    expect(findMoves(watched, series, '2026-11-23', settings)).toEqual([]);
  });
});
