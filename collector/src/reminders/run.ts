/**
 * Rappels de tirage — workflow `reminders`, toutes les 15 min. Envoie dans #alertes-critiques ce qui est dû.
 * REMINDERS_TEST=1 : rejoue un tirage fictif à trois instants (ouverture, 24 h, 2 h) sans rien enregistrer.
 */
import { readdir } from 'node:fs/promises';
import { COLORS, sendDiscord, type Embed } from '../alerts/discord.ts';
import { loadSent } from '../alerts/sent.ts';
import { readJson, repoPath, writeJson } from '../shared/fs.ts';
import { formatInstant, formatMoney, SITE_URL } from '../watch/events.ts';
import { emptyProduct } from '../watch/products.ts';
import type { Product } from '../watch/types.ts';
import { dueReminders, type Reminder } from './due.ts';

const PRODUCTS_DIR = repoPath('data/products');
const REMINDERS_FILE = repoPath('data/reminders.json');

interface RemindersFile {
  /** Clé de rappel → date d'envoi. */
  sent: Record<string, string>;
  lastSentAt?: string;
}

async function loadProducts(): Promise<Product[]> {
  let files: string[] = [];
  try {
    files = (await readdir(PRODUCTS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const products = await Promise.all(files.map((f) => readJson<Product | null>(`${PRODUCTS_DIR}/${f}`, null)));
  return products.filter((p): p is Product => p !== null);
}

/** « 1 j 4 h », « 1 h 55 min ». */
function remainingLabel(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((Date.parse(iso) - now.getTime()) / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return d > 0 ? `${d} j ${h} h` : h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

const TITLES: Record<Reminder['kind'], string> = {
  open: 'Tirage ouvert',
  '24h': 'Tirage : plus que 24 h',
  '2h': 'Tirage : dernières 2 h',
};

export function reminderEmbed(r: Reminder, now: Date, prefix = ''): Embed {
  const { product: p, draw: d } = r;
  const signup = d.url ?? p.officialUrl ?? `${SITE_URL}#/produit/${p.slug}`;
  const lines = [
    d.closesAt ? `Fermeture le **${formatInstant(d.closesAt)}** (heure de Paris), dans **${remainingLabel(d.closesAt, now)}**.` : 'Date de fermeture inconnue.',
    `[S'inscrire au tirage](${signup}) · [Fiche](${SITE_URL}#/produit/${p.slug})`,
    p.reliability === 'confirmed' ? null : 'Non confirmé par Riot.',
  ];
  return {
    title: `${prefix}${TITLES[r.kind]} : ${p.name}`,
    url: signup,
    description: lines.filter(Boolean).join('\n'),
    color: r.kind === 'open' ? COLORS.urgent : COLORS.down,
    fields: [
      { name: 'Prix officiel', value: formatMoney(p.msrp), inline: true },
      ...(d.region ? [{ name: 'Région', value: d.region, inline: true }] : []),
    ],
    ...(p.imageSource ? { thumbnail: { url: p.imageSource } } : {}),
  };
}

/** Rejoue un tirage fictif : ouverture maintenant, fermeture dans 48 h ; puis 23 h et 1 h 30 avant la fermeture. */
async function runTest(now: Date): Promise<void> {
  const fake = emptyProduct('test-tirage', 'Produit fictif (test)', now.toISOString());
  const opensAt = new Date(now.getTime() - 60_000).toISOString();
  const closesAt = new Date(now.getTime() + 48 * 3_600_000).toISOString();
  fake.draws = [{ opensAt, closesAt, url: SITE_URL, region: 'Test' }];
  fake.msrp = { amount: 80, currency: 'USD' };
  const sent: Record<string, string> = {};
  const closes = Date.parse(closesAt);
  for (const at of [now, new Date(closes - 23 * 3_600_000), new Date(closes - 90 * 60_000)]) {
    const due = dueReminders([fake], at, sent);
    for (const r of due) {
      for (const k of r.keys) sent[k] = at.toISOString();
      console.log(`- ${at.toISOString()} : ${r.kind}`);
      await sendDiscord('critical', [reminderEmbed(r, at, '[TEST] ')]);
    }
  }
  // Une fois tout envoyé, plus rien n'est dû, même à 10 min de la fin.
  if (dueReminders([fake], new Date(closes - 10 * 60_000), sent).length > 0) throw new Error('rappel en double');
}

async function main(): Promise<void> {
  const now = new Date();
  if (process.env.REMINDERS_TEST === 'true' || process.env.REMINDERS_TEST === '1') {
    await runTest(now);
    return;
  }
  const products = await loadProducts();
  // Fichier propre aux rappels : jamais de conflit avec la veille et les prix, qui écrivent alerts.json et status.json.
  const file = await readJson<RemindersFile>(REMINDERS_FILE, { sent: {} });
  const due = dueReminders(products, now, { ...(await loadSent()), ...file.sent });
  let delivered = 0;
  for (const r of due) {
    if (await sendDiscord('critical', [reminderEmbed(r, now)]).catch((e) => (console.error(e), false))) {
      for (const k of r.keys) file.sent[k] = now.toISOString();
      delivered++;
    }
  }
  const open = products.flatMap((p) => p.draws).filter((d) => d.closesAt && Date.parse(d.closesAt) > now.getTime()).length;
  // On n'écrit que si un rappel est parti : sinon un commit toutes les 15 min pour rien.
  if (delivered) {
    const cutoff = now.getTime() - 180 * 86_400_000;
    file.sent = Object.fromEntries(Object.entries(file.sent).filter(([, at]) => Date.parse(at) >= cutoff).sort(([a], [b]) => a.localeCompare(b)));
    file.lastSentAt = now.toISOString();
    await writeJson(REMINDERS_FILE, file);
  }
  console.log(`- tirages à venir ou ouverts : ${open}, rappels envoyés : ${due.length}`);
}

await main();
