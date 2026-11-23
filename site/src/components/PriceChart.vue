<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SeriesPoint } from '../lib/data.ts';
import { day, euro } from '../lib/format.ts';

const props = defineProps<{ points: SeriesPoint[] }>();

/** Couleurs validées contre la surface sombre (palette à 2 séries, daltonisme compris). */
const TREND = '#2FA89D';
const LOW = '#8B7CF6';

const ranges = [
  { key: '7', label: '7 j', days: 7 },
  { key: '30', label: '30 j', days: 30 },
  { key: '90', label: '90 j', days: 90 },
  { key: 'all', label: 'Tout', days: Infinity },
] as const;
const range = ref<(typeof ranges)[number]['key']>('30');

const visible = computed(() => {
  const days = ranges.find((r) => r.key === range.value)!.days;
  const last = props.points.at(-1);
  if (!last || days === Infinity) return props.points;
  const from = new Date(`${last[0]}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days);
  const cutoff = from.toISOString().slice(0, 10);
  return props.points.filter((p) => p[0] > cutoff);
});

// Largeur réelle du conteneur : le SVG est dessiné en pixels, pas étiré.
const box = ref<HTMLElement>();
const width = ref(320);
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(280, Math.round(entry.contentRect.width));
  });
  if (box.value) observer.observe(box.value);
});
onBeforeUnmount(() => observer?.disconnect());

const H = 260;
const M = { top: 12, right: 12, bottom: 28, left: 56 };

function niceStep(span: number, count: number): number {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
}

const chart = computed(() => {
  const pts = visible.value;
  const values = pts.flatMap((p) => [p[1], p[2]]).filter((v): v is number => v !== null);
  if (pts.length === 0 || values.length === 0) return undefined;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min *= 0.9;
    max *= 1.1;
  }
  const step = niceStep(max - min, 4);
  const y0 = Math.max(0, Math.floor(min / step) * step);
  const y1 = Math.ceil(max / step) * step;
  const innerW = width.value - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * innerH;

  const line = (col: 1 | 2) => {
    let d = '';
    let pen = false;
    pts.forEach((p, i) => {
      const v = p[col];
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const trendPts = pts.map((p, i) => ({ i, v: p[1] })).filter((p): p is { i: number; v: number } => p.v !== null);
  const area =
    trendPts.length > 1
      ? `M${x(trendPts[0]!.i)} ${y(y0)} ` +
        trendPts.map((p) => `L${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ') +
        ` L${x(trendPts.at(-1)!.i)} ${y(y0)} Z`
      : '';

  const ticks: number[] = [];
  for (let v = y0; v <= y1 + step / 2; v += step) ticks.push(v);
  const xLabelCount = Math.min(pts.length, width.value < 480 ? 3 : 5);
  const xLabels =
    pts.length === 1
      ? [0]
      : [...new Set(Array.from({ length: xLabelCount }, (_, k) => Math.round((k / Math.max(1, xLabelCount - 1)) * (pts.length - 1))))];

  return { pts, x, y, ticks, xLabels, trend: line(1), low: line(2), area, innerW, innerH };
});

// Survol : le réticule s'aligne sur le relevé le plus proche du pointeur.
const hover = ref<number>();
watch(visible, () => (hover.value = undefined));

function onPointer(event: PointerEvent) {
  const c = chart.value;
  if (!c) return;
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
  const px = event.clientX - rect.left;
  const n = c.pts.length;
  hover.value = n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round(((px - M.left) / c.innerW) * (n - 1))));
}

function onKey(event: KeyboardEvent) {
  const n = chart.value?.pts.length ?? 0;
  if (!n) return;
  const current = hover.value ?? n - 1;
  if (event.key === 'ArrowLeft') hover.value = Math.max(0, current - 1);
  else if (event.key === 'ArrowRight') hover.value = Math.min(n - 1, current + 1);
  else if (event.key === 'Home') hover.value = 0;
  else if (event.key === 'End') hover.value = n - 1;
  else return;
  event.preventDefault();
}

const tip = computed(() => {
  const c = chart.value;
  if (!c || hover.value === undefined) return undefined;
  const p = c.pts[hover.value];
  if (!p) return undefined;
  const left = c.x(hover.value);
  return { p, left, flip: left > width.value - 180 };
});

