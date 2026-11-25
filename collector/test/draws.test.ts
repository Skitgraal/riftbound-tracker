import { describe, expect, it } from 'vitest';
import { htmlToText } from '../src/watch/html.ts';
import { applySighting, emptyProduct, mergeDraws, recompute } from '../src/watch/products.ts';
import type { Draw, Sighting } from '../src/watch/types.ts';

const d = (opensAt: string | null, closesAt: string | null, url: string | null = null): Draw => ({ opensAt, closesAt, url, region: null });

describe('mergeDraws', () => {
  it("fond la fenêtre incomplète (vidéo : jour d'ouverture seul) dans la fenêtre complète de l'article", () => {
    const merged = mergeDraws([
      d('2026-10-27T16:00:00.000Z', '2026-10-30T16:00:00.000Z'),
      d('2026-10-27T07:00:00.000Z', null, 'https://merch.riotgames.com/draw'),
    ]);
    expect(merged).toEqual([d('2026-10-27T16:00:00.000Z', '2026-10-30T16:00:00.000Z', 'https://merch.riotgames.com/draw')]);
  });

  it('garde deux vrais tirages distincts', () => {
    const merged = mergeDraws([d('2026-08-14T16:00:00.000Z', '2026-08-18T01:00:00.000Z'), d('2026-11-13T17:00:00.000Z', '2026-11-16T17:00:00.000Z')]);
    expect(merged).toHaveLength(2);
  });

  it("garde un lien d'inscription seul comme tirage à venir", () => {
    const merged = mergeDraws([d('2026-08-14T16:00:00.000Z', '2026-08-18T01:00:00.000Z'), d(null, null, 'https://form')]);
    expect(merged).toHaveLength(2);
  });
});

describe('tirages : Riot seulement', () => {
  it("ignore les tirages venus d'une boutique ou d'un leak", () => {
    const p = emptyProduct('x', 'X', '2026-11-01T00:00:00Z');
    const s = (draws: Draw[]): Sighting => ({ name: 'X', set: null, type: 'other', msrp: null, releaseDate: null, status: null, draws, image: null, evidence: '' });
    const ctx = (tier: 'official' | 'relay' | 'leak') => ({ source: tier, tier, url: `https://${tier}`, observedAt: '2026-11-20T00:00:00Z', publishedAt: null });
    applySighting(p, s([d('2026-12-01T17:00:00Z', '2026-12-04T17:00:00Z')]), ctx('leak'));
    recompute(p, '2026-11-25');
    expect(p.draws).toEqual([]);
    applySighting(p, s([d('2026-12-02T17:00:00Z', '2026-12-05T17:00:00Z')]), ctx('official'));
    recompute(p, '2026-11-25');
    expect(p.draws).toHaveLength(1);
  });
});

describe('htmlToText', () => {
  it('garde les liens pour que le LLM trouve le formulaire de tirage', () => {
    expect(htmlToText('<p>Enter the drawing <a href="https://merch.riotgames.com/x">here</a>.</p>')).toBe('Enter the drawing here (https://merch.riotgames.com/x).');
    expect(htmlToText('<a href="https://a.b/c">https://a.b/c</a>')).toBe('https://a.b/c');
  });
});
