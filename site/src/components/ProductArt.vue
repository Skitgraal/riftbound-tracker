<script setup lang="ts">
import { computed, ref } from 'vue';
import { artTint, imageUrl, monogram, type ProductSummary } from '../lib/products.ts';

const props = defineProps<{ product: Pick<ProductSummary, 'image' | 'set' | 'name'>; large?: boolean }>();
const failed = ref(false);
const src = computed(() => (failed.value ? null : imageUrl(props.product)));
</script>

<template>
  <div class="relative flex items-center justify-center overflow-hidden" :style="{ backgroundColor: artTint(product) }">
    <img
      v-if="src"
      :src="src"
      :alt="product.name"
      loading="lazy"
      class="size-full object-contain"
      :class="large ? 'p-6' : 'p-4'"
      @error="failed = true"
    />
    <div v-else class="flex flex-col items-center gap-2 text-text-faint">
      <span class="font-display font-bold tracking-tight text-text-muted" :class="large ? 'text-5xl' : 'text-3xl'">{{ monogram(product) }}</span>
      <span class="text-xs font-medium">Image à venir</span>
    </div>
  </div>
</template>
