import { describe, expect, it } from 'vitest';
import { dueReminders, reminderKey } from '../src/reminders/due.ts';
import { emptyProduct } from '../src/watch/products.ts';
import type { Draw } from '../src/watch/types.ts';

const H = 3_600_000;
const OPEN = Date.parse('2026-12-01T17:00:00Z');
const CLOSE = OPEN + 72 * H;
const draw: Draw = { opensAt: new Date(OPEN).toISOString(), closesAt: new Date(CLOSE).toISOString(), url: 'https://x/draw', region: null };
const product = () => Object.assign(emptyProduct('p', 'Produit', '2026-11-01T00:00:00Z'), { draws: [draw] });
const at = (ms: number) => new Date(ms);

/** Simule des passages successifs et renvoie les rappels envoyés. */
function simulate(times: number[], sent: Record<string, string> = {}) {
  const out: string[] = [];
  const p = product();
  for (const t of times) {
    for (const r of dueReminders([p], at(t), sent)) {
      out.push(r.kind);
      for (const k of r.keys) sent[k] = at(t).toISOString();
    }
  }
  return out;
}

describe('dueReminders', () => {
  it('rien avant l’ouverture ni après la fermeture', () => {
    expect(simulate([OPEN - H])).toEqual([]);
    expect(simulate([CLOSE + 1])).toEqual([]);
  });

  it('ouverture, 24 h et 2 h, une seule fois chacun, passages toutes les 15 min', () => {
    const times: number[] = [];
    for (let t = OPEN - H; t < CLOSE + H; t += 15 * 60_000) times.push(t);
    expect(simulate(times)).toEqual(['open', '24h', '2h']);
  });

  it('passage en retard : seulement le plus urgent', () => {
    expect(simulate([CLOSE - 90 * 60_000])).toEqual(['2h']);
    // Ouvert il y a moins de 12 h et fermeture dans 20 h : le rappel 24 h suffit
    const short: Draw = { ...draw, closesAt: new Date(OPEN + 23 * H).toISOString() };
    const p = Object.assign(emptyProduct('s', 'S', '2026-11-01T00:00:00Z'), { draws: [short] });
    const r = dueReminders([p], at(OPEN + 3 * H), {});
    expect(r.map((x) => x.kind)).toEqual(['24h']);
    expect(r[0]!.keys).toHaveLength(2);
  });

  it('ouverture déjà annoncée par la veille : pas de second message', () => {
    const p = product();
    const sent = { [`draw:${p.slug}:${draw.opensAt}`]: new Date(OPEN + 10 * 60_000).toISOString() };
    expect(dueReminders([p], at(OPEN + H), sent)).toEqual([]);
  });

  it('tirage sans date ou fiche annulée : aucun rappel', () => {
    const noDate = Object.assign(emptyProduct('n', 'N', '2026-11-01T00:00:00Z'), { draws: [{ opensAt: null, closesAt: null, url: 'u', region: null }] });
    const cancelled = Object.assign(product(), { status: 'cancelled' as const });
    expect(dueReminders([noDate, cancelled], at(OPEN + H), {})).toEqual([]);
  });

  it('clé stable par produit et par tirage', () => {
    expect(reminderKey('2h', product(), draw)).toBe(`reminder:2h:p:${draw.opensAt}`);
  });
});
