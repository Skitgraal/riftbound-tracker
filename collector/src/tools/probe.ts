/**
 * Diagnostic d'une liste d'URL candidates : autorisation robots.txt, code HTTP, type et début du contenu.
 * Usage : npm run probe -w collector -- <url> [<url>…]   (ou variable PROBE_URLS, une URL par ligne)
 * Sert à valider une source depuis les serveurs de GitHub avant de l'ajouter à config/sources.yml.
 */
import { USER_AGENT } from '../shared/http.ts';

const urls = [...process.argv.slice(2), ...(process.env.PROBE_URLS ?? '').split(/\s+/)].filter(Boolean);
const robotsCache = new Map<string, string[]>();

/** Règles Disallow du groupe « User-agent: * » (suffisant pour un diagnostic). */
async function disallowRules(origin: string): Promise<string[]> {
  if (!robotsCache.has(origin)) {
    const rules: string[] = [];
    try {
      const r = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) });
      if (r.ok) {
        let inStar = false;
        for (const raw of (await r.text()).split('\n')) {
          const line = raw.split('#')[0]!.trim();
          const [k, ...rest] = line.split(':');
          const key = k?.toLowerCase();
          const value = rest.join(':').trim();
          if (key === 'user-agent') inStar = value === '*';
          else if (inStar && key === 'disallow' && value) rules.push(value);
        }
      }
    } catch {
      /* robots.txt absent : tout est permis */
    }
    robotsCache.set(origin, rules);
  }
  return robotsCache.get(origin)!;
}

const toRegex = (rule: string) => new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`);

for (const url of urls) {
  const u = new URL(url);
  const blocked = (await disallowRules(u.origin)).find((rule) => toRegex(rule).test(u.pathname + u.search));
  try {
    const r = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    const text = await r.text();
    const snippet = text.slice(0, Number(process.env.PROBE_CHARS || 160)).replace(/\s+/g, ' ');
    console.log(`${r.status} ${blocked ? `ROBOTS-INTERDIT(${blocked})` : 'robots-ok'} ${r.headers.get('content-type') ?? ''} ${text.length}o ${url}\n    ${snippet}`);
    // Liste Shopify : résumé lisible (titre, type, prix, dispo, tags) plutôt que le JSON brut.
    if (text.startsWith('{"products"')) {
      const { products } = JSON.parse(text) as { products: { title: string; product_type: string; tags: string[] | string; created_at: string; variants: { price: string; available?: boolean }[] }[] };
      console.log(`    ${products.length} produits`);
      for (const p of products) {
        const v = p.variants[0];
        console.log(`    - ${p.title} | ${p.product_type} | ${v?.price} | ${v?.available ? 'dispo' : 'indispo'} | ${p.created_at.slice(0, 10)} | ${[p.tags].flat().join(',').slice(0, 80)}`);
      }
    }
  } catch (error) {
    console.log(`ERR ${url} : ${error instanceof Error ? error.message : error}`);
  }
  await new Promise((r) => setTimeout(r, 1_500));
}
