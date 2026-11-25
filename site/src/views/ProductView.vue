<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, ArrowUpRight, ShieldCheck, ShieldQuestion, Store, TrendingUp } from 'lucide-vue-next';
import CountdownTiles from '../components/CountdownTiles.vue';
import EmptyState from '../components/EmptyState.vue';
import ProductArt from '../components/ProductArt.vue';
import StatusChip from '../components/StatusChip.vue';
import { fetchData } from '../lib/data.ts';
import { euro } from '../lib/format.ts';
import {
  currentDraw,
  drawSignupUrl,
  fuzzyLabel,
  riotStoreUrl,
  instantLabel,
  money,
  TIER_LABELS,
  TYPE_LABELS,
  type Claim,
  type ProductFull,
  type Tier,
} from '../lib/products.ts';

const route = useRoute();
const product = shallowRef<ProductFull>();
const error = shallowRef<string>();

watch(
  () => route.params.slug,
  async (slug) => {
    product.value = undefined;
    error.value = undefined;
    if (typeof slug !== 'string') return;
    try {
      product.value = await fetchData<ProductFull>(`products/${slug}.json`);
      document.title = `${product.value.name} · Riftbound Tracker`;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  },
  { immediate: true },
);

const draw = computed(() => (product.value ? currentDraw(product.value) : undefined));

const fields = computed(() => {
  const p = product.value;
  if (!p) return [];
  const past = p.draws.filter((d) => d.closesAt && Date.parse(d.closesAt) < Date.now()).at(-1);
  const shown = draw.value?.draw ?? past;
  return [
    { k: 'Type', v: TYPE_LABELS[p.type] },
    { k: 'Set', v: p.set ?? '—' },
    { k: 'Langue', v: 'Anglais' },
    { k: 'Prix officiel', v: money(p.msrp) },
    { k: 'Annoncé le', v: p.announcedAt ? fuzzyLabel({ value: p.announcedAt, precision: 'day' }) : '—' },
    { k: p.status === 'released' ? 'Sorti' : 'Sortie', v: fuzzyLabel(p.releaseDate) },
    ...(shown ? [{ k: 'Tirage', v: `${shown.opensAt ? instantLabel(shown.opensAt) : '?'} → ${shown.closesAt ? instantLabel(shown.closesAt) : '?'}` }] : []),
  ];
});

const FIELD_LABELS: Record<string, string> = {
  name: 'nom',
  set: 'set',
  type: 'type',
  msrp: 'prix',
  releaseDate: 'date de sortie',
  announcedAt: 'annonce',
  status: 'statut',
  image: 'visuel',
  imageFallback: 'visuel',
  officialUrl: 'lien',
  draw: 'tirage',
};
const TIER_COLORS: Record<Tier, string> = { official: '#4FD1C5', relay: '#9CC3FF', leak: '#C9B5FF' };

/** Historique : une entrée par document lu (source + moment), la plus récente en haut. */
const history = computed(() => {
  const p = product.value;
  if (!p) return [];
  const groups = new Map<string, Claim[]>();
  for (const c of p.claims) {
    const key = `${c.source}|${c.url}|${c.observedAt}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.values()]
    .map((claims) => {
      const c = claims[0]!;
      const labels = [...new Set(claims.map((x) => FIELD_LABELS[x.field] ?? x.field))].filter((l) => l !== 'lien' && l !== 'annonce');
      return {
        key: `${c.source}${c.observedAt}${c.url}`,
        tier: c.tier,
        source: p.sourceNames[c.source] ?? c.source,
        url: c.url,
        when: instantLabel(c.observedAt),
        at: c.observedAt,
        title: labels.length ? `${labels[0]!.charAt(0).toUpperCase()}${labels[0]!.slice(1)}${labels.length > 1 ? `, ${labels.slice(1).join(', ')}` : ''}` : 'Mention',
        quote: claims.find((x) => x.evidence)?.evidence ?? '',
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
});

const AVAILABILITY: Record<string, string> = { in_stock: 'En stock', out_of_stock: 'Épuisé', preorder: 'Précommande', unknown: 'Disponibilité inconnue' };
</script>

<template>
  <RouterLink to="/" class="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-muted no-underline hover:text-text">
    <ArrowLeft :size="16" aria-hidden="true" /> Toutes les sorties
  </RouterLink>

  <EmptyState v-if="error" title="Fiche introuvable" detail="Ce produit n'existe pas ou n'est plus suivi." />
  <p v-else-if="!product" class="text-sm text-text-faint">Chargement…</p>

  <template v-else>
    <div class="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div>
        <ProductArt :product="product" large class="aspect-square rounded-[20px] border border-border" />
        <p v-if="product.image" class="m-0 mt-2 text-xs text-text-faint">Visuel : {{ product.offers.length ? 'boutique Riot' : 'site officiel' }}</p>
      </div>

      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <StatusChip :status="product.status" />
          <span
            class="inline-flex h-6 items-center gap-1.5 text-xs font-semibold"
            :class="product.reliability === 'confirmed' ? 'text-accent-text' : 'text-rumor'"
          >
            <component :is="product.reliability === 'confirmed' ? ShieldCheck : ShieldQuestion" :size="14" aria-hidden="true" />
            {{ product.reliability === 'confirmed' ? 'Confirmé par Riot' : 'Non confirmé' }}
          </span>
        </div>
        <h1 class="m-0 mt-3 font-display text-[30px] leading-tight font-bold tracking-tight sm:text-[36px]">{{ product.name }}</h1>
        <p v-if="product.possibleDuplicateOf" class="m-0 mt-2 text-sm text-urgent">
          Doublon possible de
          <RouterLink :to="`/produit/${product.possibleDuplicateOf}`">{{ product.possibleDuplicateOf }}</RouterLink>.
        </p>

        <dl class="m-0 mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-3">
          <div v-for="f in fields" :key="f.k">
            <dt class="text-xs text-text-faint">{{ f.k }}</dt>
            <dd class="m-0 mt-1 text-sm font-medium">{{ f.v }}</dd>
          </div>
        </dl>

        <!-- Tirage ouvert ou à venir -->
        <div v-if="draw" class="mt-4 rounded-2xl border border-urgent-border bg-urgent-bg p-5">
          <p class="m-0 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-urgent uppercase">
            <span class="size-1.5 rounded-full bg-urgent" aria-hidden="true" />
            {{ draw.state === 'open' ? 'Tirage ouvert' : 'Tirage à venir' }}
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-4">
            <CountdownTiles v-if="draw.state === 'open' && draw.draw.closesAt" :until="draw.draw.closesAt" verb="Ferme" />
            <CountdownTiles v-else-if="draw.draw.opensAt" :until="draw.draw.opensAt" verb="Ouvre" />
            <a
              :href="drawSignupUrl(product, draw.draw)"
              target="_blank"
              rel="noopener"
              class="inline-flex h-11 items-center gap-2 rounded-[10px] bg-urgent px-4 text-sm font-semibold text-[#1A1306] no-underline hover:bg-[#FFD88A]"
            >
              {{ draw.draw.url ? (draw.state === 'open' ? "S'inscrire au tirage" : "Page d'inscription") : "Voir l'annonce" }}
              <ArrowUpRight :size="16" aria-hidden="true" />
            </a>
          </div>
          <p class="m-0 mt-3 text-xs text-text-muted">Heure de Paris. Rappels Discord à l'ouverture, 24 h et 2 h avant la fermeture.</p>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <a
            v-if="product.officialUrl"
            :href="product.officialUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#2C3242] px-[18px] text-sm font-semibold text-text no-underline hover:border-[#4A5368]"
          >
            Annonce officielle <ArrowUpRight :size="16" aria-hidden="true" />
          </a>
          <a
            :href="riotStoreUrl(product)"
            target="_blank"
            rel="noopener"
            class="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#2C3242] px-[18px] text-sm font-semibold text-text no-underline hover:border-[#4A5368]"
            :title="product.offers.some((o) => o.source === 'riot-merch') ? 'Page du produit sur la boutique Riot' : 'Catégorie Riftbound de la boutique Riot'"
          >
            <Store :size="16" aria-hidden="true" /> Boutique Riot
          </a>
          <RouterLink
            v-if="product.market"
            :to="{ path: '/prix', query: { id: product.market.id } }"
            class="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#2C3242] px-[18px] text-sm font-semibold text-text no-underline hover:border-[#4A5368]"
          >
            <TrendingUp :size="16" aria-hidden="true" />
            Marché {{ euro(product.market.trend) }}
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="mt-12 grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <section aria-labelledby="history">
        <h2 id="history" class="m-0 mb-5 font-display text-[22px] font-semibold tracking-tight">Historique</h2>
        <ol class="m-0 list-none p-0">
          <li v-for="(h, i) in history" :key="h.key" class="relative flex gap-4 pb-6">
            <div class="flex flex-col items-center">
              <span class="mt-1.5 size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: TIER_COLORS[h.tier] }" aria-hidden="true" />
              <span v-if="i < history.length - 1" class="mt-1 w-px flex-1 bg-border" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="m-0 text-sm font-semibold">{{ h.title }}</p>
                <StatusChip :status="h.tier" :label="TIER_LABELS[h.tier]" />
              </div>
              <p class="m-0 mt-1 text-xs text-text-faint">
                {{ h.when }} ·
                <a :href="h.url" target="_blank" rel="noopener">{{ h.source }}</a>
              </p>
              <p v-if="h.quote" class="m-0 mt-2 border-l-2 border-border pl-3 text-sm leading-relaxed text-text-muted">« {{ h.quote }} »</p>
            </div>
          </li>
        </ol>
      </section>

      <section aria-labelledby="buy">
        <h2 id="buy" class="m-0 mb-5 font-display text-[22px] font-semibold tracking-tight">Où l'acheter</h2>
        <div class="rounded-2xl border border-border bg-surface">
          <a
            v-for="o in product.offers"
            :key="o.url"
            :href="o.url"
            target="_blank"
            rel="noopener"
            class="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-4 text-text no-underline last:border-b-0 hover:bg-surface-2"
          >
            <span>
              <span class="block text-sm font-medium">{{ product.sourceNames[o.source] ?? o.source }}</span>
              <span class="block text-xs" :class="o.availability === 'out_of_stock' ? 'text-text-faint' : 'text-accent-text'">
                {{ AVAILABILITY[o.availability] }}
              </span>
            </span>
            <span class="font-display text-base font-semibold tabular-nums">{{ money(o.price) }}</span>
          </a>
          <p v-if="product.offers.length === 0" class="m-0 px-5 py-5 text-sm leading-relaxed text-text-muted">
            Aucune boutique ne le propose pour l'instant. Une alerte part dès qu'une offre apparaît.
          </p>
        </div>
      </section>
    </div>
  </template>
</template>
