/**
 * Actualités du site officiel (playriftbound.com). La page de liste embarque tous les articles en JSON (__NEXT_DATA__) :
 * titre, chapeau, date, catégorie, image, lien. Le corps d'un article est lu dans sa propre page.
 */
import { fetchText } from '../../shared/http.ts';
import { findObjects, htmlToText, nextData } from '../html.ts';
import type { Doc, SourceConfig } from '../types.ts';

interface NewsItem {
  title: string;
  publishedAt: string;
  action: { payload: { url: string } };
  description?: { body?: string };
  category?: { machineName?: string };
  media?: { url?: string };
}

/** Les articles récents sont relus à chaque passage : Riot les complète souvent (dates de tirage, prix). */
const RECHECK_DAYS = 21;

const absolute = (url: string, base: string) => new URL(url, base).toString();

export async function collectRiotNews(source: SourceConfig, now: Date): Promise<Doc[]> {
  const listing = nextData(await fetchText(source.url));
  const items = findObjects<NewsItem>(
    listing,
    (o) => typeof o.title === 'string' && typeof o.publishedAt === 'string' && typeof (o.action as NewsItem['action'] | undefined)?.payload?.url === 'string',
  );
  if (items.length === 0) throw new Error('aucun article trouvé : la structure de la page a changé');

  const skip = new Set(source.skip_categories ?? []);
  const origin = new URL(source.url).origin;
  const seen = new Set<string>();
  const docs: Doc[] = [];

  for (const item of items) {
    const url = absolute(item.action.payload.url, source.url);
    if (seen.has(url) || skip.has(item.category?.machineName ?? '')) continue;
    seen.add(url);
    const summary = htmlToText(item.description?.body ?? '');
    const doc: Doc = {
      source,
      url,
      title: item.title.trim(),
      publishedAt: item.publishedAt,
      text: [item.title.trim(), summary].filter(Boolean).join('\n\n'),
      image: item.media?.url ? item.media.url.replace(/\?.*$/, '') : null,
    };
    const ageDays = (now.getTime() - Date.parse(item.publishedAt)) / 86_400_000;
    // Seuls les articles du site lui-même ont un corps à lire (les autres liens mènent à YouTube, etc.).
    if (url.startsWith(origin) && ageDays <= RECHECK_DAYS) {
      doc.text = await articleText(url, doc.text);
      doc.full = true;
    }
    docs.push(doc);
  }
  return docs;
}

/** Corps d'un article : ses blocs de texte riche, dans l'ordre. */
async function articleText(url: string, fallback: string): Promise<string> {
  const page = nextData(await fetchText(url)) as { props?: { pageProps?: { page?: { title?: string; description?: string; blades?: { type?: string }[] } } } };
  const p = page.props?.pageProps?.page;
  // Seulement le texte de l'article : le carrousel « articles liés » change à chaque chargement.
  const blades = (p?.blades ?? []).filter((b) => /^articleRichText/.test(b.type ?? ''));
  const bodies = findObjects<{ body: string }>(blades, (o) => o.type === 'html' && typeof o.body === 'string').map((o) => htmlToText(o.body));
  if (bodies.length === 0) return fallback;
  return [p?.title, p?.description, ...bodies].filter(Boolean).join('\n\n');
}

/** Pour les articles plus anciens, le corps est lu seulement quand l'article part à l'extraction. */
export async function loadArticleBody(doc: Doc): Promise<Doc> {
  if (doc.full || !doc.url.startsWith(new URL(doc.source.url).origin)) return doc;
  return { ...doc, text: await articleText(doc.url, doc.text), full: true };
}
