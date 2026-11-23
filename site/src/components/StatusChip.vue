<script setup lang="ts">
import { STATUS_LABELS, type Status } from '../lib/products.ts';

const props = defineProps<{ status: Status | 'official' | 'relay' | 'leak'; label?: string }>();

const STYLES: Record<string, string> = {
  rumor: 'bg-rumor-bg text-rumor',
  leak: 'bg-rumor-bg text-rumor',
  announced: 'bg-announced-bg text-announced',
  relay: 'bg-announced-bg text-announced',
  preorder: 'bg-preorder-bg text-preorder',
  released: 'bg-released-bg text-released',
  official: 'bg-released-bg text-released',
  cancelled: 'bg-surface-2 text-text-muted',
};
const TIER: Record<string, string> = { official: 'Officiel', relay: 'Relais', leak: 'Leak' };
</script>

<template>
  <span
    class="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tracking-[0.02em] whitespace-nowrap"
    :class="STYLES[props.status]"
  >
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ label ?? STATUS_LABELS[props.status as Status] ?? TIER[props.status] }}
  </span>
</template>
