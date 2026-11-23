<script setup lang="ts">
import { computed } from 'vue';
import { direction, pct } from '../lib/format.ts';

const props = defineProps<{ value: number | null | undefined }>();
const dir = computed(() => direction(props.value));
</script>

<template>
  <span
    class="tabular-nums"
    :class="{ 'text-accent-text': dir === 'up', 'text-down': dir === 'down', 'text-text-muted': dir === 'flat' }"
  >{{ pct(value) }}</span>
</template>
