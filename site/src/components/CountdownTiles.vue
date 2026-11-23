<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { remaining } from '../lib/products.ts';

const props = defineProps<{ until: string; verb?: string }>();
const now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 30_000);
onBeforeUnmount(() => clearInterval(timer));

const r = computed(() => remaining(props.until, now.value));
const tiles = computed(() => [
  { v: r.value.d, l: r.value.d > 1 ? 'jours' : 'jour' },
  { v: r.value.h, l: 'h' },
  { v: r.value.m, l: 'min' },
]);
</script>

<template>
  <div class="flex gap-2" role="timer" :aria-label="`${verb ?? 'Ferme'} dans ${r.d} jour(s) ${r.h} heure(s) ${r.m} minute(s)`">
    <div v-for="t in tiles" :key="t.l" class="min-w-14 rounded-[10px] border border-urgent-border bg-[#120F0A] px-2.5 py-2 text-center">
      <div class="font-display text-[22px] leading-none font-bold text-urgent tabular-nums">{{ String(t.v).padStart(2, '0') }}</div>
      <div class="mt-1 text-[11px] text-text-muted">{{ t.l }}</div>
    </div>
  </div>
</template>
