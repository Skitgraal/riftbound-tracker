/**
 * Veille des sorties — lancée par le workflow `watch` toutes les 2 h.
 * collecte → nouveauté → tri par mots-clés → extraction → fusion dans les fiches → visuels → alertes.
 * Une source en panne n'arrête pas les autres ; un LLM indisponible ne fait rien perdre (file d'attente + alerte « à lire »).
 */
import { createHash } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { COLORS, sendDiscord, type Channel, type Embed } from '../alerts/discord.ts';
import { loadSent, saveSent } from '../alerts/sent.ts';
import { loadSources, loadWatchSettings } from '../shared/config.ts';
import { readJson, repoPath, writeJson } from '../shared/fs.ts';
import { recordJob, type JobStatus } from '../shared/status.ts';
import { parisDate } from '../shared/time.ts';
import { collectRiotMerch } from './collectors/riot-merch.ts';
import { collectRiotNews, loadArticleBody } from './collectors/riot-news.ts';
import { collectShopify } from './collectors/shopify.ts';
import { collectDiscord } from './collectors/discord.ts';
import { ExtractionError, extractProducts, pauseBetweenExtractions } from './extract.ts';
import { storeImage } from './media.ts';
import { applySighting, consolidate, detectSet, emptyProduct, findMatch, recompute, slugOf } from './products.ts';
import type { Doc, Product, Sighting, SourceConfig, Tier } from './types.ts';
import { describeChanges, productEmbed, type ChangeEvent } from './events.ts';

const PRODUCTS_DIR = repoPath('data/products');
const SEEN = repoPath('data/seen.json');
const PENDING = repoPath('data/pending.json');
const MEDIA_DIR = repoPath('data/media');
const MAX_ATTEMPTS = 10;
const OFFER_RETENTION_DAYS = 21;
const SEEN_RETENTION_DAYS = 365;

