<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
</script>

<template>
  <PageTitle title="Tirages" />
  <EmptyState
    title="Aucun tirage ouvert"
    detail="Les tirages de la boutique Riot s'afficheront ici avec leur compte à rebours. Les rappels arrivent sur Discord."
  />
</template>
