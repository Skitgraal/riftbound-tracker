<script setup lang="ts">
import type { PriceRow } from '../lib/data.ts';
import { euro } from '../lib/format.ts';
import DeltaValue from './DeltaValue.vue';
import SparkLine from './SparkLine.vue';

defineProps<{ rows: PriceRow[]; selectedId?: number }>();
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border border-border bg-surface">
    <table class="w-full min-w-[760px] border-collapse text-left text-sm">
      <thead>
        <tr class="text-xs uppercase tracking-[0.06em] text-text-faint">
          <th class="border-b border-border px-[18px] py-3.5 font-medium">Produit</th>
          <th class="border-b border-border px-[18px] py-3.5 font-medium">Type</th>
          <th class="border-b border-border px-[18px] py-3.5 text-right font-medium">Tendance</th>
          <th class="border-b border-border px-[18px] py-3.5 text-right font-medium">Plus bas</th>
          <th class="border-b border-border px-[18px] py-3.5 text-right font-medium">1 j</th>
          <th class="border-b border-border px-[18px] py-3.5 text-right font-medium">7 j</th>
          <th class="border-b border-border px-[18px] py-3.5 text-right font-medium">30 j</th>
          <th class="border-b border-border px-[18px] py-3.5 font-medium">7 derniers jours</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.id"
          class="transition-colors hover:bg-[#151922]"
          :class="{ 'bg-surface-2': r.id === selectedId }"
        >
          <td class="border-b border-border-soft px-[18px] py-3">
            <RouterLink :to="{ path: '/prix', query: { id: r.id } }" class="font-medium text-text no-underline hover:text-accent-text">
              {{ r.name }}
            </RouterLink>
            <span class="block text-xs text-text-faint">{{ r.set }}</span>
          </td>
          <td class="whitespace-nowrap border-b border-border-soft px-[18px] py-3 text-text-muted">{{ r.category }}</td>
          <td class="whitespace-nowrap border-b border-border-soft px-[18px] py-3 text-right font-display font-semibold tabular-nums">{{ euro(r.trend) }}</td>
          <td class="whitespace-nowrap border-b border-border-soft px-[18px] py-3 text-right tabular-nums text-text-muted">{{ euro(r.low) }}</td>
          <td class="whitespace-nowrap border-b border-border-soft px-[18px] py-3 text-right"><DeltaValue :value="r.d1" /></td>
          <td class="whitespace-nowrap border-b border-border-soft px-[18px] py-3 text-right"><DeltaValue :value="r.d7" /></td>
          <td class="whitespace-nowrap border-b border-border-soft px-[18px] py-3 text-right"><DeltaValue :value="r.d30" /></td>
          <td class="border-b border-border-soft px-[18px] py-3"><SparkLine :values="r.spark" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
