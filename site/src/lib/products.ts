/** Fiches produit (Module 1) : types, libellés et calculs d'affichage. */
import { useData } from './data.ts';

export type Status = 'rumor' | 'announced' | 'preorder' | 'released' | 'cancelled';
export type ProductType = 'display' | 'booster' | 'box_exclusive' | 'deck' | 'bundle' | 'draw_product' | 'other';
export type Tier = 'official' | 'relay' | 'leak';

export interface Money {
  amount: number;
  currency: string;
}
export interface FuzzyDate {
  value: string;
  precision: 'day' | 'month' | 'quarter' | 'unknown';
}
export interface Draw {
  opensAt: string | null;
  closesAt: string | null;
  url: string | null;
  region: string | null;
}
export interface Offer {
  source: string;
  url: string;
  price: Money | null;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
  lastSeenAt: string;
}
export interface Claim {
  field: string;
  value: unknown;
  source: string;
  tier: Tier;
  url: string;
  evidence: string;
  observedAt: string;
}

export interface ProductSummary {
  slug: string;
  name: string;
  set: string | null;
  type: ProductType;
  language: 'EN';
  msrp: Money | null;
  announcedAt: string | null;
  releaseDate: FuzzyDate | null;
  status: Status;
  reliability: 'confirmed' | 'unconfirmed';
  image: string | null;
  officialUrl: string | null;
  possibleDuplicateOf: string | null;
  draws: Draw[];
  offers: Offer[];
  createdAt: string;
  updatedAt: string;
  market: { id: number; trend: number | null; low: number | null } | null;
  sources?: number;
}

export interface ProductFull extends ProductSummary {
  claims: Claim[];
  sourceNames: Record<string, string>;
}

export const useProducts = () => useData<ProductSummary[]>('products.json');

export const STATUS_LABELS: Record<Status, string> = {
  rumor: 'Rumeur',
  announced: 'Annoncé',
  preorder: 'Précommande',
  released: 'Sorti',
  cancelled: 'Annulé',
};

export const TYPE_LABELS: Record<ProductType, string> = {
  display: 'Display',
  booster: 'Booster',
  box_exclusive: 'Box exclusive',
  deck: 'Deck',
  bundle: 'Bundle',
  draw_product: 'Produit à tirage',
  other: 'Autre',
};

export const TIER_LABELS: Record<Tier, string> = { official: 'Officiel', relay: 'Relais', leak: 'Leak' };

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 23 oct. 2026 », « mars 2027 », « T1 2027 », « Date à venir ». */
export function fuzzyLabel(d: FuzzyDate | null, long = false): string {
  if (!d) return 'Date à venir';
  const [y, m, day] = d.value.split('-');
  const month = (long ? MONTHS_LONG : MONTHS)[Number(m) - 1];
  if (d.precision === 'day') return `${Number(day)} ${month} ${y}`;
  if (d.precision === 'month') return `${month} ${y}`;
  if (d.precision === 'quarter') return `T${d.value.slice(-1)} ${y}`;
  return 'Date à venir';
}

/** Date la plus tôt possible d'une date imprécise, pour trier. */
export function fuzzySortKey(d: FuzzyDate | null): string {
  if (!d) return '9999';
  if (d.precision === 'quarter') return `${d.value.slice(0, 4)}-${String((Number(d.value.slice(-1)) - 1) * 3 + 1).padStart(2, '0')}`;
  return d.value;
}

export const money = (m: Money | null | undefined): string =>
  m ? m.amount.toLocaleString('fr-FR', { style: 'currency', currency: m.currency }) : '—';

export const imageUrl = (p: { image: string | null }): string | null => (p.image ? `./data/${p.image}` : null);

/** Monogramme du set pour le visuel de remplacement : « Radiance » → « RA ». */
export function monogram(p: Pick<ProductSummary, 'set' | 'name'>): string {
  const base = p.set ?? p.name.replace(/^riftbound\s*x?\s*/i, '');
  return base.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'RB';
}

/** Teinte de fond stable par set (4 teintes sombres du design). */
export function artTint(p: Pick<ProductSummary, 'set' | 'name'>): string {
  const key = p.set ?? p.name;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ['#141A26', '#1A1626', '#121F1F', '#201A14'][h % 4]!;
}

export const RIOT_STORE_URL = 'https://merch.riotgames.com/en-us/category/riftbound/';

/** Page du produit sur la boutique Riot s'il y est, sinon la catégorie Riftbound de la boutique. */
export const riotStoreUrl = (p: Pick<ProductSummary, 'offers'>): string => p.offers.find((o) => o.source === 'riot-merch')?.url ?? RIOT_STORE_URL;

/** Lien d'inscription d'un tirage : celui donné par Riot, sinon la page du produit sur la boutique Riot, sinon l'annonce. */
export const drawSignupUrl = (p: Pick<ProductSummary, 'offers' | 'officialUrl'>, d: Draw): string =>
  d.url ?? p.offers.find((o) => o.source === 'riot-merch')?.url ?? p.officialUrl ?? RIOT_STORE_URL;

export type DrawState = 'open' | 'upcoming' | 'closed';

export function drawState(d: Draw, now = Date.now()): DrawState {
  if (d.closesAt && Date.parse(d.closesAt) <= now) return 'closed';
  // Fermeture inconnue : un tirage Riot dure quelques jours ; ouvert depuis plus de 7 jours, il est fini.
  if (!d.closesAt && d.opensAt && now - Date.parse(d.opensAt) > 7 * 86_400_000) return 'closed';
  if (d.opensAt && Date.parse(d.opensAt) > now) return 'upcoming';
  // Ouvert seulement si une date le prouve ; un simple lien d'inscription sans dates reste « à venir ».
  return d.opensAt || d.closesAt ? 'open' : 'upcoming';
}

/** Tirage le plus pertinent d'un produit : ouvert, sinon le prochain. */
export function currentDraw(p: ProductSummary, now = Date.now()): { draw: Draw; state: DrawState } | undefined {
  const states = p.draws.map((draw) => ({ draw, state: drawState(draw, now) }));
  return states.find((s) => s.state === 'open') ?? states.find((s) => s.state === 'upcoming');
}

/** « 25 nov. à 08:59 » en heure de Paris. */
export function instantLabel(iso: string | null): string {
  if (!iso) return '?';
  const d = new Date(iso);
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  return `${date} à ${time}`;
}

/**
 * Fichier d'agenda (.ics) pour la fermeture d'un tirage, avec une alarme 2 h avant :
 * un filet de sécurité en plus des rappels Discord.
 */
export function drawIcsUrl(p: Pick<ProductSummary, 'name' | 'slug'>, d: Draw): string | null {
  if (!d.closesAt) return null;
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = Date.parse(d.closesAt);
  const text = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Riftbound Tracker//FR',
    'BEGIN:VEVENT',
    `UID:${p.slug}-${stamp(end)}@riftbound-tracker`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(end - 30 * 60_000)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(`Fermeture du tirage : ${p.name}`)}`,
    ...(d.url ? [`URL:${d.url}`, `DESCRIPTION:${text(`Inscription : ${d.url}`)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text(`Tirage ${p.name} : fermeture dans 2 h`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

/** Temps restant découpé en jours / heures / minutes. */
export function remaining(iso: string, now = Date.now()): { d: number; h: number; m: number } {
  const ms = Math.max(0, Date.parse(iso) - now);
  return { d: Math.floor(ms / 86_400_000), h: Math.floor(ms / 3_600_000) % 24, m: Math.floor(ms / 60_000) % 60 };
}
