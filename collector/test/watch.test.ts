import { describe, expect, it } from 'vitest';
import { parseExtraction } from '../src/watch/extract.ts';
import { describeChanges } from '../src/watch/events.ts';
import { decodeEntities, htmlToText, jsonAfterKey } from '../src/watch/html.ts';
import { applySighting, classifyType, cleanProductName, emptyProduct, findMatch, isAccessory, nameTokens, recompute, slugOf } from '../src/watch/products.ts';
import type { Product, Sighting } from '../src/watch/types.ts';

const NOW = '2026-11-23T12:00:00.000Z';

const sighting = (over: Partial<Sighting> = {}): Sighting => ({
  name: 'Radiance Booster Display',
  set: 'Radiance',
  type: 'display',
  msrp: null,
  releaseDate: null,
  status: null,
  draws: [],
  image: null,
  evidence: 'quote',
  ...over,
});

const ctx = (tier: 'official' | 'relay' | 'leak', observedAt = NOW, source = `src-${tier}`) => ({
  source,
  tier,
  url: `https://example.com/${source}`,
  observedAt,
  publishedAt: null,
});

describe('lecture des pages', () => {
  it('convertit le HTML en texte lisible', () => {
    expect(htmlToText('<h2>Contents</h2><ul><li>5 cards</li><li>1 deck box</li></ul><p><strong>Cost:</strong> $70.00&nbsp;+ S&amp;H</p>')).toBe(
      '## Contents\n\n- 5 cards\n- 1 deck box\nCost: $70.00 + S&H',
    );
    expect(decodeEntities('Riftbound&#8217;s &#x2014; &rsquo;')).toBe('Riftbound’s — ’');
  });

  it('extrait un tableau JSON au milieu d’un flux, chaînes avec crochets comprises', () => {
    const text = 'xx"initialProducts":[{"title":"A [special] box","n":1},{"title":"B"}],"other":2';
    expect(jsonAfterKey(text, 'initialProducts')).toEqual([{ title: 'A [special] box', n: 1 }, { title: 'B' }]);
  });
});

describe('noms de produits', () => {
  it('nettoie les préfixes de la boutique', () => {
    expect(cleanProductName('Riftbound: League of Legends TCG Radiance Booster Display')).toBe('Radiance Booster Display');
    expect(cleanProductName('Riftbound: League of Legends TCG - Vi, Piltover Enforcer Playmat')).toBe('Vi, Piltover Enforcer Playmat');
  });

  it('écarte les accessoires vendus seuls, pas les bundles', () => {
    expect(isAccessory('Poppy, Keeper of the Hammer Art Sleeves')).toBe(true);
    expect(isAccessory('Vi, Piltover Enforcer Playmat')).toBe(true);
    expect(isAccessory('Riftbound x T1 2025 Worlds Champion Player Bundle')).toBe(false);
  });

  it('classe les types', () => {
    expect(classifyType('Radiance Booster Display')).toBe('display');
    expect(classifyType('Origins Case (6x Booster Box)')).toBe('display');
    expect(classifyType('Unleashed Nexus Night Packs')).toBe('booster');
    expect(classifyType('Evelynn vs Seraphine Showdown Deck')).toBe('deck');
    expect(classifyType('Riftbound x Worlds 2026 Edition')).toBe('box_exclusive');
  });

  it('considère « Booster Box » et « Booster Display » comme le même produit', () => {
    expect(nameTokens('Riftbound: Radiance Booster Box')).toEqual(nameTokens('Radiance Booster Display'));
    expect(slugOf('Riftbound x K/DA: Couture Collection')).toBe('k-da-couture-collection');
  });
});

