/**
 * Boutiques sous Shopify : liste JSON publique des produits d'une collection (`/collections/{handle}/products.json`).
 * Source structurée (nom, prix, stock, précommande, photos) : pas de LLM. Seul le scellé anglais est gardé.
 */
import { fetchJson } from '../../shared/http.ts';
import { classifyType, detectSet, isAccessory } from '../products.ts';
import type { Sighting, SourceConfig, Status } from '../types.ts';
import type { StructuredSighting } from './riot-merch.ts';

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type?: string;
  tags?: string[] | string;
  created_at?: string;
  variants: { title?: string; price: string; available?: boolean }[];
  images?: { src: string }[];
}

const SOLD_OUT_RELEASED_DAYS = 60;
const PAGE_SIZE = 250;
const MAX_PAGES = 4;

/** Autres langues que l'anglais (Riftbound existe aussi en chinois, français…). */
const FOREIGN = /\b(chn|cn|chinese|chinois|french|fran[cç]ais|fr|german|deutsch|de|japanese|jp|jpn|korean|kr|spanish|espa[nñ]ol|es|italian|it)\b/i;
const ENGLISH = /\b(english|englisch|ingl[eé]s|anglais|en|eng)\b/i;

/** Hors périmètre : lots de plusieurs boîtes, kits de boutique, accessoires, singles, événements. */
const EXCLUDED_TITLE = /\b(case|event kit|deck display|[2-9]\s*decks|bulk|tournaments?|singles|single player kit|sanctum box)\b|\s\+\s/i;
const EXCLUDED_TYPE = /sleeve|playmat|binder|deck ?box|accessor|event|single|tournament|case/i;

/** « [PREORDER] Riftbound: League of Legends TCG - Vendetta Booster Box (24 Packs) - EN » → « Vendetta Booster Display ». */
export function cleanRetailName(title: string): string {
  return title
    .replace(/\[(pre-?order|presale|reprint)\]/gi, ' ')
    .replace(/\b(pre-?order|presale)\b\s*:?/gi, ' ')
    .replace(/^\s*riftbound(?:\s+tcg)?\s*(?:[:\-–—]\s*|\s+(?=league))(?:league of legends(?:\s+(?:tcg|trading card game))?\s*[:\-–—]?\s*)?/i, '')
    .replace(/[\-–—]\s*league of legends( tcg)?\s*$/i, '')
    .replace(/\(\s*(\d+[^)]*|single player kit|en|eng|english)\s*\)/gi, ' ')
    .replace(/[\-–—]\s*(en|eng|english|englisch)\s*$/i, '')
    .replace(/[[\]()]/g, ' ')
    .replace(/\s[\-–—:]\s|:\s/g, ' ')
    .replace(/champion-deck/gi, 'Champion Deck')
    .replace(/champion deck showdown/gi, 'Showdown Deck')
    .replace(/booster (box )?display( box)?|booster box( display)?/gi, 'Booster Display')
    .replace(/\s+/g, ' ')
    .trim();
}

const tagsOf = (p: ShopifyProduct) => [p.tags ?? []].flat().join(',').split(',').map((t) => t.trim()).filter(Boolean);

/** Variante anglaise si la boutique vend plusieurs langues sous un même produit ; `null` = pas d'anglais. */
function englishVariant(p: ShopifyProduct): ShopifyProduct['variants'][number] | null {
  const labelled = p.variants.filter((v) => v.title && v.title !== 'Default Title');
  const english = labelled.find((v) => ENGLISH.test(v.title!));
  if (english) return english;
  if (labelled.some((v) => FOREIGN.test(v.title!))) return null;
  return p.variants[0] ?? null;
}

/** Transforme un produit Shopify en produit vu, ou `null` s'il est hors périmètre. */
export function shopifySighting(p: ShopifyProduct, source: SourceConfig, knownSets: string[], now = new Date()): StructuredSighting | null {
  if (!/riftbound/i.test(p.title) && !tagsOf(p).some((t) => /riftbound/i.test(t))) return null;
  if (EXCLUDED_TITLE.test(p.title) || EXCLUDED_TYPE.test(p.product_type ?? '') || isAccessory(p.title)) return null;
  // La langue étrangère se lit dans le titre (« - CHN », « - French ») ; les étiquettes mélangent souvent plusieurs langues.
  if (FOREIGN.test(p.title.replace(/riftbound.*?league of legends/i, ''))) return null;
  const variant = englishVariant(p);
  if (!variant) return null;

  const name = cleanRetailName(p.title);
  const type = classifyType(name);
  if (type === 'other' || !name) return null;

  const tags = tagsOf(p);
  const preorderSignal = /pre-?order|presale/i.test(p.title) || tags.some((t) => /^(pre-?order|presale|vorbestellung|preventa)$/i.test(t));
  const available = variant.available !== false;
  // Épuisé, sans étiquette de précommande, et en ligne depuis longtemps : il est sorti (et parti). Une fiche épuisée
  // récente peut au contraire être une annonce en attente de précommande : on ne conclut rien.
  const listedDays = p.created_at ? (now.getTime() - Date.parse(p.created_at)) / 86_400_000 : 0;
  const status: Status | null = available ? (preorderSignal ? 'preorder' : 'released') : !preorderSignal && listedDays > SOLD_OUT_RELEASED_DAYS ? 'released' : null;
  const price = Number(variant.price);
  const money = Number.isFinite(price) && price > 0 ? { amount: price, currency: source.currency ?? 'EUR' } : null;
  const origin = new URL(source.url).origin;
  const url = `${origin}/products/${p.handle}`;
  const image = p.images?.[0]?.src ? `${p.images[0].src}${p.images[0].src.includes('?') ? '&' : '?'}width=1200` : null;

  const sighting: Sighting = {
    name,
    set: detectSet(name, knownSets),
    type,
    // Le prix d'une boutique n'est pas le prix officiel : il ne va que dans l'offre.
    msrp: null,
    releaseDate: null,
    status,
    draws: [],
    image,
    evidence: [p.title, money ? `${money.amount} ${money.currency}` : null, preorderSignal ? 'précommande' : null, available ? 'disponible' : 'indisponible']
      .filter(Boolean)
      .join(' · '),
    offer: {
      source: source.id,
      url,
      price: money,
      availability: !available ? 'out_of_stock' : preorderSignal ? 'preorder' : 'in_stock',
    },
  };
  return { url, sighting };
}

export async function collectShopify(source: SourceConfig, knownSets: string[]): Promise<StructuredSighting[]> {
  const origin = new URL(source.url).origin;
  const byId = new Map<number, ShopifyProduct>();
  for (const handle of source.collections ?? []) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { products } = await fetchJson<{ products: ShopifyProduct[] }>(`${origin}/collections/${handle}/products.json?limit=${PAGE_SIZE}&page=${page}`);
      for (const p of products) byId.set(p.id, p);
      if (products.length < PAGE_SIZE) break;
    }
  }
  return [...byId.values()].flatMap((p) => shopifySighting(p, source, knownSets) ?? []);
}
