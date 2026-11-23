/**
 * Ingestion Cardmarket — lancée par le workflow `prices`, 3 fois par jour.
 * Idempotente : un fichier déjà intégré (même createdAt) ne produit aucune écriture.
 */
import { COLORS, sendDiscord, type Embed } from '../alerts/discord.ts';
import { loadSent, saveSent } from '../alerts/sent.ts';
import { readJson, readText, repoPath, writeJson, writeText } from '../shared/fs.ts';
import { recordJob } from '../shared/status.ts';
import { parisDate, parseTimestamp } from '../shared/time.ts';
import { cardmarketSearchUrl, downloadAll } from './cardmarket.ts';
import { deriveExpansions, mergeCatalog, type Catalog, type CatalogEntry, type Expansions } from './catalog.ts';
import { appendDay, monthFileOf, priceRows } from './history.ts';

const PATHS = {
  catalog: repoPath('data/prices/catalog.json'),
  expansions: repoPath('data/prices/expansions.json'),
  meta: repoPath('data/prices/meta.json'),
  history: (file: string) => repoPath('data/prices/history', file),
};

/** Au-delà, le guide de prix est considéré comme périmé (Cardmarket ne publie plus, ou l'URL a changé). */
const STALE_HOURS = 36;

interface Meta {
  priceGuideCreatedAt?: string;
  singlesCreatedAt?: string;
  nonsinglesCreatedAt?: string;
  lastSnapshotDate?: string;
}

function newProductEmbed(p: CatalogEntry, expansions: Expansions): Embed {
  const set = expansions[String(p.expansionId)] ?? `Extension #${p.expansionId}`;
  return {
    title: `Nouveau produit sur Cardmarket : ${p.name}`,
    url: cardmarketSearchUrl(p.name),
    color: COLORS.accent,
    description: 'Un produit qui arrive sur Cardmarket annonce souvent une sortie proche.',
    fields: [
      { name: 'Set', value: set, inline: true },
      { name: 'Catégorie', value: p.category, inline: true },
      ...(p.languageTag ? [{ name: 'Langue', value: p.languageTag, inline: true }] : []),
    ],
  };
}

async function main(): Promise<void> {
  const now = new Date();
  const sent = await loadSent();

  try {
    const files = await downloadAll();
    const meta = await readJson<Meta>(PATHS.meta, {});
    const log: string[] = [];

    // Catalogue et extensions
    let expansions = await readJson<Expansions>(PATHS.expansions, {});
    if (files.singles.createdAt !== meta.singlesCreatedAt || files.nonsingles.createdAt !== meta.nonsinglesCreatedAt) {
      const existing = await readJson<Catalog>(PATHS.catalog, {});
      const { catalog, newSealed } = mergeCatalog(existing, files.singles.products, files.nonsingles.products, now.toISOString());
      expansions = deriveExpansions(expansions, files.nonsingles.products);
      await writeJson(PATHS.catalog, catalog);
      await writeJson(PATHS.expansions, expansions);
      meta.singlesCreatedAt = files.singles.createdAt;
      meta.nonsinglesCreatedAt = files.nonsingles.createdAt;
      log.push(`catalogue : ${Object.keys(catalog).length} produits, ${newSealed.length} nouveau(x) scellé(s)`);

      const fresh = newSealed.filter((p) => !p.languageTag);
      if (fresh.length > 0) {
        await sendDiscord('feed', fresh.map((p) => newProductEmbed(p, expansions)));
      }
    } else {
      log.push('catalogue : inchangé');
    }

    // Historique des prix
    const snapshotDate = parisDate(files.priceGuide.createdAt);
    if (files.priceGuide.createdAt !== meta.priceGuideCreatedAt) {
      const file = PATHS.history(monthFileOf(snapshotDate));
      const next = appendDay(await readText(file), priceRows(files.priceGuide.priceGuides, snapshotDate), snapshotDate);
      if (next !== undefined) {
        await writeText(file, next);
        meta.lastSnapshotDate = snapshotDate;
        log.push(`prix : ${files.priceGuide.priceGuides.length} lignes ajoutées pour le ${snapshotDate}`);
      } else {
        log.push(`prix : le ${snapshotDate} est déjà enregistré`);
      }
      meta.priceGuideCreatedAt = files.priceGuide.createdAt;
    } else {
      log.push(`prix : fichier déjà intégré (${files.priceGuide.createdAt})`);
    }
    await writeJson(PATHS.meta, meta);

    // Guide de prix périmé : une alerte par jour au maximum
    const ageHours = (now.getTime() - parseTimestamp(files.priceGuide.createdAt).getTime()) / 3_600_000;
    const staleKey = `prices-stale:${parisDate(now)}`;
    if (ageHours > STALE_HOURS && !sent[staleKey]) {
      const ok = await sendDiscord('feed', [{
        title: 'Prix Cardmarket non mis à jour',
        description: `Le dernier guide de prix date de ${Math.round(ageHours)} h (${files.priceGuide.createdAt}).`,
        color: COLORS.system,
      }]);
      if (ok) sent[staleKey] = now.toISOString();
    }

    await recordJob('prices', {
      ok: true,
      info: {
        priceGuideCreatedAt: files.priceGuide.createdAt,
        catalogCreatedAt: files.nonsingles.createdAt,
        lastSnapshotDate: meta.lastSnapshotDate,
      },
    }, now);
    console.log(log.map((l) => `- ${l}`).join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Ingestion Cardmarket en échec : ${message}`);
    const status = await recordJob('prices', { ok: false, error: message }, now);
    const failKey = `prices-failed:${parisDate(now)}`;
    if (!sent[failKey]) {
      const ok = await sendDiscord('feed', [{
        title: 'Ingestion Cardmarket en échec',
        description: message,
        color: COLORS.system,
        footer: { text: `${status.consecutiveFailures} échec(s) consécutif(s)` },
      }]).catch(() => false);
      if (ok) sent[failKey] = now.toISOString();
    }
    process.exitCode = 1;
  } finally {
    await saveSent(sent, now);
  }
}

await main();
