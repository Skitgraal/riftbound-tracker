/**
 * Rappels de tirage : à l'ouverture, 24 h avant la fermeture, 2 h avant la fermeture.
 * Fonction pure : le passage (toutes les 15 min, parfois en retard sur GitHub) envoie ce qui est dû et pas encore parti.
 */
import type { Draw, Product } from '../watch/types.ts';

export type ReminderKind = 'open' | '24h' | '2h';

export interface Reminder {
  /** Rappel le plus urgent à envoyer pour ce tirage. */
  kind: ReminderKind;
  /** Clés à marquer envoyées : celle du rappel, plus celles des rappels moins urgents dépassés dans la foulée. */
  keys: string[];
  product: Product;
  draw: Draw;
}

const HOUR = 3_600_000;
/** Au-delà, l'ouverture est trop ancienne pour être annoncée comme une nouvelle (la veille l'a déjà signalée). */
const OPEN_GRACE = 12 * HOUR;

export const drawKey = (d: Draw): string => d.opensAt ?? d.closesAt ?? d.url ?? '';
export const reminderKey = (kind: ReminderKind, p: Product, d: Draw): string => `reminder:${kind}:${p.slug}:${drawKey(d)}`;

export function dueReminders(products: Product[], now: Date, sent: Record<string, string>): Reminder[] {
  const t = now.getTime();
  const out: Reminder[] = [];
  for (const product of products) {
    if (product.status === 'cancelled') continue;
    for (const draw of product.draws) {
      const opens = draw.opensAt ? Date.parse(draw.opensAt) : null;
      const closes = draw.closesAt ? Date.parse(draw.closesAt) : null;
      if (closes !== null && closes <= t) continue; // terminé
      const isOpen = opens === null ? closes !== null : opens <= t;
      if (!isOpen) continue;
      const left = closes === null ? Infinity : closes - t;

      // Du plus urgent au moins urgent : un passage en retard n'envoie que le plus pressant.
      const due: ReminderKind[] = [];
      if (left <= 2 * HOUR) due.push('2h');
      if (left <= 24 * HOUR) due.push('24h');
      if (opens !== null && t - opens < OPEN_GRACE) due.push('open');
      // La veille a peut-être déjà annoncé « Tirage ouvert » en découvrant le tirage après son ouverture.
      const announcedOpen = sent[`draw:${product.slug}:${drawKey(draw)}`];
      const isSent = (k: ReminderKind) =>
        Boolean(sent[reminderKey(k, product, draw)]) || (k === 'open' && opens !== null && announcedOpen !== undefined && Date.parse(announcedOpen) >= opens);
      const pending = due.filter((k) => !isSent(k));
      if (pending.length === 0) continue;
      // 24 h ou 2 h déjà parti : on ne revient pas à un rappel moins urgent.
      const firstSent = due.findIndex(isSent);
      const kind = pending[0]!;
      if (firstSent !== -1 && firstSent < due.indexOf(kind)) continue;
      out.push({ kind, keys: due.slice(due.indexOf(kind)).map((k) => reminderKey(k, product, draw)), product, draw });
    }
  }
  return out;
}
