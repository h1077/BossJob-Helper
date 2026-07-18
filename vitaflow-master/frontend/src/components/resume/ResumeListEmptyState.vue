<script setup lang="ts">
import { FileStack } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"

defineEmits<{
  create: []
}>()
</script>

<template>
  <div class="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-24 text-center shadow-sm">
    <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50">
      <FileStack class="h-8 w-8 text-zinc-300" />
    </div>
    <h2 class="mt-6 text-lg font-medium tracking-tight text-zinc-900">空空如也</h2>
    <p class="mt-2 max-w-sm text-sm text-zinc-500">你还没有创建任何简历。选择一个心仪的模板开始，或者让 AI 帮你快速搞定。</p>
    <div class="mt-8 flex gap-4">
      <Button class="bg-zinc-900 px-6 text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-95" @click="$emit('create')">创建简历</Button>
    </div>
  </div>
</template>
