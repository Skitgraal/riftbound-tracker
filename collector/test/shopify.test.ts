import { describe, expect, it } from 'vitest';
import { cleanRetailName, shopifySighting, type ShopifyProduct } from '../src/watch/collectors/shopify.ts';
import { applySighting, consolidate, emptyProduct, findMatch, recompute } from '../src/watch/products.ts';
import type { Sighting, SourceConfig } from '../src/watch/types.ts';

const NOW = '2026-11-23T12:00:00.000Z';
const shop: SourceConfig = { id: 'shop', name: 'Shop', kind: 'shopify', tier: 'relay', url: 'https://shop.example/', enabled: true, currency: 'EUR' };
const SETS = ['Origins', 'Vendetta', 'Radiance', 'Legacy', 'The Reckoning'];

const product = (title: string, over: Partial<ShopifyProduct> = {}): ShopifyProduct => ({
  id: 1,
  title,
  handle: 'h',
  product_type: '',
  tags: [],
  variants: [{ price: '140.00', available: true }],
  images: [{ src: 'https://cdn.shopify.com/x.png?v=1' }],
  ...over,
});

const sighting = (over: Partial<Sighting> = {}): Sighting => ({
  name: 'Radiance Booster Display',
  set: null,
  type: 'display',
  msrp: null,
  releaseDate: null,
  status: null,
  draws: [],
  image: null,
  evidence: '',
  ...over,
});

describe('cleanRetailName', () => {
  it.each([
    ['[PREORDER] Riftbound: League of Legends TCG - Gift of the Rift Bundle', 'Gift of the Rift Bundle'],
    ['Riftbound: League of Legends TCG: Origins - Champion Deck - Jinx', 'Origins Champion Deck Jinx'],
    ['Riftbound - League of Legends: Spiritforged Booster Box', 'Spiritforged Booster Display'],
    ['Riftbound: Spiritforged Booster Box (24 Packs) — League of Legends TCG', 'Spiritforged Booster Display'],
    ['Riftbound TCG: Legacy Booster Display (24 Boosters)', 'Legacy Booster Display'],
    ['Riftbound: League of Legends - Radiance Booster Display - EN', 'Radiance Booster Display'],
    ['Riftbound: League of Legends TCG - Origins Booster Display Box', 'Origins Booster Display'],
    ['Riftbound: League of Legends - Vendetta Champion Deck Showdown: Zed vs Shen - EN', 'Vendetta Showdown Deck Zed vs Shen'],
    ['Riftbound: League Of Legends TCG - Proving Grounds [Reprint]', 'Proving Grounds'],
    ['Riftbound x Worlds 2026 Edition', 'Riftbound x Worlds 2026 Edition'],
  ])('nettoie « %s »', (title, expected) => {
    expect(cleanRetailName(title)).toBe(expected);
  });
});

