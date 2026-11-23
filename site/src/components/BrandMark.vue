<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M14 2 L24 14 L14 26 L4 14 Z" stroke="currentColor" stroke-width="2" />
    <path d="M14 8 L19 14 L14 20 L9 14 Z" fill="currentColor" />
  </svg>
</template>
