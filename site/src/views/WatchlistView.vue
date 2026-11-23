<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
</script>

<template>
  <PageTitle title="Watchlist" />
  <EmptyState
    title="Watchlist vide pour l'instant"
    detail="Tout le scellé anglais y sera suivi automatiquement, avec une alerte en cas de grosse variation."
  />
</template>
