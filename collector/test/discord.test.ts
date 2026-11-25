import { describe, expect, it } from 'vitest';
import { isRelevant, messageDoc, messageText, type DiscordMessage } from '../src/watch/collectors/discord.ts';
import type { SourceConfig } from '../src/watch/types.ts';

const source: SourceConfig = { id: 'discord-relay', name: 'Discord', kind: 'discord', tier: 'leak', url: 'https://discord.com', enabled: true };
const msg = (over: Partial<DiscordMessage> = {}): DiscordMessage => ({
  id: '3',
  channel_id: '2',
  content: 'Leak: The Reckoning Booster Display preorders open December 5, MSRP $144',
  timestamp: '2026-11-25T10:00:00.000Z',
  author: { username: 'someone' },
  ...over,
});

describe('collecteur Discord', () => {
  it('garde les messages recopiés des salons suivis et ceux écrits à la main', () => {
    expect(isRelevant(msg({ webhook_id: 'w', flags: 2 }))).toBe(true); // salon d'annonces suivi
    expect(isRelevant(msg())).toBe(true); // collé à la main
  });

  it("ignore les alertes de l'outil (webhook) et les bots", () => {
    expect(isRelevant(msg({ webhook_id: 'w' }))).toBe(false);
    expect(isRelevant(msg({ author: { bot: true } }))).toBe(false);
  });

  it('lit le texte des embeds et construit un document avec lien vers le message', () => {
    const m = msg({ content: '', webhook_id: 'w', flags: 2, embeds: [{ title: 'Set 7 revealed', description: 'Booster display, champion decks', fields: [{ name: 'Release', value: 'Q1 2027' }] }] });
    expect(messageText(m)).toBe('Set 7 revealed\nBooster display, champion decks\nRelease: Q1 2027');
    const doc = messageDoc(m, '1', 'leaks', source)!;
    expect(doc.url).toBe('https://discord.com/channels/1/2/3');
    expect(doc.title).toBe('#leaks : Set 7 revealed');
    expect(doc.publishedAt).toBe('2026-11-25T10:00:00.000Z');
  });

  it('ignore les messages trop courts', () => {
    expect(messageDoc(msg({ content: 'gg' }), '1', 'x', source)).toBeNull();
  });
});
