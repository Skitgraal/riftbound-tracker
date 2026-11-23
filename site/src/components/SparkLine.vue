<script setup lang="ts">
import { computed } from 'vue';

/** Mini-courbe décorative : les valeurs exactes sont dans les colonnes du tableau. */
const props = defineProps<{ values: (number | null)[] | undefined }>();

const W = 96;
const H = 24;
const PAD = 2;

const shape = computed(() => {
  const pts = (props.values ?? []).map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  const count = props.values?.length ?? 0;
  if (pts.length < 2) return undefined;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => PAD + (i / Math.max(1, count - 1)) * (W - 2 * PAD);
  const y = (v: number) => (max === min ? H / 2 : PAD + (1 - (v - min) / (max - min)) * (H - 2 * PAD));
  const first = pts[0]!.v;
  const last = pts.at(-1)!.v;
  const change = (last - first) / first;
  return {
    d: pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' '),
    color: Math.abs(change) < 0.0005 ? '#6B7385' : change > 0 ? '#4FD1C5' : '#FF9B7A',
  };
});
</script>

<template>
  <svg :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true" class="block">
    <path v-if="shape" :d="shape.d" fill="none" :stroke="shape.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <line v-else :x1="PAD" :x2="W - PAD" :y1="H / 2" :y2="H / 2" stroke="#232836" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round" />
  </svg>
</template>