describe('rapprochement', () => {
  const existing = emptyProduct('t1-2025-worlds-champion-player-bundle', 'T1 2025 Worlds Champion Player Bundle', NOW);

  it('retrouve la même fiche malgré les variantes de nom', () => {
    expect(findMatch([existing], 'Riftbound x T1 2025 Worlds Champion Player Bundle').product?.slug).toBe(existing.slug);
  });

  it('signale un doublon possible sans fusionner', () => {
    const m = findMatch([existing], 'T1 2025 Worlds Champion Signature Bundle');
    expect(m.product).toBeUndefined();
    expect(m.maybe?.slug).toBe(existing.slug);
  });

  it('ne rapproche pas des produits sans rapport', () => {
    expect(findMatch([existing], 'Vendetta Booster Display')).toEqual({});
  });
});

describe('affirmations et statut', () => {
  it('officiel > relais > leak, puis la plus récente', () => {
    const p = emptyProduct('x', 'X', NOW);
    applySighting(p, sighting({ msrp: { amount: 99, currency: 'USD' } }), ctx('leak', '2026-11-22T00:00:00Z'));
    applySighting(p, sighting({ msrp: { amount: 120, currency: 'USD' } }), ctx('official', '2026-11-20T00:00:00Z'));
    applySighting(p, sighting({ msrp: { amount: 110, currency: 'USD' } }), ctx('relay', '2026-11-23T00:00:00Z'));
    recompute(p, '2026-11-23');
    expect(p.msrp?.amount).toBe(120);
    expect(p.reliability).toBe('confirmed');
  });

  it('n’empile pas une affirmation identique de la même source', () => {
    const p = emptyProduct('x', 'X', NOW);
    applySighting(p, sighting(), ctx('official'));
    const count = p.claims.length;
    applySighting(p, sighting(), ctx('official', '2026-11-24T00:00:00Z'));
    expect(p.claims.length).toBe(count);
  });

  it('une affirmation invalidée est ignorée', () => {
    const p = emptyProduct('x', 'X', NOW);
    applySighting(p, sighting({ releaseDate: { value: '2027-03-01', precision: 'day' } }), ctx('official'));
    p.claims.find((c) => c.field === 'releaseDate')!.invalid = true;
    recompute(p, '2026-11-23');
    expect(p.releaseDate).toBeNull();
  });

  it('leak seul = rumeur ; date passée = sorti ; précommande', () => {
    const leak = emptyProduct('x', 'X', NOW);
    applySighting(leak, sighting(), ctx('leak'));
    recompute(leak, '2026-11-23');
    expect([leak.status, leak.reliability]).toEqual(['rumor', 'unconfirmed']);

    const dated = emptyProduct('y', 'Y', NOW);
    applySighting(dated, sighting({ releaseDate: { value: '2026-10-23', precision: 'day' } }), ctx('official'));
    recompute(dated, '2026-11-23');
    expect(dated.status).toBe('released');

    const pre = emptyProduct('z', 'Z', NOW);
    applySighting(pre, sighting({ status: 'preorder', releaseDate: { value: '2027-02', precision: 'month' } }), ctx('official'));
    recompute(pre, '2026-11-23');
    expect(pre.status).toBe('preorder');
  });

  it('la bannière d’article ne sert qu’en l’absence de vraie photo', () => {
    const p = emptyProduct('x', 'X', NOW);
    applySighting(p, sighting({ fallbackImage: 'https://cdn/banner.jpg' }), ctx('official', '2026-11-23T10:00:00Z', 'news'));
    recompute(p, '2026-11-23');
    expect(p.imageSource).toBe('https://cdn/banner.jpg');
    applySighting(p, sighting({ image: 'https://cdn/product.jpg' }), ctx('official', '2026-11-20T00:00:00Z', 'merch'));
    recompute(p, '2026-11-23');
    expect(p.imageSource).toBe('https://cdn/product.jpg');
  });

  it('fusionne les informations d’une même fenêtre de tirage', () => {
    const p = emptyProduct('x', 'X', NOW);
    applySighting(p, sighting({ draws: [{ opensAt: '2026-11-13T17:00:00.000Z', closesAt: null, url: null, region: 'US' }] }), ctx('official', '2026-11-06T00:00:00Z'));
    applySighting(p, sighting({ draws: [{ opensAt: '2026-11-13T17:00:00.000Z', closesAt: '2026-11-16T17:00:00.000Z', url: 'https://merch', region: null }] }), ctx('official', '2026-11-10T00:00:00Z'));
    recompute(p, '2026-11-23');
    expect(p.draws).toEqual([{ opensAt: '2026-11-13T17:00:00.000Z', closesAt: '2026-11-16T17:00:00.000Z', url: 'https://merch', region: 'US' }]);
  });
});

