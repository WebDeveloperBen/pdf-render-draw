<template>
  <LoaderCircle class="animate-spin" v-bind="$attrs" />
</template>

<script lang="ts" setup>
import { LoaderCircle } from "lucide-vue-next"

defineOptions({ inheritAttrs: false })
</script>
