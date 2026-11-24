/**
 * Extraction des produits d'un document en texte libre, par un LLM gratuit (API Gemini, offre gratuite).
 * Le fournisseur est isolé ici : en changer ne touche pas au reste. Toute sortie est validée avant usage.
 */
import { readText, repoPath } from '../shared/fs.ts';
import { USER_AGENT } from '../shared/http.ts';
import type { DatePrecision, Doc, Draw, ProductType, Sighting, Status } from './types.ts';

export class ExtractionError extends Error {
  constructor(
    message: string,
    /** `unavailable` : pas de clé, quota atteint, service en panne → on réessaiera. `invalid` : réponse inutilisable. */
    readonly reason: 'unavailable' | 'invalid',
    /** Délai d'attente conseillé par l'API avant de réessayer, s'il est donné. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** Lit le délai conseillé dans une erreur Gemini (`"retryDelay": "17s"`). */
export function retryDelayMs(body: string): number | undefined {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Réessais sur un même modèle : les 503 (surcharge) et 429 (quota par minute) de l'offre gratuite sont passagers. */
const RETRY_DELAYS_MS = [5_000, 20_000];
const MAX_WAIT_MS = 60_000;

const TYPES: ProductType[] = ['display', 'booster', 'deck', 'bundle', 'box_exclusive', 'draw_product', 'other'];
const STATUSES: Status[] = ['announced', 'preorder', 'released', 'cancelled'];
const PRECISIONS: DatePrecision[] = ['day', 'month', 'quarter', 'unknown'];

const nullable = (type: string) => ({ type: [type, 'null'] });

/** Schéma imposé à la réponse du modèle. */
export const SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          set: nullable('string'),
          type: { type: 'string', enum: TYPES },
          english_available: { type: 'boolean' },
          msrp_amount: nullable('number'),
          msrp_currency: { type: ['string', 'null'], enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', null] },
          release_date: nullable('string'),
          release_precision: { type: 'string', enum: PRECISIONS },
          status: { type: ['string', 'null'], enum: [...STATUSES, null] },
          draws: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                opens_at: nullable('string'),
                closes_at: nullable('string'),
                url: nullable('string'),
                region: nullable('string'),
              },
              required: ['opens_at', 'closes_at', 'url', 'region'],
            },
          },
          evidence: { type: 'string' },
        },
        required: ['name', 'set', 'type', 'english_available', 'msrp_amount', 'msrp_currency', 'release_date', 'release_precision', 'status', 'draws', 'evidence'],
      },
    },
  },
  required: ['products'],
};

