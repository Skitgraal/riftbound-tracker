<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
</script>

<template>
  <PageTitle title="État" />
  <EmptyState
    title="Aucune source active"
    detail="La date de dernière mise à jour de chaque source sera affichée ici, en rouge si elle est trop ancienne."
  />
</template>
