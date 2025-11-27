<script setup lang="ts">
const route = useRoute("projects-id")
const projectId = route.params.id

useSeoMeta({ title: `Project ${projectId}` })
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Project Details</h1>
    <p class="text-muted-foreground">Project ID: {{ projectId }}</p>
  </div>
</template>
