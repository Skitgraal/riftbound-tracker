/** Fuseau de référence du projet : toutes les dates affichées et les dates de relevé sont en heure de Paris. */
export const PARIS_TZ = 'Europe/Paris';

const parisDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Date calendaire (AAAA-MM-JJ) à Paris pour un instant donné.
 * Accepte les horodatages Cardmarket, de la forme `2026-11-13T02:44:34+0100`.
 */
export function parisDate(instant: string | Date): string {
  const date = typeof instant === 'string' ? parseTimestamp(instant) : instant;
  return parisDateFormat.format(date);
}

/** Lit un horodatage ISO 8601, y compris un décalage sans deux-points (`+0100`), que `Date` ne garantit pas. */
export function parseTimestamp(value: string): Date {
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Horodatage illisible : ${value}`);
  }
  return date;
}
