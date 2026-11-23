/**
 * Boutique officielle Riot (merch.riotgames.com), catégorie Riftbound. Source structurée : la page embarque la liste des
 * produits (nom, prix, disponibilité, précommande, images) dans son flux React. Pas de LLM nécessaire.
 */
import { fetchText } from '../../shared/http.ts';
import { jsonAfterKey, rscPayload } from '../html.ts';
import { classifyType, cleanProductName, detectSet, isAccessory } from '../products.ts';
import type { Sighting, SourceConfig, Status } from '../types.ts';

interface MerchProduct {
  title: string;
  slug: string;
  price?: { amount: number; currencyCode: string } | null;
  availability?: string;
  isPreorder?: boolean | null;
  dropAt?: string | null;
  createdAt?: string;
  assets?: { src: string }[];
  externalRegistrationUrl?: string | null;
}

export interface StructuredSighting {
  sighting: Sighting;
  url: string;
}

export async function collectRiotMerch(source: SourceConfig, knownSets: string[]): Promise<StructuredSighting[]> {
  const products = jsonAfterKey(rscPayload(await fetchText(source.url)), 'initialProducts') as MerchProduct[];
  if (!Array.isArray(products)) throw new Error('liste de produits illisible');
  const origin = new URL(source.url);
  const locale = origin.pathname.split('/')[1] ?? 'en-us';

  return products
    .filter((p) => p.title && p.slug && !isAccessory(p.title))
    .map((p) => {
      const name = cleanProductName(p.title);
      const url = `${origin.origin}/${locale}/product/${p.slug}/`;
      const inStock = p.availability === 'inStock';
      const status: Status | null = p.isPreorder && inStock ? 'preorder' : inStock ? 'released' : null;
      const image = p.assets?.[0]?.src ? `${p.assets[0].src.replace(/\?.*$/, '')}?w=1200&fm=webp&q=82` : null;
      const evidence = [
        p.title,
        p.price ? `${p.price.amount} ${p.price.currencyCode}` : null,
        p.isPreorder ? 'précommande' : null,
        inStock ? 'en stock' : 'épuisé',
      ].filter(Boolean).join(' · ');
      return {
        url,
        sighting: {
          name,
          set: detectSet(name, knownSets),
          type: classifyType(name),
          msrp: p.price ? { amount: p.price.amount, currency: p.price.currencyCode } : null,
          releaseDate: null,
          status,
          draws: p.externalRegistrationUrl ? [{ opensAt: null, closesAt: null, url: p.externalRegistrationUrl, region: null }] : [],
          image,
          evidence,
          offer: {
            source: source.id,
            url,
            price: p.price ? { amount: p.price.amount, currency: p.price.currencyCode } : null,
            availability: p.isPreorder && inStock ? 'preorder' : inStock ? 'in_stock' : 'out_of_stock',
          },
        },
      };
    });
}
