/**
 * Salons Discord de TON serveur, lus par un bot (API officielle, gratuite). On y « suit » les salons d'annonces des
 * serveurs communautaires Riftbound : Discord recopie leurs messages chez toi, et le bot les lit. Lire un serveur tiers
 * avec un compte utilisateur est interdit ; ce montage-ci est autorisé.
 *
 * Messages gardés : ceux recopiés depuis un salon suivi, et ceux écrits à la main (coller un leak dans un salon suffit).
 * Messages ignorés : ceux des bots et des webhooks, donc les alertes de l'outil lui-même.
 */
import { USER_AGENT } from '../../shared/http.ts';
import type { Doc, SourceConfig } from '../types.ts';

const API = 'https://discord.com/api/v10';
const TEXT_CHANNEL_TYPES = new Set([0, 5]); // texte, annonces
const IS_CROSSPOST = 1 << 1;
const PER_CHANNEL = 50;

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
  flags?: number;
  webhook_id?: string;
  author?: { bot?: boolean; username?: string };
  embeds?: { title?: string; description?: string; url?: string; fields?: { name: string; value: string }[]; image?: { url: string }; thumbnail?: { url: string } }[];
  attachments?: { url: string; content_type?: string }[];
}

class DiscordError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, token: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      // Discord exige ce format de User-Agent pour les bots.
      headers: { authorization: `Bot ${token}`, 'user-agent': `DiscordBot (https://github.com/Skitgraal/riftbound-tracker, 1.0) ${USER_AGENT}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429 && attempt < 3) {
      const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
      await new Promise((r) => setTimeout(r, Math.ceil((body.retry_after ?? 2) * 1000)));
      continue;
    }
    if (!response.ok) throw new DiscordError(`Discord ${path} : HTTP ${response.status}`, response.status);
    return (await response.json()) as T;
  }
}

/** Message utile à la veille ? (recopié d'un salon suivi, ou écrit par une personne) */
export function isRelevant(m: DiscordMessage): boolean {
  const crossposted = ((m.flags ?? 0) & IS_CROSSPOST) !== 0;
  if (crossposted) return true;
  return !m.webhook_id && !m.author?.bot;
}

/** Texte complet d'un message : contenu, puis titres, descriptions et champs des embeds. */
export function messageText(m: DiscordMessage): string {
  const parts = [m.content];
  for (const e of m.embeds ?? []) {
    parts.push(e.title ?? '', e.description ?? '', ...(e.fields ?? []).map((f) => `${f.name}: ${f.value}`), e.url ?? '');
  }
  return parts.map((p) => p.trim()).filter(Boolean).join('\n');
}

export function messageDoc(m: DiscordMessage, guildId: string, channelName: string, source: SourceConfig): Doc | null {
  if (!isRelevant(m)) return null;
  const text = messageText(m);
  if (text.length < 20) return null;
  const image =
    m.attachments?.find((a) => a.content_type?.startsWith('image/'))?.url ?? m.embeds?.find((e) => e.image || e.thumbnail)?.image?.url ?? null;
  const firstLine = text.split('\n')[0]!.slice(0, 90);
  return {
    source,
    url: `https://discord.com/channels/${guildId}/${m.channel_id}/${m.id}`,
    title: `#${channelName} : ${firstLine}`,
    publishedAt: m.timestamp,
    text,
    image,
    full: true,
  };
}

/** Lit les derniers messages de tous les salons texte que le bot voit. Sans jeton : source inactive (renvoie null). */
export async function collectDiscord(source: SourceConfig): Promise<Doc[] | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;
  const exclude = new Set((source.exclude_channels ?? []).map((c) => c.toLowerCase()));
  const docs: Doc[] = [];
  const guilds = await api<{ id: string }[]>('/users/@me/guilds', token);
  for (const guild of guilds) {
    const channels = await api<{ id: string; name: string; type: number }[]>(`/guilds/${guild.id}/channels`, token);
    for (const channel of channels.filter((c) => TEXT_CHANNEL_TYPES.has(c.type) && !exclude.has(c.name.toLowerCase()))) {
      let messages: DiscordMessage[];
      try {
        messages = await api<DiscordMessage[]>(`/channels/${channel.id}/messages?limit=${PER_CHANNEL}`, token);
      } catch (error) {
        // Salon que le bot n'a pas le droit de lire : on l'ignore.
        if (error instanceof DiscordError && error.status === 403) continue;
        throw error;
      }
      for (const m of messages) {
        const doc = messageDoc(m, guild.id, channel.name, source);
        if (doc) docs.push(doc);
      }
    }
  }
  return docs;
}
