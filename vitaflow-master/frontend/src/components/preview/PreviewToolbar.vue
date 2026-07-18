<script setup lang="ts">
import { ZoomIn, ZoomOut } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
defineProps<{ scale: number }>()
defineEmits<{ zoomIn: []; zoomOut: [] }>()
</script>
<template>
  <div class="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
    <span class="text-sm text-gray-500">简历预览 · {{ Math.round(scale * 100) }}%</span>
    <div class="flex gap-2">
      <Button size="icon" variant="outline" @click="$emit('zoomOut')"><ZoomOut class="h-4 w-4" /></Button>
      <Button size="icon" variant="outline" @click="$emit('zoomIn')"><ZoomIn class="h-4 w-4" /></Button>
    </div>
  </div>
</template>
