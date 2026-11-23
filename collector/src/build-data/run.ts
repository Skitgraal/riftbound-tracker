/**
 * Génère les petits fichiers lus par le dashboard (site/public/data/, non committé), à partir de data/ et config/.
 * Lancé avant chaque build du site.
 */
import { rm } from 'node:fs/promises';
import { loadPriceSettings, loadWatchedCards } from '../shared/config.ts';
import { readJson, repoPath, writeText } from '../shared/fs.ts';
import { categoryLabel, languageTagOf, type Catalog, type Expansions } from '../prices/catalog.ts';
import { loadHistory, variations } from '../prices/series.ts';
import { watchedProducts } from '../prices/watchlist.ts';

const OUT = repoPath('site/public/data');
const out = (...parts: string[]) => repoPath('site/public/data', ...parts);
/** JSON compact : ces fichiers ne sont pas lus par des humains. */
const write = (path: string, value: unknown) => writeText(path, JSON.stringify(value));
const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

interface Meta {
  priceGuideCreatedAt?: string;
  nonsinglesCreatedAt?: string;
  lastSnapshotDate?: string;
}

async function main(): Promise<void> {
  const [catalog, expansions, meta, status, settings, cards, series] = await Promise.all([
    readJson<Catalog>(repoPath('data/prices/catalog.json'), {}),
    readJson<Expansions>(repoPath('data/prices/expansions.json'), {}),
    readJson<Meta>(repoPath('data/prices/meta.json'), {}),
    readJson<Record<string, unknown>>(repoPath('data/status.json'), {}),
    loadPriceSettings(),
    loadWatchedCards(),
    loadHistory(),
  ]);

  await rm(OUT, { recursive: true, force: true });

  const watched = new Set(watchedProducts(catalog, cards, settings).map((w) => w.entry.id));
  const dates = [...new Set([...series.values()].flatMap((points) => points.map((p) => p.date)))].sort();

  const index = Object.values(catalog).map((p) => {
    const points = series.get(p.id) ?? [];
    const last = points.at(-1);
    const v = variations(points);
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      category: categoryLabel(p.category),
      // Extension sans nom déduit : produit à part (bundle, coffret, promo) plutôt qu'un set de cartes
      set: expansions[String(p.expansionId)] ?? 'Hors série',
      special: !expansions[String(p.expansionId)],
      expansionId: p.expansionId,
      lang: languageTagOf(p.name),
      trend: last?.trend ?? null,
      low: last?.low ?? null,
      avg: last?.avg ?? null,
      d1: round(v.d1),
      d7: round(v.d7),
      d30: round(v.d30),
      watched: watched.has(p.id),
      removed: Boolean(p.removedAt),
      // 7 derniers relevés du prix tendance, pour la mini-courbe de la watchlist
      ...(watched.has(p.id) ? { spark: points.slice(-7).map((pt) => pt.trend) } : {}),
    };
  });

  await write(out('prices/index.json'), index);
  await Promise.all(
    [...series].map(([id, points]) =>
      write(out(`prices/series/${id}.json`), points.map((p) => [p.date, p.trend, p.low, p.avg])),
    ),
  );
  await write(out('meta.json'), {
    generatedAt: new Date().toISOString(),
    priceGuideCreatedAt: meta.priceGuideCreatedAt ?? null,
    catalogCreatedAt: meta.nonsinglesCreatedAt ?? null,
    lastSnapshotDate: meta.lastSnapshotDate ?? null,
    historyStart: dates[0] ?? null,
    historyDays: dates.length,
    thresholds: { d1: settings.alert_1d_pct, d7: settings.alert_7d_pct, minPrice: settings.min_price_eur },
    hideLanguageTags: settings.hide_language_tags,
    products: index.length,
    watched: watched.size,
  });
  await write(out('status.json'), status);

  console.log(`build-data : ${index.length} produits, ${series.size} historiques, ${watched.size} suivis, ${dates.length} jour(s)`);
}

await main();