describe('shopifySighting', () => {
  it('retrouve la fiche officielle quel que soit le nom donné par la boutique', () => {
    const official = emptyProduct('radiance-evelynn-vs-seraphine-showdown-deck', 'Radiance Evelynn vs. Seraphine Showdown Deck', NOW);
    for (const t of [
      'Riftbound: League of Legends TCG: Radiance - Showdown Deck - Evelynn VS Seraphine',
      'Riftbound: League of Legends TCG - Radiance Showdown Deck [Evelynn vs Seraphine]',
      'Riftbound: League of Legends - Radiance Showdown Deck: Evelynn vs. Seraphine - EN',
    ]) expect(findMatch([official], cleanRetailName(t)).product?.slug, t).toBe(official.slug);
    const vault = emptyProduct('radiance-vault', 'Radiance Vault', NOW);
    expect(findMatch([vault], cleanRetailName('Riftbound: League of Legends TCG - Radiance Vault Bundle')).product?.slug).toBe('radiance-vault');
  });

  it('écarte les autres langues, les lots, les kits de boutique, les accessoires et le reste', () => {
    for (const t of [
      'Riftbound: League of Legends TCG - Origins Slim Display - CHN',
      'Riftbound: League of Legends TCG: Origins - Booster Box - French',
      'Riftbound TCG: Legacy Booster Case (6 Booster Displays)',
      'Riftbound TCG: Radiance Showdown Deck Display (4 Decks)',
      'Riftbound TCG: Legacy Pre-Rift Event Kit',
      'Riftbound TCG: Legacy Champion Sleeves',
      'Riftbound - League of Legends: Bulk Runes',
      'One Piece - EB05 Display + Binder - Bundle',
    ]) expect(shopifySighting(product(t), shop, SETS), t).toBeNull();
    expect(shopifySighting(product('Riftbound TCG: Legacy Sanctum Box', { product_type: 'Deck Box' }), shop, SETS)).toBeNull();
    expect(shopifySighting(product('Riftbound TCG: Radiance Showdown Deck (1 Deck)'), shop, SETS)?.sighting.name).toBe('Radiance Showdown Deck');
  });

  it('lit prix, précommande, stock et set, sans jamais toucher au prix officiel', () => {
    const pre = shopifySighting(product('Riftbound TCG: The Reckoning Booster Display', { tags: 'Booster Box,preorder,presale' }), shop, SETS)!;
    expect(pre.sighting).toMatchObject({ name: 'The Reckoning Booster Display', set: 'The Reckoning', type: 'display', status: 'preorder', msrp: null });
    expect(pre.sighting.offer).toMatchObject({ price: { amount: 140, currency: 'EUR' }, availability: 'preorder', url: 'https://shop.example/products/h' });
    expect(pre.sighting.image).toBe('https://cdn.shopify.com/x.png?v=1&width=1200');
    const sold = shopifySighting(product('Riftbound: Vendetta Vault', { variants: [{ price: '45', available: false }] }), shop, SETS)!;
    expect(sold.sighting.status).toBeNull();
    expect(sold.sighting.offer?.availability).toBe('out_of_stock');
  });

  it('épuisé depuis longtemps sans précommande = sorti ; épuisé récent = on ne sait pas', () => {
    const now = new Date(NOW);
    const old = product('Riftbound: Origins Champion Deck Jinx', { created_at: '2025-08-20T00:00:00Z', variants: [{ price: '20', available: false }] });
    expect(shopifySighting(old, shop, SETS, now)?.sighting.status).toBe('released');
    const recent = product('Riftbound TCG: The Reckoning Vault', { created_at: '2026-11-11T00:00:00Z', variants: [{ price: '45', available: false }] });
    expect(shopifySighting(recent, shop, SETS, now)?.sighting.status).toBeNull();
  });

  it("prend la variante anglaise d'un produit multilingue", () => {
    const multi = product('Riftbound: Origins Booster Box (24 Packs)', {
      variants: [{ title: 'Francés', price: '150', available: true }, { title: 'Inglés', price: '188', available: false }],
    });
    expect(shopifySighting(multi, shop, SETS)?.sighting.offer).toMatchObject({ price: { amount: 188 }, availability: 'out_of_stock' });
    const frOnly = product('Riftbound: Origins Booster Box', { variants: [{ title: 'French', price: '150', available: true }] });
    expect(shopifySighting(frOnly, shop, SETS)).toBeNull();
  });
});