interface RawProduct {
  name?: unknown;
  set?: unknown;
  type?: unknown;
  english_available?: unknown;
  msrp_amount?: unknown;
  msrp_currency?: unknown;
  release_date?: unknown;
  release_precision?: unknown;
  status?: unknown;
  draws?: unknown;
  evidence?: unknown;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function isoInstant(v: unknown): string | null {
  const s = str(v);
  if (!s || Number.isNaN(Date.parse(s))) return null;
  return new Date(s).toISOString();
}

function releaseDate(value: unknown, precision: unknown): Sighting['releaseDate'] {
  const v = str(value);
  const p = PRECISIONS.includes(precision as DatePrecision) ? (precision as DatePrecision) : 'unknown';
  if (!v || p === 'unknown') return null;
  const ok = { day: /^\d{4}-\d{2}-\d{2}$/, month: /^\d{4}-\d{2}$/, quarter: /^\d{4}-Q[1-4]$/ }[p].test(v);
  return ok ? { value: v, precision: p } : null;
}

/** Valide et convertit la réponse du modèle. Les produits incomplets ou non anglais sont écartés. */
export function parseExtraction(json: unknown): Sighting[] {
  const products = (json as { products?: unknown })?.products;
  if (!Array.isArray(products)) throw new ExtractionError('réponse sans liste « products »', 'invalid');
  return (products as RawProduct[])
    .filter((p) => str(p.name) && p.english_available !== false)
    .map((p): Sighting => {
      const amount = typeof p.msrp_amount === 'number' && p.msrp_amount > 0 ? p.msrp_amount : null;
      const draws: Draw[] = (Array.isArray(p.draws) ? p.draws : [])
        .map((d: Record<string, unknown>) => ({
          opensAt: isoInstant(d?.opens_at),
          closesAt: isoInstant(d?.closes_at),
          url: str(d?.url),
          region: str(d?.region),
        }))
        .filter((d) => d.opensAt || d.closesAt);
      return {
        name: str(p.name)!.replace(/^riftbound\s*:\s*/i, ''),
        set: str(p.set),
        type: TYPES.includes(p.type as ProductType) ? (p.type as ProductType) : 'other',
        msrp: amount ? { amount, currency: str(p.msrp_currency) ?? 'USD' } : null,
        releaseDate: releaseDate(p.release_date, p.release_precision),
        status: STATUSES.includes(p.status as Status) ? (p.status as Status) : null,
        draws,
        image: null,
        evidence: str(p.evidence) ?? '',
      };
    });
}

export interface LlmSettings {
  model: string;
  fallbackModel?: string;
}

const MAX_CHARS = 15_000;
let promptCache: string | undefined;

async function systemPrompt(): Promise<string> {
  promptCache ??= await readText(repoPath('prompts/extract.md'));
  if (!promptCache) throw new Error('prompts/extract.md introuvable');
  return promptCache;
}

async function callGemini(model: string, key: string, system: string, user: string): Promise<unknown> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key, 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SCHEMA, temperature: 0 },
    }),
  });
  if (response.status === 429 || response.status >= 500) {
    const detail = await response.text().catch(() => '');
    throw new ExtractionError(`Gemini ${model} : HTTP ${response.status} (quota ou surcharge)`, 'unavailable', retryDelayMs(detail));
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new ExtractionError(`Gemini ${model} : HTTP ${response.status} ${detail}`, response.status === 403 || response.status === 401 ? 'unavailable' : 'invalid');
  }
  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; promptFeedback?: { blockReason?: string } };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw new ExtractionError(`Gemini ${model} : réponse vide${body.promptFeedback?.blockReason ? ` (${body.promptFeedback.blockReason})` : ''}`, 'invalid');
  try {
    return JSON.parse(text);
  } catch {
    throw new ExtractionError(`Gemini ${model} : JSON invalide`, 'invalid');
  }
}

export async function extractProducts(doc: Doc, settings: LlmSettings): Promise<Sighting[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ExtractionError('clé GEMINI_API_KEY absente', 'unavailable');
  const user = [
    `Source: ${doc.source.name}`,
    `URL: ${doc.url}`,
    `Published: ${doc.publishedAt ?? 'unknown'}`,
    '',
    '<document>',
    doc.text.slice(0, MAX_CHARS),
    '</document>',
  ].join('\n');
  const system = await systemPrompt();
  const models = [settings.model, settings.fallbackModel].filter((m): m is string => Boolean(m));
  const errors: string[] = [];
  // Chaque modèle est réessayé avant de passer au secours (les quotas gratuits sont comptés par modèle).
  for (const model of models) {
    for (let attempt = 0; ; attempt++) {
      try {
        return parseExtraction(await callGemini(model, key, system, user));
      } catch (error) {
        if (!(error instanceof ExtractionError) || error.reason !== 'unavailable') throw error;
        const wait = error.retryAfterMs ?? RETRY_DELAYS_MS[attempt];
        if (attempt >= RETRY_DELAYS_MS.length || wait === undefined || wait > MAX_WAIT_MS || error.message.includes('HTTP 40')) {
          errors.push(error.message);
          break;
        }
        await sleep(wait);
      }
    }
  }
  throw new ExtractionError(errors.join(' ; '), 'unavailable');
}

/** Pause entre deux extractions, pour rester sous le quota par minute de l'offre gratuite. */
export const pauseBetweenExtractions = () => sleep(Number(process.env.LLM_PAUSE_MS ?? 6_000));
