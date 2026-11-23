<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ExternalLink, Search } from 'lucide-vue-next';
import DeltaValue from '../components/DeltaValue.vue';
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
import PriceChart from '../components/PriceChart.vue';
import WatchlistTable from '../components/WatchlistTable.vue';
import { cardmarketUrl, fetchData, normalize, useData, type PriceRow, type SeriesPoint, type SiteMeta } from '../lib/data.ts';
import { day, euro } from '../lib/format.ts';
import { bySetThenType, byTrendDesc } from '../lib/sort.ts';

const route = useRoute();
const router = useRouter();
const { data: rows, error } = useData<PriceRow[]>('prices/index.json');
const { data: meta } = useData<SiteMeta>('meta.json');

const query = ref('');
const kind = ref<'sealed' | 'single'>('sealed');
const englishOnly = ref(true);
const LIMIT = 60;

const results = computed(() => {
  const all = rows.value ?? [];
  const hidden = new Set(meta.value?.hideLanguageTags ?? []);
  const tokens = normalize(query.value).split(' ').filter(Boolean);
  const list = all.filter(
    (r) =>
      r.kind === kind.value &&
      !r.removed &&
      !(englishOnly.value && r.lang && hidden.has(r.lang)) &&
      tokens.every((t) => normalize(`${r.name} ${r.set} ${r.category}`).includes(t)),
  );
  return list.sort(kind.value === 'sealed' ? bySetThenType : byTrendDesc);
});

const watchlist = computed(() => (rows.value ?? []).filter((r) => r.watched).sort(bySetThenType));

// Produit affiché : celui de l'URL (?id=), sinon le premier résultat.
const selectedId = computed(() => {
  const id = Number(route.query.id);
  return Number.isInteger(id) && id > 0 ? id : results.value[0]?.id;
});
const selected = computed(() => rows.value?.find((r) => r.id === selectedId.value));

// Un produit ouvert par lien (alerte Discord, watchlist) : on cale les filtres sur lui pour qu'il figure dans la liste.
watch(selected, (r) => {
  if (r && route.query.id) kind.value = r.kind;
});

const series = shallowRef<SeriesPoint[]>();
watch(
  selectedId,
  async (id) => {
    series.value = undefined;
    if (id === undefined) return;
    try {
      const points = await fetchData<SeriesPoint[]>(`prices/series/${id}.json`);
      if (id === selectedId.value) series.value = points;
    } catch {
      if (id === selectedId.value) series.value = [];
    }
  },
  { immediate: true },
);

