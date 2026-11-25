<script setup lang="ts">
import { computed } from 'vue';
import { TriangleAlert } from 'lucide-vue-next';
import { useData, type SiteMeta } from '../lib/data.ts';
import { ago, hoursSince, parseInstant } from '../lib/format.ts';

/**
 * Bandeau « données périmées ». La veille republie le site toutes les 2 h : au-delà de 8 h sans nouvelle version,
 * les passages automatiques sont arrêtés (panne GitHub, workflow désactivé…). Le guide Cardmarket est quotidien.
 */
const { data: meta } = useData<SiteMeta>('meta.json');

const problem = computed(() => {
  const m = meta.value;
  if (!m) return null;
  if (hoursSince(m.generatedAt) > 8) {
    return `Site pas mis à jour depuis ${ago(m.generatedAt).replace(/^il y a /, '')} : les passages automatiques semblent arrêtés. Les sorties, tirages et prix affichés peuvent être dépassés.`;
  }
  if (hoursSince(m.priceGuideCreatedAt) > 48) {
    return `Prix Cardmarket du ${parseInstant(m.priceGuideCreatedAt!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : le relevé quotidien ne passe plus.`;
  }
  return null;
});
</script>

<template>
  <div v-if="problem" role="alert" class="border-b border-[#5A2E22] bg-[#2A1610]">
    <div class="mx-auto flex max-w-[1280px] items-start gap-3 px-4 py-3 text-sm text-[#FFD2C2] sm:px-6">
      <TriangleAlert :size="18" class="mt-0.5 shrink-0 text-down" aria-hidden="true" />
      <p class="m-0">
        {{ problem }}
        <RouterLink to="/etat" class="font-semibold text-[#FFD2C2] underline">Voir l'état</RouterLink> ·
        <a href="https://github.com/Skitgraal/riftbound-tracker/actions" target="_blank" rel="noopener" class="font-semibold text-[#FFD2C2] underline">GitHub Actions</a>
      </p>
    </div>
  </div>
</template>
