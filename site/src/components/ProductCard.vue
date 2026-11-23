<script setup lang="ts">
import { ShieldCheck, ShieldQuestion } from 'lucide-vue-next';
import { euro } from '../lib/format.ts';
import { fuzzyLabel, money, TYPE_LABELS, type ProductSummary } from '../lib/products.ts';
import ProductArt from './ProductArt.vue';
import StatusChip from './StatusChip.vue';

defineProps<{ product: ProductSummary }>();
</script>

<template>
  <RouterLink
    :to="`/produit/${product.slug}`"
    class="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-text no-underline transition duration-150 hover:-translate-y-0.5 hover:border-[#3A4256]"
  >
    <div class="relative">
      <ProductArt :product="product" class="aspect-[4/3]" />
      <StatusChip :status="product.status" class="absolute top-3 left-3" />
    </div>
    <div class="flex flex-1 flex-col gap-1 p-4">
      <h3 class="m-0 font-display text-base leading-snug font-semibold">{{ product.name }}</h3>
      <p class="m-0 text-[13px] text-text-faint">
        {{ [product.set, TYPE_LABELS[product.type], 'EN'].filter(Boolean).join(' · ') }}
      </p>
      <div class="mt-3 flex items-end justify-between gap-3">
        <div>
          <p class="m-0 text-xs text-text-faint">{{ product.status === 'released' ? 'Sorti' : 'Sortie' }}</p>
          <p class="m-0 mt-0.5 text-sm font-medium">{{ fuzzyLabel(product.releaseDate) }}</p>
        </div>
        <div class="text-right">
          <p class="m-0 text-xs text-text-faint">{{ product.market?.trend ? 'Marché' : 'Prix officiel' }}</p>
          <p class="m-0 mt-0.5 font-display text-sm font-semibold tabular-nums">
            {{ product.market?.trend ? euro(product.market.trend) : money(product.msrp) }}
          </p>
        </div>
      </div>
      <p class="m-0 mt-3 flex items-center gap-1.5 border-t border-border-soft pt-3 text-xs" :class="product.reliability === 'confirmed' ? 'text-accent-text' : 'text-rumor'">
        <component :is="product.reliability === 'confirmed' ? ShieldCheck : ShieldQuestion" :size="14" aria-hidden="true" />
        {{ product.reliability === 'confirmed' ? 'Confirmé par Riot' : 'Non confirmé' }}
        <span v-if="product.sources" class="ml-auto text-text-faint">{{ product.sources }} source{{ product.sources > 1 ? 's' : '' }}</span>
      </p>
    </div>
  </RouterLink>
</template>
