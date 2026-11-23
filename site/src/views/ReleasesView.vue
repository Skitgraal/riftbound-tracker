<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
</script>

<template>
  <PageTitle title="Sorties" subtitle="Heure de Paris" />
  <EmptyState
    title="La veille démarre bientôt"
    detail="Les produits annoncés par Riot, les leaks et les précommandes apparaîtront ici automatiquement."
  />
</template>
