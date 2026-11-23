<script setup lang="ts">
import { navItems } from '../router.ts';
import BrandMark from './BrandMark.vue';
</script>

<template>
  <header class="border-b border-border-soft bg-bg">
    <div class="mx-auto flex max-w-[1280px] items-center gap-6 px-4 py-4 sm:px-6">
      <RouterLink to="/" class="flex items-center gap-2.5 text-text no-underline">
        <BrandMark class="text-accent" />
        <span class="font-display text-[17px] font-bold tracking-tight">Riftbound Tracker</span>
      </RouterLink>

      <nav aria-label="Navigation principale" class="hidden flex-1 gap-1 md:flex">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="rounded-lg px-3.5 py-2.5 text-sm font-medium text-text-muted no-underline transition-colors hover:bg-surface-2 hover:text-text"
          active-class=""
          exact-active-class="!bg-surface-2 !text-text"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
