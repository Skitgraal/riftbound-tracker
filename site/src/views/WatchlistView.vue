<script setup lang="ts">
import { computed } from 'vue';
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
import WatchlistTable from '../components/WatchlistTable.vue';
import { useData, type PriceRow, type SiteMeta } from '../lib/data.ts';
import { bySetThenType } from '../lib/sort.ts';

const { data: rows, error } = useData<PriceRow[]>('prices/index.json');
const { data: meta } = useData<SiteMeta>('meta.json');

const watched = computed(() => (rows.value ?? []).filter((r) => r.watched).sort(bySetThenType));
const cards = computed(() => watched.value.filter((r) => r.kind === 'single'));
const sealed = computed(() => watched.value.filter((r) => r.kind === 'sealed'));
</script>

<template>
  <PageTitle
    title="Watchlist"
    :subtitle="meta ? `Alerte Discord à ±${meta.thresholds.d1} % sur 1 j ou ±${meta.thresholds.d7} % sur 7 j, au-dessus de ${meta.thresholds.minPrice} €` : undefined"
  />

  <EmptyState v-if="error" title="Watchlist indisponible" :detail="`Les données n'ont pas pu être chargées (${error}).`" />
  <p v-else-if="!rows" class="text-sm text-text-faint">Chargement…</p>
  <EmptyState v-else-if="watched.length === 0" title="Aucun produit suivi" detail="Le scellé anglais apparaîtra ici dès le prochain relevé Cardmarket." />

  <template v-else>
    <section class="mb-10">
      <h2 class="m-0 mb-1 font-display text-lg font-semibold">Scellé anglais</h2>
      <p class="m-0 mb-4 text-sm text-text-muted">Suivi automatiquement : chaque nouveau produit y entre seul.</p>
      <WatchlistTable :rows="sealed" />
    </section>

    <section>
      <h2 class="m-0 mb-1 font-display text-lg font-semibold">Cartes</h2>
      <WatchlistTable v-if="cards.length" :rows="cards" />
      <p v-else class="m-0 max-w-2xl text-sm leading-relaxed text-text-muted">
        Aucune carte suivie. Pour en ajouter une, mets son identifiant Cardmarket dans
        <code class="rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-text">config/watchlist.yml</code>
        (modifiable directement sur GitHub). L'identifiant est à la fin de l'adresse de sa page Prix ici, après
        <code class="rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-text">id=</code>.
      </p>
    </section>
  </template>
</template>