function select(id: number) {
  router.replace({ query: { ...route.query, id } });
  document.getElementById('detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
</script>

<template>
  <PageTitle
    title="Prix"
    :subtitle="meta?.lastSnapshotDate ? `Cardmarket · relevé du ${day(meta.lastSnapshotDate, true)}` : 'Source : Cardmarket'"
  />

  <EmptyState v-if="error" title="Prix indisponibles" :detail="`Les données n'ont pas pu être chargées (${error}).`" />

  <template v-else>
    <!-- Filtres : une ligne au-dessus de tout ce qu'ils filtrent -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <label class="relative min-w-0 flex-1 basis-72">
        <span class="sr-only">Rechercher un produit ou une carte</span>
        <Search :size="18" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-faint" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          placeholder="Rechercher : Spiritforged display, Jinx…"
          class="h-11 w-full rounded-[10px] border border-border bg-surface pr-4 pl-11 text-[15px] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
      </label>
      <div class="flex gap-0.5 rounded-[10px] border border-border bg-surface p-1" role="group" aria-label="Type de produit">
        <button
          v-for="k in (['sealed', 'single'] as const)"
          :key="k"
          type="button"
          class="h-9 cursor-pointer rounded-[7px] border-0 px-3.5 text-[13px] font-medium transition-colors"
          :class="kind === k ? 'bg-border text-text' : 'bg-transparent text-text-muted hover:text-text'"
          :aria-pressed="kind === k"
          @click="kind = k"
        >
          {{ k === 'sealed' ? 'Scellé' : 'Cartes' }}
        </button>
      </div>
      <label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-text-muted">
        <input v-model="englishOnly" type="checkbox" class="size-4 accent-[#4FD1C5]" />
        Masquer les versions non anglaises
      </label>
    </div>

    <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <!-- Résultats -->
      <section aria-label="Résultats" class="rounded-2xl border border-border bg-surface">
        <p class="m-0 border-b border-border-soft px-4 py-3 text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
          {{ rows ? `${results.length} résultat${results.length > 1 ? 's' : ''}` : 'Chargement…' }}
        </p>
        <ul class="m-0 max-h-[300px] list-none overflow-y-auto p-1.5 lg:max-h-[560px]">
          <li v-for="r in results.slice(0, LIMIT)" :key="r.id">
            <button
              type="button"
              class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border-0 px-3 py-2.5 text-left transition-colors"
              :class="r.id === selectedId ? 'bg-surface-2' : 'bg-transparent hover:bg-[#151922]'"
              :aria-current="r.id === selectedId ? 'true' : undefined"
              @click="select(r.id)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-text">{{ r.name }}</span>
                <span class="block truncate text-xs text-text-faint">{{ r.set }} · {{ r.category }}{{ r.lang ? ` · ${r.lang}` : '' }}</span>
              </span>
              <span class="shrink-0 font-display text-sm font-semibold tabular-nums text-text">{{ euro(r.trend) }}</span>
            </button>
          </li>
          <li v-if="results.length > LIMIT" class="px-3 py-2.5 text-xs text-text-faint">
            {{ results.length - LIMIT }} autres : affine la recherche.
          </li>
          <li v-if="rows && results.length === 0" class="px-3 py-6 text-center text-sm text-text-muted">Aucun résultat.</li>
        </ul>
      </section>

      <!-- Détail du produit -->
      <section id="detail" aria-label="Détail du produit" class="min-w-0 scroll-mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <template v-if="selected">
          <p class="m-0 text-xs font-medium uppercase tracking-[0.08em] text-text-faint">
            {{ selected.set }} · {{ selected.category }}{{ selected.lang ? ` · ${selected.lang}` : '' }}
          </p>
          <h2 class="m-0 mt-2 font-display text-[22px] font-semibold tracking-tight">{{ selected.name }}</h2>

          <div class="mt-5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p class="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span class="font-display text-[40px] leading-none font-bold tracking-tight tabular-nums">{{ euro(selected.trend) }}</span>
                <span v-if="selected.d7 !== null" class="text-sm"><DeltaValue :value="selected.d7" /> <span class="text-text-faint">sur 7 j</span></span>
              </p>
              <p class="m-0 mt-2 text-[13px] text-text-faint">Prix tendance · toutes langues confondues</p>
            </div>
            <dl class="m-0 flex gap-6 text-sm">
              <div>
                <dt class="text-xs text-text-faint">Plus bas</dt>
                <dd class="m-0 mt-1 font-display font-semibold tabular-nums">{{ euro(selected.low) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-text-faint">Moyenne</dt>
                <dd class="m-0 mt-1 font-display font-semibold tabular-nums">{{ euro(selected.avg) }}</dd>
              </div>
            </dl>
            <a
              :href="cardmarketUrl(selected.name)"
              target="_blank"
              rel="noopener"
              class="inline-flex h-11 items-center gap-2 rounded-[10px] border border-border px-4 text-sm font-medium text-text no-underline transition-colors hover:bg-surface-2"
            >
              Cardmarket (EN)
              <ExternalLink :size="16" aria-hidden="true" />
            </a>
          </div>

          <div class="mt-7 border-t border-border-soft pt-5">
            <PriceChart v-if="series && series.length" :points="series" />
            <p v-else-if="series" class="m-0 py-12 text-center text-sm text-text-muted">Pas encore de prix relevé pour ce produit.</p>
            <p v-else class="m-0 py-12 text-center text-sm text-text-faint">Chargement de l'historique…</p>
            <p v-if="meta && meta.historyDays < 7" class="m-0 mt-3 text-[13px] text-text-faint">
              Historique en construction depuis le {{ day(meta.historyStart, true) }} : un relevé par jour.
            </p>
          </div>
        </template>
        <p v-else-if="rows" class="m-0 py-16 text-center text-sm text-text-muted">Choisis un produit dans la liste.</p>
        <p v-else class="m-0 py-16 text-center text-sm text-text-faint">Chargement…</p>
      </section>
    </div>

    <section v-if="watchlist.length" class="mt-12">
      <div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="m-0 font-display text-[22px] font-semibold tracking-tight">Watchlist</h2>
        <p v-if="meta" class="m-0 text-sm text-text-muted">
          Alerte à ±{{ meta.thresholds.d1 }} % sur 1 j ou ±{{ meta.thresholds.d7 }} % sur 7 j
        </p>
      </div>
      <WatchlistTable :rows="watchlist" :selected-id="selectedId" />
    </section>
  </template>
</template>
