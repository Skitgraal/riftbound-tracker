<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
</script>

<template>
  <PageTitle title="Prix" subtitle="Source : Cardmarket" />
  <EmptyState
    title="Historique en construction"
    detail="Les prix Cardmarket du scellé et des cartes seront relevés chaque jour et affichés ici sous forme de courbes."
  />
</template>
