/**
 * Fiches produit : rapprochement d'un produit vu dans un document avec une fiche existante, ajout des affirmations,
 * recalcul des champs affichés (officiel > relais > leak, puis le plus récent).
 */
import { TIER_RANK, type Claim, type Draw, type FuzzyDate, type Money, type Offer, type Product, type ProductType, type Sighting, type Status, type Tier } from './types.ts';

// ---------- Noms ----------

/** « Riftbound: League of Legends TCG Radiance Booster Display » → « Radiance Booster Display ». */
export function cleanProductName(title: string): string {
  return title
    .replace(/^riftbound\s*:\s*league of legends tcg\s*[-–:]?\s*/i, '')
    .replace(/^riftbound\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACCESSORY = /\b(sleeves?|playmats?|deck ?box|binder|dice|d12|pins?|poster|plush|t-?shirt|hoodie|tee|mug|lanyard|keychain|figure|statue)\b/i;

/** Accessoires vendus seuls : hors du périmètre (seul le scellé est suivi). */
export function isAccessory(title: string): boolean {
  return ACCESSORY.test(title) && !/\b(bundle|collection|edition|box set)\b/i.test(title);
}

export function classifyType(name: string): ProductType {
  const n = name.toLowerCase();
  if (/booster (display|box)|\bdisplay\b|\bcase\b/.test(n)) return 'display';
  if (/\bbooster\b|\bpacks?\b/.test(n)) return 'booster';
  if (/\bdecks?\b|precon|proving grounds|starter/.test(n)) return 'deck';
  if (/\bbundle\b/.test(n)) return 'bundle';
  if (/collection|edition|box set|\bbox\b|\bvault\b/.test(n)) return 'box_exclusive';
  return 'other';
}

export function detectSet(name: string, knownSets: string[]): string | null {
  const lower = name.toLowerCase();
  return knownSets.find((s) => new RegExp(`\\b${s.toLowerCase()}\\b`).test(lower)) ?? null;
}

const STOPWORDS = new Set(['riftbound', 'league', 'of', 'legends', 'tcg', 'the', 'lol', 'x', 'a', 'and', 'english', 'en']);

/** Mots significatifs d'un nom, normalisés (« Booster Box » et « Booster Display » désignent le même produit). */
export function nameTokens(name: string): string[] {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w));
  return words.map((w, i) => (w === 'box' && words[i - 1] === 'booster' ? 'display' : w === 'packs' ? 'pack' : w === 'decks' ? 'deck' : w));
}

export const slugOf = (name: string): string => nameTokens(name).join('-') || 'produit';

function similarity(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / (A.size + B.size - inter || 1);
}

export interface Match {
  product?: Product;
  /** Fiche proche mais pas certaine : on crée une nouvelle fiche signalée « doublon possible ». */
  maybe?: Product;
}

export function findMatch(products: Product[], name: string): Match {
  const tokens = nameTokens(name);
  let best: { p: Product; score: number } | undefined;
  for (const p of products) {
    const candidates = [p.name, ...p.claims.filter((c) => c.field === 'name' && !c.invalid).map((c) => String(c.value))];
    for (const candidate of candidates) {
      const score = similarity(tokens, nameTokens(candidate));
      if (score === 1) return { product: p };
      if (!best || score > best.score) best = { p, score };
    }
  }
  return best && best.score >= 0.6 ? { maybe: best.p } : {};
}

// ---------- Affirmations ----------