const tickLabel = (v: number) => (v >= 100 ? `${Math.round(v)} €` : `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`);
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-5 text-[13px] text-text-muted">
        <span class="flex items-center gap-2">
          <svg width="18" height="4" aria-hidden="true"><line x1="1" x2="17" y1="2" y2="2" :stroke="TREND" stroke-width="2" stroke-linecap="round" /></svg>
          Tendance
        </span>
        <span class="flex items-center gap-2">
          <svg width="18" height="4" aria-hidden="true"><line x1="1" x2="17" y1="2" y2="2" :stroke="LOW" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round" /></svg>
          Plus bas
        </span>
      </div>
      <div class="flex gap-0.5 rounded-[9px] border border-border bg-bg p-0.5" role="group" aria-label="Période">
        <button
          v-for="r in ranges"
          :key="r.key"
          type="button"
          class="h-8 cursor-pointer rounded-[7px] border-0 px-3 text-[13px] font-medium transition-colors"
          :class="range === r.key ? 'bg-border text-text' : 'bg-transparent text-text-muted hover:text-text'"
          :aria-pressed="range === r.key"
          @click="range = r.key"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <div ref="box" class="relative w-full min-w-0 overflow-hidden">
      <svg
        v-if="chart"
        :width="width"
        :height="H"
        class="block touch-pan-y outline-none"
        role="img"
        tabindex="0"
        :aria-label="`Courbe des prix sur ${chart.pts.length} relevé(s). Flèches gauche et droite pour parcourir.`"
        @pointermove="onPointer"
        @pointerdown="onPointer"
        @pointerleave="hover = undefined"
        @keydown="onKey"
        @blur="hover = undefined"
      >
        <g>
          <template v-for="t in chart.ticks" :key="t">
            <line :x1="M.left" :x2="width - M.right" :y1="chart.y(t)" :y2="chart.y(t)" stroke="#1A1E28" stroke-width="1" />
            <text :x="M.left - 10" :y="chart.y(t)" text-anchor="end" dominant-baseline="middle" fill="#7D8698" font-size="11" class="tabular-nums">
              {{ tickLabel(t) }}
            </text>
          </template>
          <text
            v-for="i in chart.xLabels"
            :key="`x${i}`"
            :x="chart.x(i)"
            :y="H - 8"
            :text-anchor="chart.pts.length === 1 ? 'middle' : i === 0 ? 'start' : i === chart.pts.length - 1 ? 'end' : 'middle'"
            fill="#7D8698"
            font-size="11"
          >
            {{ day(chart.pts[i]?.[0]) }}
          </text>
        </g>

        <path v-if="chart.area" :d="chart.area" :fill="TREND" fill-opacity="0.08" />
        <path :d="chart.low" fill="none" :stroke="LOW" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round" />
        <path :d="chart.trend" fill="none" :stroke="TREND" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Un seul relevé : des points plutôt qu'une ligne invisible -->
        <template v-if="chart.pts.length === 1">
          <circle v-if="chart.pts[0]![1] !== null" :cx="chart.x(0)" :cy="chart.y(chart.pts[0]![1]!)" r="5" :fill="TREND" stroke="#12151C" stroke-width="2" />
          <circle v-if="chart.pts[0]![2] !== null" :cx="chart.x(0)" :cy="chart.y(chart.pts[0]![2]!)" r="5" :fill="LOW" stroke="#12151C" stroke-width="2" />
        </template>

        <g v-if="tip">
          <line :x1="tip.left" :x2="tip.left" :y1="M.top" :y2="H - M.bottom" stroke="#9AA3B5" stroke-opacity="0.5" stroke-width="1" />
          <circle v-if="tip.p[1] !== null" :cx="tip.left" :cy="chart.y(tip.p[1])" r="5" :fill="TREND" stroke="#12151C" stroke-width="2" />
          <circle v-if="tip.p[2] !== null" :cx="tip.left" :cy="chart.y(tip.p[2])" r="5" :fill="LOW" stroke="#12151C" stroke-width="2" />
        </g>
      </svg>

      <div
        v-if="tip"
        class="pointer-events-none absolute top-2 min-w-40 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[13px]"
        :style="tip.flip ? { right: `${width - tip.left + 12}px` } : { left: `${tip.left + 12}px` }"
        aria-live="polite"
      >
        <p class="m-0 mb-1.5 text-xs text-text-faint">{{ day(tip.p[0], true) }}</p>
        <p class="m-0 flex items-center justify-between gap-4">
          <span class="font-display font-semibold tabular-nums text-text">{{ euro(tip.p[1]) }}</span>
          <span class="flex items-center gap-1.5 text-text-muted">
            <svg width="12" height="4" aria-hidden="true"><line x1="1" x2="11" y1="2" y2="2" :stroke="TREND" stroke-width="2" stroke-linecap="round" /></svg>
            Tendance
          </span>
        </p>
        <p class="m-0 mt-1 flex items-center justify-between gap-4">
          <span class="font-display font-semibold tabular-nums text-text">{{ euro(tip.p[2]) }}</span>
          <span class="flex items-center gap-1.5 text-text-muted">
            <svg width="12" height="4" aria-hidden="true"><line x1="1" x2="11" y1="2" y2="2" :stroke="LOW" stroke-width="2" stroke-dasharray="3 2" /></svg>
            Plus bas
          </span>
        </p>
      </div>

      <p v-if="!chart" class="m-0 py-16 text-center text-sm text-text-muted">Pas de prix sur cette période.</p>
    </div>

    <details class="mt-4 text-sm">
      <summary class="cursor-pointer text-text-muted hover:text-text">Voir les relevés</summary>
      <div class="mt-3 max-h-72 overflow-auto rounded-[10px] border border-border-soft">
        <table class="w-full border-collapse text-left tabular-nums">
          <thead>
            <tr class="text-xs uppercase tracking-[0.06em] text-text-faint">
              <th class="sticky top-0 bg-surface px-4 py-2.5 font-medium">Date</th>
              <th class="sticky top-0 bg-surface px-4 py-2.5 text-right font-medium">Tendance</th>
              <th class="sticky top-0 bg-surface px-4 py-2.5 text-right font-medium">Plus bas</th>
              <th class="sticky top-0 bg-surface px-4 py-2.5 text-right font-medium">Moyenne</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in [...visible].reverse()" :key="p[0]" class="border-t border-border-soft">
              <td class="px-4 py-2">{{ day(p[0], true) }}</td>
              <td class="px-4 py-2 text-right">{{ euro(p[1]) }}</td>
              <td class="px-4 py-2 text-right">{{ euro(p[2]) }}</td>
              <td class="px-4 py-2 text-right">{{ euro(p[3]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