describe('rapprochement des noms', () => {
  it('deux decks de champions différents ne sont pas des doublons', () => {
    const viktor = emptyProduct('origins-champion-deck-viktor', 'Origins Champion Deck Viktor', NOW);
    expect(findMatch([viktor], 'Origins Champion Deck Jinx')).toEqual({});
  });

  it('un nom qui en contient un autre est signalé comme doublon possible', () => {
    const pg = emptyProduct('proving-grounds', 'Proving Grounds', NOW);
    expect(findMatch([pg], 'Origins Proving Grounds').maybe?.slug).toBe('proving-grounds');
  });

  it('pluriels et « booster » seul', () => {
    const kits = emptyProduct('radiance-pre-rift-kits', 'Radiance Pre-Rift Kits', NOW);
    expect(findMatch([kits], 'Radiance Pre-Rift Kit').product?.slug).toBe('radiance-pre-rift-kits');
    const pack = emptyProduct('origins-booster-pack', 'Origins Booster Pack', NOW);
    expect(findMatch([pack], 'Origins Booster').product?.slug).toBe('origins-booster-pack');
    expect(findMatch([pack], 'Origins Booster Display')).toEqual({});
  });

  it('consolidate fusionne les fiches identiques dans la plus fiable', () => {
    const official = emptyProduct('radiance-pre-rift-kits', 'Radiance Pre-Rift Kits', '2026-11-24T00:00:00Z');
    official.reliability = 'confirmed';
    const shopCopy = emptyProduct('radiance-pre-rift-kit', 'Radiance Pre-Rift Kit', '2026-11-20T00:00:00Z');
    shopCopy.offers.push({ source: 's', url: 'https://s/p', price: null, availability: 'in_stock', lastSeenAt: NOW });
    const jinx = emptyProduct('origins-champion-deck-jinx', 'Origins Champion Deck Jinx', NOW);
    jinx.possibleDuplicateOf = 'origins-champion-deck-viktor';
    const viktor = emptyProduct('origins-champion-deck-viktor', 'Origins Champion Deck Viktor', NOW);
    const map = new Map([official, shopCopy, jinx, viktor].map((p) => [p.slug, p]));
    expect(consolidate(map)).toEqual(['radiance-pre-rift-kit']);
    expect(map.get('radiance-pre-rift-kits')!.offers).toHaveLength(1);
    expect(map.get('origins-champion-deck-jinx')!.possibleDuplicateOf).toBeNull();
  });
});

describe('fusion multi-sources', () => {
  const ctx = (source: string, observedAt = NOW) => ({ source, tier: 'relay' as const, url: `https://${source}/p`, observedAt, publishedAt: null });

  it("une boutique qui le vend en stock l'emporte sur une vieille étiquette « précommande »", () => {
    const p = emptyProduct('legacy-booster-display', 'Legacy Booster Display', NOW);
    applySighting(p, sighting({ name: 'Legacy Booster Display', status: 'preorder' }), ctx('a'));
    applySighting(p, sighting({ name: 'Legacy Booster Display', status: 'released' }), ctx('b'));
    recompute(p, '2026-11-24');
    expect(p.status).toBe('released');
    expect(p.reliability).toBe('unconfirmed');
  });

  it('un produit vu par trois sources donne une seule fiche, confirmée dès que Riot en parle', () => {
    const p = emptyProduct('the-reckoning-booster-display', 'The Reckoning Booster Display', NOW);
    for (const s of ['shop-a', 'shop-b']) applySighting(p, sighting({ name: 'The Reckoning Booster Display', status: 'preorder' }), ctx(s));
    recompute(p, '2026-11-24');
    expect(p).toMatchObject({ status: 'preorder', reliability: 'unconfirmed' });
    applySighting(p, sighting({ name: 'The Reckoning Booster Display', status: 'announced' }), { ...ctx('riot-news'), tier: 'official' });
    recompute(p, '2026-11-24');
    expect(p.reliability).toBe('confirmed');
  });

  it("ne réécrit pas l'offre si rien ne change dans la journée", () => {
    const p = emptyProduct('x', 'Radiance Booster Display', NOW);
    const offer = { source: 's', url: 'https://s/p', price: { amount: 140, currency: 'EUR' }, availability: 'in_stock' as const };
    applySighting(p, sighting({ offer }), ctx('s'));
    applySighting(p, sighting({ offer }), ctx('s', '2026-11-23T14:00:00.000Z'));
    expect(p.offers).toHaveLength(1);
    expect(p.offers[0]!.lastSeenAt).toBe(NOW);
    applySighting(p, sighting({ offer: { ...offer, availability: 'out_of_stock' } }), ctx('s', '2026-11-23T16:00:00.000Z'));
    expect(p.offers[0]!.lastSeenAt).toBe('2026-11-23T16:00:00.000Z');
  });
});
