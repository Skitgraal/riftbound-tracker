<script setup lang="ts">
import BrandMark from './BrandMark.vue';

defineProps<{ title: string; detail?: string }>();
</script>

<template>
  <div class="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-16 text-center">
    <BrandMark :size="40" class="text-border" />
    <p class="font-display text-lg font-semibold">{{ title }}</p>
    <p v-if="detail" class="max-w-md text-sm leading-relaxed text-text-muted">{{ detail }}</p>
  </div>
</template>
