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

/** La veille passe toutes les 2 h : au-delà de 6 h sans réussite, elle est en retard. */
const watchJob = computed(() => {
  const job = status.value?.watch;
  if (!job) return undefined;
  const failing = (job.consecutiveFailures ?? 0) > 0;
  const late = hoursSince(job.lastSuccessAt) > 6;
  return { job, failing, late, ok: !failing && !late };
});

const sources = computed(() =>
  (meta.value?.sources ?? []).map((s) => {
    const job = status.value?.[`source:${s.id}`];
    return { ...s, job, failing: (job?.consecutiveFailures ?? 0) > 0, late: hoursSince(job?.lastSuccessAt) > 6 };
  }),
);
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
          <p class="m-0 mt-1 text-sm text-text-muted">Passage toutes les 2 h</p>
        </div>
        <span
          v-if="watchJob"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="watchJob.ok ? 'bg-released-bg text-released' : 'bg-[#3A1E16] text-down'"
        >
          <component :is="watchJob.ok ? CircleCheck : CircleAlert" :size="14" aria-hidden="true" />
          {{ watchJob.ok ? 'OK' : watchJob.failing ? 'En échec' : 'En retard' }}
        </span>
        <span v-else class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-muted">
          <Clock :size="14" aria-hidden="true" />
          Pas encore lancée
        </span>
      </div>

      <dl v-if="watchJob" class="m-0 mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt class="text-text-faint">Dernière réussite</dt>
        <dd class="m-0" :class="{ 'text-down': watchJob.late }">{{ dateTime(watchJob.job.lastSuccessAt) }} · {{ ago(watchJob.job.lastSuccessAt) }}</dd>
        <dt class="text-text-faint">Fiches</dt>
        <dd class="m-0">{{ watchJob.job.info?.products ?? '—' }}</dd>
        <dt class="text-text-faint">Lecture auto (LLM)</dt>
        <dd class="m-0" :class="{ 'text-down': watchJob.job.info?.llm === 'indisponible' }">
          {{ watchJob.job.info?.llm === 'indisponible' ? 'indisponible : les articles attendent' : 'OK' }}
        </dd>
        <dt class="text-text-faint">En attente</dt>
        <dd class="m-0">{{ watchJob.job.info?.pending ?? 0 }} article(s)</dd>
      </dl>

      <ul v-if="sources.length" class="m-0 mt-5 list-none border-t border-border-soft p-0 pt-4">
        <li v-for="s in sources" :key="s.id" class="flex items-start justify-between gap-4 py-2 text-sm">
          <span class="min-w-0">
            <a :href="s.url" target="_blank" rel="noopener" class="font-medium">{{ s.name }}</a>
            <span v-if="s.job?.lastError && s.failing" class="block break-words text-xs text-down">{{ s.job.lastError }}</span>
            <span v-else class="block text-xs text-text-faint">{{ s.enabled ? `Lue ${ago(s.job?.lastSuccessAt)}` : 'Désactivée' }}</span>
          </span>
          <span
            class="mt-1 size-2 shrink-0 rounded-full"
            :class="!s.enabled ? 'bg-border' : s.failing || s.late ? 'bg-down' : 'bg-accent'"
            :title="s.failing ? 'En échec' : s.late ? 'Pas lue depuis plus de 6 h' : 'OK'"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