describe('sortie du LLM', () => {
  it('valide, convertit et écarte ce qui est inutilisable', () => {
    const out = parseExtraction({
      products: [
        {
          name: 'Riftbound: Worlds 2026 Edition',
          set: null,
          type: 'draw_product',
          english_available: true,
          msrp_amount: 79.99,
          msrp_currency: 'USD',
          release_date: '2026-12',
          release_precision: 'month',
          status: 'announced',
          draws: [{ opens_at: '2026-11-13T09:00:00-08:00', closes_at: '2026-11-16T09:00:00-08:00', url: null, region: 'US' }, { opens_at: 'bientôt', closes_at: null, url: null, region: null }],
          evidence: 'Drawing registration opens: November 13, 9:00 AM PT',
        },
        { name: 'Version chinoise', english_available: false },
        { name: '', english_available: true },
        { name: 'Mauvaise date', type: 'nimporte', english_available: true, release_date: '2027-03', release_precision: 'day' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      name: 'Worlds 2026 Edition',
      type: 'draw_product',
      msrp: { amount: 79.99, currency: 'USD' },
      releaseDate: { value: '2026-12', precision: 'month' },
      draws: [{ opensAt: '2026-11-13T17:00:00.000Z', closesAt: '2026-11-16T17:00:00.000Z', url: null, region: 'US' }],
    });
    expect(out[1]).toMatchObject({ type: 'other', releaseDate: null });
  });

  it('rejette une réponse sans liste', () => {
    expect(() => parseExtraction({ foo: 1 })).toThrow();
  });
});

describe('alertes', () => {
  const base = (): Product => {
    const p = emptyProduct('x', 'Radiance Booster Display', NOW);
    applySighting(p, sighting(), ctx('official'));
    recompute(p, '2026-11-23');
    return p;
  };

  it('nouveau produit, précommande, tirage', () => {
    const p = base();
    expect(describeChanges(undefined, p, new Date(NOW)).map((e) => e.key)).toEqual(['product-new:x']);

    const next = structuredClone(p);
    applySighting(next, sighting({ status: 'preorder', draws: [{ opensAt: '2026-11-25T17:00:00.000Z', closesAt: '2026-11-28T17:00:00.000Z', url: null, region: null }] }), ctx('official', '2026-11-23T13:00:00Z'));
    recompute(next, '2026-11-23');
    const events = describeChanges(p, next, new Date(NOW));
    expect(events.map((e) => [e.key, e.channel])).toEqual([
      ['preorder:x', 'critical'],
      ['draw:x:2026-11-25T17:00:00.000Z', 'critical'],
    ]);
  });

  it('pas d’alerte « nouveau » pour un produit tiré d’un vieil article', () => {
    const p = base();
    p.announcedAt = '2026-07-07';
    expect(describeChanges(undefined, p, new Date(NOW))).toEqual([]);
  });

  it('un tirage déjà fermé n’est pas annoncé', () => {
    const p = base();
    const next = structuredClone(p);
    applySighting(next, sighting({ draws: [{ opensAt: '2026-11-13T17:00:00.000Z', closesAt: '2026-11-16T17:00:00.000Z', url: null, region: null }] }), ctx('official', '2026-11-23T13:00:00Z'));
    recompute(next, '2026-11-23');
    expect(describeChanges(p, next, new Date(NOW))).toEqual([]);
  });
});
