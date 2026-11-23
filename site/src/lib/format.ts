/** Formats d'affichage : euros, pourcentages signés, dates en heure de Paris. */

const euroFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const pctFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const euro = (v: number | null | undefined): string => (v == null ? '—' : euroFormat.format(v));

/** « +4,2 % », « −1,3 % » (vrai signe moins), « 0,0 % », « — » si inconnu. */
export function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  const rounded = Math.round(v * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${pctFormat.format(Math.abs(rounded))} %`;
}

export type Direction = 'up' | 'down' | 'flat';

export function direction(v: number | null | undefined): Direction {
  if (v == null) return 'flat';
  const rounded = Math.round(v * 10) / 10;
  return rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
}

/** Date calendaire « AAAA-MM-JJ » → « 23 nov. » (ou « 23 nov. 2026 » avec l'année). */
export function day(date: string | null | undefined, withYear = false): string {
  if (!date) return '—';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

/** Horodatage (ISO, ou format Cardmarket « 2026-11-23T02:46:10+0100 ») → heure de Paris. */
export function parseInstant(value: string): Date {
  return new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return parseInstant(value).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
}

/** « il y a 3 h », « il y a 2 j ». */
export function ago(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '—';
  const minutes = Math.max(0, Math.round((now - parseInstant(value).getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

export function hoursSince(value: string | null | undefined, now = Date.now()): number {
  return value ? (now - parseInstant(value).getTime()) / 3_600_000 : Infinity;
}
