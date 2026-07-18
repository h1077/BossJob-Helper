<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import MainLayout from "@/components/layout/MainLayout.vue"

const route = useRoute()
const isCustomLayout = computed(() => {
  return route.path === "/login"
    || route.path === "/register"
    || route.path.includes("/edit")
    || route.path.startsWith("/share/")
})
</script>

<template>
  <template v-if="isCustomLayout">
    <RouterView />
  </template>
  <MainLayout v-else>
    <RouterView />
  </MainLayout>
</template>
