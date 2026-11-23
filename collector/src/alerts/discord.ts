import { USER_AGENT } from '../shared/http.ts';

export type Channel = 'critical' | 'feed';

const WEBHOOK_ENV: Record<Channel, string> = {
  critical: 'DISCORD_WEBHOOK_CRITICAL',
  feed: 'DISCORD_WEBHOOK_FEED',
};

/** Couleurs des embeds, reprises du design. */
export const COLORS = {
  accent: 0x4fd1c5,
  urgent: 0xffcb6b,
  down: 0xff9b7a,
  system: 0x9aa3b5,
} as const;

export interface Embed {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  thumbnail?: { url: string };
  image?: { url: string };
  timestamp?: string;
}

/**
 * Envoie des embeds dans un salon. Sans webhook configuré (secret absent), n'envoie rien et le signale :
 * l'outil fonctionne avant que les secrets soient en place.
 * Renvoie true si le message est parti.
 */
export async function sendDiscord(channel: Channel, embeds: Embed[]): Promise<boolean> {
  const url = process.env[WEBHOOK_ENV[channel]];
  if (!url) {
    console.warn(`[discord] ${WEBHOOK_ENV[channel]} absent : ${embeds.length} message(s) non envoyé(s)`);
    for (const e of embeds) console.warn(`  - ${e.title}`);
    return false;
  }
  // Discord accepte 10 embeds par message.
  for (let i = 0; i < embeds.length; i += 10) {
    const batch = embeds.slice(i, i + 10);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
        body: JSON.stringify({ username: 'Riftbound Tracker', embeds: batch }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) break;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '2');
        await new Promise((r) => setTimeout(r, Math.ceil(retryAfter * 1000)));
        continue;
      }
      throw new Error(`Discord a refusé le message (HTTP ${response.status})`);
    }
  }
  return true;
}