interface ClaimContext {
  source: string;
  tier: Tier;
  url: string;
  observedAt: string;
  /** Date de publication du document, pour « annoncé le ». */
  publishedAt: string | null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Ajoute une affirmation, sauf si la même source a déjà affirmé exactement la même chose. */
function addClaim(product: Product, field: Claim['field'], value: unknown, evidence: string, ctx: ClaimContext): void {
  if (value === null || value === undefined || value === '') return;
  const previous = product.claims.filter((c) => c.field === field && c.source === ctx.source && !c.invalid).at(-1);
  if (field !== 'draw' && previous && same(previous.value, value)) return;
  if (field === 'draw' && product.claims.some((c) => c.field === 'draw' && c.source === ctx.source && same(c.value, value))) return;
  product.claims.push({ field, value, source: ctx.source, tier: ctx.tier, url: ctx.url, evidence: evidence.slice(0, 400), observedAt: ctx.observedAt });
}

export function emptyProduct(slug: string, name: string, now: string): Product {
  return {
    slug,
    name,
    set: null,
    type: 'other',
    language: 'EN',
    msrp: null,
    announcedAt: null,
    releaseDate: null,
    status: 'rumor',
    reliability: 'unconfirmed',
    image: null,
    imageSource: null,
    officialUrl: null,
    cmProductId: null,
    possibleDuplicateOf: null,
    draws: [],
    offers: [],
    claims: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Enregistre ce qu'un document dit d'un produit. */
export function applySighting(product: Product, s: Sighting, ctx: ClaimContext): void {
  addClaim(product, 'name', s.name, s.evidence, ctx);
  addClaim(product, 'set', s.set, s.evidence, ctx);
  if (s.type !== 'other') addClaim(product, 'type', s.type, s.evidence, ctx);
  addClaim(product, 'msrp', s.msrp, s.evidence, ctx);
  addClaim(product, 'releaseDate', s.releaseDate && s.releaseDate.precision !== 'unknown' ? s.releaseDate : null, s.evidence, ctx);
  addClaim(product, 'status', s.status, s.evidence, ctx);
  addClaim(product, 'image', s.image, s.evidence, ctx);
  addClaim(product, 'imageFallback', s.fallbackImage, s.evidence, ctx);
  if (ctx.tier === 'official') addClaim(product, 'officialUrl', ctx.url, s.evidence, ctx);
  if (ctx.publishedAt) addClaim(product, 'announcedAt', ctx.publishedAt.slice(0, 10), s.evidence, ctx);
  for (const d of s.draws) addClaim(product, 'draw', d, s.evidence, ctx);
  if (s.offer) {
    const offer: Offer = { ...s.offer, lastSeenAt: ctx.observedAt };
    product.offers = [...product.offers.filter((o) => o.url !== offer.url), offer];
  }
}

// ---------- Recalcul ----------

const byPriority = (a: Claim, b: Claim) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.observedAt.localeCompare(a.observedAt);

function resolve<T>(claims: Claim[], field: Claim['field']): T | null {
  const best = claims.filter((c) => c.field === field && !c.invalid).sort(byPriority)[0];
  return best ? (best.value as T) : null;
}

/** Date au plus tôt couverte par une date imprécise (pour savoir si elle est passée). */
export function fuzzyEnd(d: FuzzyDate): string {
  if (d.precision === 'day') return d.value;
  if (d.precision === 'month') return `${d.value}-31`;
  const q = /^(\d{4})-Q([1-4])$/.exec(d.value);
  return q ? `${q[1]}-${String(Number(q[2]) * 3).padStart(2, '0')}-31` : '9999-12-31';
}

/** Recalcule tous les champs affichés à partir des affirmations. */
export function recompute(product: Product, today: string): void {
  const claims = product.claims.filter((c) => !c.invalid);
  product.name = resolve<string>(claims, 'name') ?? product.name;
  product.set = resolve<string>(claims, 'set');
  product.type = resolve<ProductType>(claims, 'type') ?? 'other';
  product.msrp = resolve<Money>(claims, 'msrp');
  product.releaseDate = resolve<FuzzyDate>(claims, 'releaseDate');
  // Le visuel lui-même est recopié dans data/media par l'orchestrateur quand cette adresse change.
  product.imageSource = resolve<string>(claims, 'image') ?? resolve<string>(claims, 'imageFallback');
  product.officialUrl = resolve<string>(claims, 'officialUrl');
  product.announcedAt = claims.filter((c) => c.field === 'announcedAt').map((c) => String(c.value)).sort()[0] ?? null;
  product.reliability = claims.some((c) => c.tier === 'official') ? 'confirmed' : 'unconfirmed';

  // Tirages : ceux du niveau de source le plus fiable, une entrée par fenêtre.
  const drawClaims = claims.filter((c) => c.field === 'draw').sort(byPriority);
  const topTier = drawClaims[0]?.tier;
  const draws = new Map<string, Draw>();
  for (const c of drawClaims.filter((c) => c.tier === topTier).reverse()) {
    const d = c.value as Draw;
    const key = d.opensAt ?? d.closesAt ?? d.url ?? '';
    draws.set(key, { ...draws.get(key), ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null)) } as Draw);
  }
  product.draws = [...draws.values()].sort((a, b) => (a.opensAt ?? a.closesAt ?? '').localeCompare(b.opensAt ?? b.closesAt ?? ''));

  const stated = resolve<Status>(claims, 'status');
  const released = product.releaseDate?.precision === 'day' && product.releaseDate.value <= today;
  product.status =
    stated === 'cancelled' ? 'cancelled'
    : released || stated === 'released' ? 'released'
    : stated === 'preorder' ? 'preorder'
    : product.reliability === 'confirmed' ? 'announced'
    : 'rumor';
}
