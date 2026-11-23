<script setup lang="ts">
import { computed } from 'vue';
import { CircleAlert, CircleCheck, Clock } from 'lucide-vue-next';
import PageTitle from '../components/PageTitle.vue';
import { useData, type JobStatus, type SiteMeta } from '../lib/data.ts';
import { ago, dateTime, day, hoursSince } from '../lib/format.ts';

const { data: status, error } = useData<Record<string, JobStatus>>('status.json');
const { data: meta } = useData<SiteMeta>('meta.json');

/** Le relevé des prix passe 3 fois par jour : au-delà de 26 h sans réussite, quelque chose cloche. */
const prices = computed(() => {
  const job = status.value?.prices;
  if (!job) return undefined;
  const failing = (job.consecutiveFailures ?? 0) > 0;
  const late = hoursSince(job.lastSuccessAt) > 26;
  const guideStale = hoursSince(meta.value?.priceGuideCreatedAt) > 36;
  return { job, failing, late, ok: !failing && !late, guideStale };
});
</script>

<template>
  <PageTitle title="État" :subtitle="meta ? `Site généré ${ago(meta.generatedAt)}` : undefined" />

  <p v-if="error" class="text-sm text-down">État indisponible ({{ error }}).</p>

  <div class="grid gap-4 md:grid-cols-2">
    <section class="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="m-0 font-display text-lg font-semibold">Prix Cardmarket</h2>
          <p class="m-0 mt-1 text-sm text-text-muted">Fichiers publics, relevés 3 fois par jour</p>
        </div>
        <span
          v-if="prices"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="prices.ok ? 'bg-released-bg text-released' : 'bg-[#3A1E16] text-down'"
        >
          <component :is="prices.ok ? CircleCheck : CircleAlert" :size="14" aria-hidden="true" />
          {{ prices.ok ? 'OK' : prices.failing ? 'En échec' : 'En retard' }}
        </span>
      </div>

      <dl v-if="prices" class="m-0 mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt class="text-text-faint">Dernière réussite</dt>
        <dd class="m-0" :class="{ 'text-down': prices.late }">{{ dateTime(prices.job.lastSuccessAt) }} · {{ ago(prices.job.lastSuccessAt) }}</dd>
        <dt class="text-text-faint">Dernier passage</dt>
        <dd class="m-0">{{ dateTime(prices.job.lastRunAt) }}</dd>
        <dt class="text-text-faint">Guide de prix</dt>
        <dd class="m-0" :class="{ 'text-down': prices.guideStale }">{{ dateTime(meta?.priceGuideCreatedAt) }}</dd>
        <dt class="text-text-faint">Historique</dt>
        <dd class="m-0">
          {{ meta ? `${meta.historyDays} jour${meta.historyDays > 1 ? 's' : ''} depuis le ${day(meta.historyStart, true)}` : '—' }}
        </dd>
        <dt class="text-text-faint">Produits</dt>
        <dd class="m-0">{{ meta ? `${meta.products} au catalogue, ${meta.watched} suivis` : '—' }}</dd>
        <template v-if="prices.failing">
          <dt class="text-text-faint">Échecs d'affilée</dt>
          <dd class="m-0 text-down">{{ prices.job.consecutiveFailures }}</dd>
          <dt class="text-text-faint">Erreur</dt>
          <dd class="m-0 break-words text-down">{{ prices.job.lastError }}</dd>
        </template>
      </dl>
      <p v-else-if="status" class="m-0 mt-5 text-sm text-text-muted">Aucun passage enregistré.</p>
    </section>

    <section class="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="m-0 font-display text-lg font-semibold">Veille des sorties</h2>
          <p class="m-0 mt-1 text-sm text-text-muted">Site Riot, retailers, Reddit, toutes les 2 h</p>
        </div>
        <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-muted">
          <Clock :size="14" aria-hidden="true" />
          Bientôt
        </span>
      </div>
      <p class="m-0 mt-5 text-sm leading-relaxed text-text-muted">
        Les sources apparaîtront ici une par une, avec leur dernière mise à jour, en orange si elle est trop ancienne.
      </p>
    </section>
  </div>
</template>
