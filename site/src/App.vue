<script setup lang="ts">
import AppHeader from './components/AppHeader.vue';
import MobileTabs from './components/MobileTabs.vue';
</script>

<template>
  <div class="min-h-dvh bg-bg text-text">
    <AppHeader />
    <main class="mx-auto max-w-[1280px] px-4 pt-6 pb-28 sm:px-6 sm:pt-10 md:pb-16">
      <RouterView />
    </main>
    <MobileTabs />
  </div>
</template>