interface SeenEntry {
  hash: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface Pending {
  url: string;
  source: string;
  title: string;
  publishedAt: string | null;
  text: string;
  image: string | null;
  full?: boolean;
  attempts: number;
  firstSeenAt: string;
  lastError?: string;
  /** L'alerte « à lire » est déjà partie. */
  alerted?: boolean;
}

const hash = (text: string) => createHash('sha1').update(text).digest('hex');

async function loadProducts(): Promise<Map<string, Product>> {
  const products = new Map<string, Product>();
  let files: string[] = [];
  try {
    files = (await readdir(PRODUCTS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    /* premier passage */
  }
  for (const f of files) {
    const p = await readJson<Product | null>(`${PRODUCTS_DIR}/${f}`, null);
    if (p) products.set(p.slug, p);
  }
  return products;
}

function matchesKeywords(doc: Doc, keywords: string[], knownSets: string[]): boolean {
  const text = doc.text.toLowerCase();
  return [...keywords, ...knownSets].some((k) => text.includes(k.toLowerCase()));
}

async function main(): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = parisDate(now);
  const settings = await loadWatchSettings();
  const sources = (await loadSources<SourceConfig>()).filter((s) => s.enabled !== false);
  const knownSets = [...new Set([...Object.values(await readJson<Record<string, string>>(repoPath('data/prices/expansions.json'), {})), ...settings.extra_sets])];
  const products = await loadProducts();
  // Fiches devenues identiques avec les règles de rapprochement actuelles : fusionnées sans alerte.
  const dirty = new Set<string>();
  const merged = consolidate(products);
  for (const slug of merged) {
    const file = `${PRODUCTS_DIR}/${slug}.json`;
    const old = await readJson<Product | null>(file, null);
    if (old?.image) await rm(repoPath('data', old.image), { force: true });
    await rm(file, { force: true });
  }
  if (merged.length) for (const p of products.values()) dirty.add(p.slug);
  const before = new Map([...products].map(([slug, p]) => [slug, structuredClone(p)]));
  const seen = await readJson<Record<string, SeenEntry>>(SEEN, {});
  let pending = await readJson<Pending[]>(PENDING, []);
  const sent = await loadSent();
  const bootstrap = Object.keys(seen).length === 0 && products.size === 0;
  const log: string[] = [];
  const toRead: { doc: Pending; reason: string }[] = [];
  const sourceErrors: string[] = [];

  /** Enregistre un produit vu dans un document, dans la bonne fiche (créée au besoin). */
  const upsert = (s: Sighting, ctx: { source: string; tier: Tier; url: string; publishedAt: string | null }) => {
    const sighting = { ...s, set: s.set ?? detectSet(s.name, knownSets) };
    const match = findMatch([...products.values()], sighting.name);
    let product = match.product;
    if (!product) {
      let slug = slugOf(sighting.name);
      for (let i = 2; products.has(slug); i++) slug = `${slugOf(sighting.name)}-${i}`;
      product = emptyProduct(slug, sighting.name, nowIso);
      product.possibleDuplicateOf = match.maybe?.slug ?? null;
      products.set(slug, product);
    }
    applySighting(product, sighting, { ...ctx, observedAt: nowIso });
    return product.slug;
  };
  const jobs = await readJson<Record<string, JobStatus>>(repoPath('data/status.json'), {});
  /** Fiches touchées par une source à son premier passage : pas d'alerte individuelle. */
  const silent = new Set<string>();
  const sourceSummaries: { source: SourceConfig; items: number; created: string[] }[] = [];

  // 1. Collecte, source par source
  const queue: Pending[] = [];
  for (const source of sources) {
    try {
      if (source.kind === 'riot-merch' || source.kind === 'shopify') {
        const found = source.kind === 'riot-merch' ? await collectRiotMerch(source, knownSets) : await collectShopify(source, knownSets);
        const firstRun = !bootstrap && !jobs[`source:${source.id}`]?.lastSuccessAt;
        const created: string[] = [];
        for (const f of found) {
          const slug = upsert(f.sighting, { source: source.id, tier: source.tier, url: f.url, publishedAt: null });
          // Premier passage d'une nouvelle boutique : tout son catalogue serait « nouveau ». Un seul résumé à la place.
          if (firstRun) silent.add(slug);
          if (firstRun && !before.has(slug) && !created.includes(slug)) created.push(slug);
        }
        if (firstRun) sourceSummaries.push({ source, items: found.length, created });
        log.push(`${source.id} : ${found.length} produits${firstRun ? ' (premier passage, sans alerte)' : ''}`);
        await recordJob(`source:${source.id}`, { ok: true, info: { items: found.length } }, now);
      } else if (source.kind === 'riot-news' || source.kind === 'discord') {
        const collected = source.kind === 'riot-news' ? await collectRiotNews(source, now) : await collectDiscord(source);
        if (collected === null) {
          // Source pas encore configurée (jeton absent) : ni échec ni alerte.
          log.push(`${source.id} : inactive (jeton absent)`);
          continue;
        }
        const docs = collected;
        // Premier passage d'un salon Discord : l'historique est marqué vu sans être lu (pas de rafale de vieux leaks).
        const firstRun = !bootstrap && source.kind === 'discord' && !jobs[`source:${source.id}`]?.lastSuccessAt;
        let fresh = 0;
        for (const doc of docs) {
          const h = hash(doc.text);
          const entry = seen[doc.url];
          // Déjà vu : inchangé, ou plus assez récent pour être relu en entier (son empreinte n'est plus comparable).
          if (entry && (entry.hash === h || !doc.full)) {
            entry.lastSeenAt = nowIso;
            continue;
          }
          seen[doc.url] = { hash: h, firstSeenAt: entry?.firstSeenAt ?? nowIso, lastSeenAt: nowIso };
          const age = (now.getTime() - Date.parse(doc.publishedAt ?? nowIso)) / 86_400_000;
          if (bootstrap && age > settings.bootstrap_days) continue;
          if (firstRun) continue;
          if (!matchesKeywords(doc, settings.keywords, knownSets)) continue;
          fresh++;
          queue.push({
            url: doc.url,
            source: source.id,
            title: doc.title,
            publishedAt: doc.publishedAt,
            text: doc.text,
            image: doc.image,
            full: doc.full,
            attempts: 0,
            firstSeenAt: nowIso,
          });
        }
        log.push(`${source.id} : ${docs.length} documents, ${fresh} nouveau(x) ou modifié(s) à lire${firstRun ? ' (premier passage : historique marqué vu)' : ''}`);
        await recordJob(`source:${source.id}`, { ok: true, info: { items: docs.length, fresh } }, now);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceErrors.push(`${source.id} : ${message}`);
      console.error(`Source ${source.id} en échec : ${message}`);
      const status = await recordJob(`source:${source.id}`, { ok: false, error: message }, now);
      const key = `source-down:${source.id}:${today}`;
      if (status.consecutiveFailures >= 3 && !sent[key] && (await sendDiscord('feed', [{
        title: `Source en panne : ${source.name}`,
        description: `${status.consecutiveFailures} échecs d'affilée.\n${message}`,
        url: source.url,
        color: COLORS.system,
      }]).catch(() => false))) sent[key] = nowIso;
    }
  }

  // 2. Extraction : la file d'attente d'abord (les plus anciens), puis le neuf ; un nombre limité par passage (quotas gratuits)
  for (const doc of queue) pending = [...pending.filter((p) => p.url !== doc.url), doc];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  let extracted = 0;
  let calls = 0;
  let llmDown: string | undefined;
  const remaining: Pending[] = [];
  for (const item of pending) {
    const source = sourceById.get(item.source);
    if (!source) continue; // source retirée de la config
    if (llmDown || extracted >= settings.max_extractions_per_run) {
      // LLM en panne : chaque nouveau document est quand même signalé, pour ne rien rater.
      if (llmDown && !item.alerted) {
        if (!bootstrap) toRead.push({ doc: item, reason: llmDown });
        remaining.push({ ...item, alerted: true });
      } else remaining.push(item);
      continue;
    }
    if (calls++ > 0) await pauseBetweenExtractions();
    try {
      let doc: Doc = { source, url: item.url, title: item.title, publishedAt: item.publishedAt, text: item.text, image: item.image, full: item.full };
      if (source.kind === 'riot-news') doc = await loadArticleBody(doc);
      const sightings = await extractProducts(doc, { model: settings.llm_model, fallbackModel: settings.llm_fallback_model });
      extracted++;
      for (const s of sightings) {
        upsert(
          // La bannière de l'article n'illustre un produit que s'il est le seul de l'article, et seulement en secours.
          { ...s, fallbackImage: sightings.length === 1 ? doc.image : null },
          { source: source.id, tier: source.tier, url: doc.url, publishedAt: doc.publishedAt },
        );
      }
      log.push(`extrait : ${item.title} → ${sightings.length} produit(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const unavailable = error instanceof ExtractionError && error.reason === 'unavailable';
      if (unavailable) llmDown = message;
      // Sans clé, on ne compte pas d'essai : les documents attendent que la clé soit ajoutée.
      const noKey = message.includes('GEMINI_API_KEY');
      const next = { ...item, attempts: item.attempts + (noKey ? 0 : 1), lastError: message };
      if (!next.alerted && !bootstrap) toRead.push({ doc: next, reason: message });
      // Au premier passage, l'historique n'est jamais signalé « à lire » : seulement les nouveautés ensuite.
      if (next.attempts < MAX_ATTEMPTS) remaining.push({ ...next, alerted: true });
      else log.push(`abandonné après ${MAX_ATTEMPTS} essais : ${item.title}`);
    }
  }
  pending = remaining;
  if (llmDown) log.push(`LLM indisponible : ${llmDown}`);

  // 3. Recalcul de toutes les fiches (le statut « sorti » dépend de la date du jour), visuels, écriture
  const events: ChangeEvent[] = [];
  for (const [slug, product] of products) {
    // Offre plus vue depuis 3 semaines : la boutique a retiré le produit (ou la source a été coupée).
    product.offers = product.offers.filter((o) => now.getTime() - Date.parse(o.lastSeenAt) < OFFER_RETENTION_DAYS * 86_400_000);
    recompute(product, today);
    const expected = product.imageSource ? createHash('sha1').update(product.imageSource).digest('hex').slice(0, 8) : undefined;
    if (product.imageSource && !product.image?.includes(expected!)) {
      try {
        const previous = product.image;
        product.image = await storeImage(slug, product.imageSource);
        if (previous && previous !== product.image) await rm(repoPath('data', previous), { force: true });
      } catch (error) {
        console.warn(`Visuel de ${slug} non copié : ${error instanceof Error ? error.message : error}`);
      }
    }
    const old = before.get(slug);
    const { claims: _a, updatedAt: _b, ...a } = old ?? ({} as Product);
    const { claims: _c, updatedAt: _d, ...b } = product;
    if (!old || dirty.has(slug) || JSON.stringify(a) !== JSON.stringify(b) || old.claims.length !== product.claims.length) {
      product.updatedAt = nowIso;
      await writeJson(`${PRODUCTS_DIR}/${slug}.json`, product);
      events.push(...describeChanges(old, product, now));
    }
  }

  // Visuels orphelins (fiche fusionnée ou visuel remplacé lors d'un passage interrompu)
  const used = new Set([...products.values()].map((p) => p.image).filter(Boolean));
  for (const f of await readdir(MEDIA_DIR).catch(() => [] as string[])) {
    if (!used.has(`media/${f}`)) await rm(`${MEDIA_DIR}/${f}`, { force: true });
  }

  // 4. Alertes
  const outbox: Record<Channel, Embed[]> = { critical: [], feed: [] };
  const keys: Record<Channel, string[]> = { critical: [], feed: [] };
  if (bootstrap) {
    if (products.size > 0) {
      outbox.feed.push({
        title: 'Veille des sorties lancée',
        description: `${products.size} fiche(s) créée(s) à partir du site officiel et de la boutique Riot. Les prochaines nouveautés arriveront ici une par une.`,
        url: 'https://skitgraal.github.io/riftbound-tracker/',
        color: COLORS.accent,
      });
      keys.feed.push('watch-bootstrap');
    }
  } else {
    for (const { source, items, created } of sourceSummaries) {
      // Les précommandes d'abord : c'est ce qui demande d'agir.
      const rows = created
        .map((slug) => products.get(slug)!)
        .sort((a, b) => Number(b.status === 'preorder') - Number(a.status === 'preorder'))
        .map((p) => `• ${p.name}${p.status === 'preorder' ? ' — **précommande**' : ''}`);
      const list = rows.slice(0, 20).join('\n');
      outbox.feed.push({
        title: `Nouvelle source suivie : ${source.name}`,
        url: source.url,
        description: `${items} produit(s) lus, ${created.length} fiche(s) créée(s)${created.length ? ` :\n${list}${created.length > 20 ? '\n…' : ''}` : '.'}\nLes changements suivants arriveront ici un par un.`,
        color: COLORS.accent,
      });
      keys.feed.push(`source-added:${source.id}`);
    }
    for (const e of events) {
      if (sent[e.key] || silent.has(e.product.slug)) continue;
      outbox[e.channel].push(productEmbed(e));
      keys[e.channel].push(e.key);
    }
    for (const { doc, reason } of toRead) {
      const key = `to-read:${doc.url}`;
      if (sent[key]) continue;
      outbox.feed.push({
        title: `À lire : ${doc.title}`,
        url: doc.url,
        description: `Ce document parle peut-être d'un produit, mais l'extraction automatique a échoué. Il sera retenté.\n_${reason}_`,
        color: COLORS.system,
      });
      keys.feed.push(key);
    }
  }
  for (const channel of ['critical', 'feed'] as const) {
    if (outbox[channel].length === 0) continue;
    if (await sendDiscord(channel, outbox[channel]).catch((e) => (console.error(e), false))) {
      for (const k of keys[channel]) sent[k] = nowIso;
    }
  }

  // 5. État et fichiers de suivi
  const cutoff = now.getTime() - SEEN_RETENTION_DAYS * 86_400_000;
  await writeJson(SEEN, Object.fromEntries(Object.entries(seen).filter(([, e]) => Date.parse(e.lastSeenAt) >= cutoff).sort(([a], [b]) => a.localeCompare(b))));
  await writeJson(PENDING, pending);
  await saveSent(sent, now);
  const info = { products: products.size, pending: pending.length, extracted, llm: llmDown ? 'indisponible' : 'ok' };
  if (sourceErrors.length === sources.length && sources.length > 0) {
    await recordJob('watch', { ok: false, error: sourceErrors.join(' ; ') }, now);
    process.exitCode = 1;
  } else {
    await recordJob('watch', { ok: true, info }, now);
  }
  console.log([...log, `fiches : ${products.size}, en attente : ${pending.length}, alertes : ${keys.critical.length + keys.feed.length}`].map((l) => `- ${l}`).join('\n'));
}

await main();
