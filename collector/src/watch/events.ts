/** Ce qui a changé sur une fiche, et le message Discord correspondant. */
import { COLORS, type Channel, type Embed } from '../alerts/discord.ts';
import type { Draw, FuzzyDate, Money, Product } from './types.ts';

export const SITE_URL = 'https://skitgraal.github.io/riftbound-tracker/';
export const RIOT_STORE_URL = 'https://merch.riotgames.com/en-us/category/riftbound/';

/** Page du produit sur la boutique Riot s'il y est, sinon la catégorie Riftbound. */
export const riotStoreUrl = (p: Product): string => p.offers.find((o) => o.source === 'riot-merch')?.url ?? RIOT_STORE_URL;

/** Lien d'inscription : celui donné par Riot, sinon la page du produit sur la boutique Riot, sinon l'annonce. */
export const drawSignupUrl = (p: Product, d: Draw): string =>
  d.url ?? p.offers.find((o) => o.source === 'riot-merch')?.url ?? p.officialUrl ?? RIOT_STORE_URL;

export interface ChangeEvent {
  /** Clé d'unicité : la même alerte ne part jamais deux fois. */
  key: string;
  channel: Channel;
  title: string;
  detail?: string;
  product: Product;
  /** Tirage concerné (alertes de tirage) : sert au lien d'inscription. */
  draw?: Draw;
}

const TYPE_LABELS: Record<Product['type'], string> = {
  display: 'Display',
  booster: 'Booster',
  box_exclusive: 'Box exclusive',
  deck: 'Deck',
  bundle: 'Bundle',
  draw_product: 'Produit à tirage',
  other: 'Autre',
};

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function formatFuzzyDate(d: FuzzyDate | null): string {
  if (!d) return 'date inconnue';
  const [y, m, day] = d.value.split('-');
  if (d.precision === 'day') return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`;
  if (d.precision === 'month') return `${MONTHS[Number(m) - 1]} ${y}`;
  if (d.precision === 'quarter') return `${d.value.slice(5)} ${y}`.replace('Q', 'T');
  return 'date inconnue';
}

export const formatMoney = (m: Money | null) =>
  m ? m.amount.toLocaleString('fr-FR', { style: 'currency', currency: m.currency }) : '—';

/** Date-heure en heure de Paris : « 13 nov. 18:00 ». */
export function formatInstant(iso: string | null): string {
  if (!iso) return '?';
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}

const drawKey = (d: Draw) => d.opensAt ?? d.closesAt ?? d.url ?? '';

export function describeChanges(old: Product | undefined, p: Product, now: Date): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  const confirmed = p.reliability === 'confirmed';

  // Un produit tiré d'un vieil article (historique lu après coup) n'est pas une nouveauté.
  const stale = p.announcedAt !== null && now.getTime() - Date.parse(p.announcedAt) > 30 * 86_400_000;
  if (!old && !stale) {
    events.push({
      key: `product-new:${p.slug}`,
      channel: 'feed',
      title: `${confirmed ? 'Nouveau produit' : 'Leak'} : ${p.name}`,
      detail: p.possibleDuplicateOf ? `Doublon possible de « ${p.possibleDuplicateOf} ».` : undefined,
      product: p,
    });
  } else if (old) {
    if (old.reliability !== 'confirmed' && confirmed) {
      events.push({ key: `confirmed:${p.slug}`, channel: 'feed', title: `Confirmé par Riot : ${p.name}`, product: p });
    }
    if (old.releaseDate && JSON.stringify(old.releaseDate) !== JSON.stringify(p.releaseDate)) {
      events.push({
        key: `date:${p.slug}:${p.releaseDate?.value ?? 'none'}`,
        channel: 'feed',
        title: `Date modifiée : ${p.name}`,
        detail: `${formatFuzzyDate(old.releaseDate)} → ${formatFuzzyDate(p.releaseDate)}`,
        product: p,
      });
    }
    if (old.msrp && p.msrp && old.msrp.amount !== p.msrp.amount) {
      events.push({
        key: `msrp:${p.slug}:${p.msrp.amount}`,
        channel: 'feed',
        title: `Prix officiel modifié : ${p.name}`,
        detail: `${formatMoney(old.msrp)} → ${formatMoney(p.msrp)}`,
        product: p,
      });
    }
  }

  if (p.status === 'preorder' && old?.status !== 'preorder') {
    events.push({ key: `preorder:${p.slug}`, channel: 'critical', title: `Précommande ouverte : ${p.name}`, product: p });
  }

  const known = new Set((old?.draws ?? []).map(drawKey));
  for (const d of p.draws) {
    if (known.has(drawKey(d))) continue;
    if (d.closesAt && Date.parse(d.closesAt) < now.getTime()) continue; // déjà terminé
    if (!d.closesAt && d.opensAt && now.getTime() - Date.parse(d.opensAt) > 7 * 86_400_000) continue; // fin inconnue, mais ancien
    const open = d.opensAt && Date.parse(d.opensAt) <= now.getTime();
    events.push({
      key: `draw:${p.slug}:${drawKey(d)}`,
      channel: 'critical',
      title: `${open ? 'Tirage ouvert' : 'Tirage annoncé'} : ${p.name}`,
      detail: `Inscriptions ${d.opensAt ? `du ${formatInstant(d.opensAt)}` : ''} ${d.closesAt ? `au ${formatInstant(d.closesAt)}` : ''} (heure de Paris)${d.region ? ` · ${d.region}` : ''}`.replace(/\s+/g, ' '),
      product: p,
      draw: d,
    });
  }
  return events;
}

export function productEmbed(e: ChangeEvent): Embed {
  const p = e.product;
  return {
    title: e.title,
    url: `${SITE_URL}#/produit/${p.slug}`,
    description: [e.detail, p.reliability === 'confirmed' ? null : 'Non confirmé par Riot.'].filter(Boolean).join('\n') || undefined,
    color: e.channel === 'critical' ? COLORS.urgent : COLORS.accent,
    fields: [
      { name: 'Type', value: `${TYPE_LABELS[p.type]}${p.set ? ` · ${p.set}` : ''}`, inline: true },
      { name: 'Sortie', value: formatFuzzyDate(p.releaseDate), inline: true },
      { name: 'Prix officiel', value: formatMoney(p.msrp), inline: true },
      {
        name: 'Liens',
        value: [
          ...(e.draw ? [`[${e.draw.url ? "S'inscrire au tirage" : "Voir l'annonce du tirage"}](${drawSignupUrl(p, e.draw)})`] : []),
          ...(p.officialUrl && !e.draw ? [`[Annonce officielle](${p.officialUrl})`] : []),
          `[Boutique Riot](${riotStoreUrl(p)})`,
        ].join(' · '),
      },
    ],
    ...(p.imageSource ? { thumbnail: { url: p.imageSource } } : {}),
  };
}
