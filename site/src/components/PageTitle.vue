<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="mb-8 flex flex-wrap items-baseline justify-between gap-4">
    <h1 class="m-0 font-display text-[28px] font-bold tracking-tight sm:text-[32px]">{{ title }}</h1>
    <p v-if="subtitle" class="m-0 text-sm text-text-muted">{{ subtitle }}</p>
  </div>
</template>
