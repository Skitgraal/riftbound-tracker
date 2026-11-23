<script setup lang="ts">
import { navItems } from '../router.ts';
</script>

<template>
  <nav
    aria-label="Navigation principale"
    class="fixed inset-x-0 bottom-0 z-10 flex border-t border-border-soft bg-[#0E1016] pb-[env(safe-area-inset-bottom)] md:hidden"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-text-muted no-underline"
      exact-active-class="!text-accent-text"
    >
      <component :is="item.icon" :size="22" :stroke-width="2" aria-hidden="true" />
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
