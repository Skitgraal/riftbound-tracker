import { describe, expect, it } from 'vitest';
import { parisDate, parseTimestamp } from '../src/shared/time.ts';

describe('parseTimestamp', () => {
  it('lit le format Cardmarket avec un décalage sans deux-points', () => {
    expect(parseTimestamp('2026-11-13T02:44:34+0100').toISOString()).toBe('2026-11-13T01:44:34.000Z');
  });

  it('lit un ISO 8601 standard', () => {
    expect(parseTimestamp('2026-11-14T12:00:20+01:00').toISOString()).toBe('2026-11-14T11:00:20.000Z');
  });

  it('refuse une valeur illisible', () => {
    expect(() => parseTimestamp('pas une date')).toThrow('Horodatage illisible');
  });
});

describe('parisDate', () => {
  it('donne la date à Paris, pas la date UTC', () => {
    // 23:30 UTC le 13 = 00:30 le 14 à Paris (heure d'hiver)
    expect(parisDate('2026-11-13T23:30:00Z')).toBe('2026-11-14');
  });

  it('gère l\'heure d\'été', () => {
    // 22:30 UTC le 1er juillet = 00:30 le 2 à Paris (UTC+2)
    expect(parisDate('2026-07-01T22:30:00Z')).toBe('2026-07-02');
  });

  it('garde la date d\'un fichier Cardmarket', () => {
    expect(parisDate('2026-11-13T02:44:34+0100')).toBe('2026-11-13');
  });
});
