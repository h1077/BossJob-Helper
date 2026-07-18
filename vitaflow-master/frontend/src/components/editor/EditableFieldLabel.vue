<script setup lang="ts">
import { computed } from "vue"
import { Pencil, RotateCcw } from "lucide-vue-next"

const props = defineProps<{
  modelValue: string
  fallbackLabel: string
  customized?: boolean
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
  reset: []
}>()

const inputSize = computed(() => {
  const text = props.modelValue || props.fallbackLabel || "标题已隐藏"
  const len = text.split("").reduce((acc, char) => acc + (char.charCodeAt(0) > 255 ? 2 : 1), 0)
  return Math.max(12, Math.min(32, len + 2))
})
</script>

<template>
  <div class="group mb-1.5 inline-flex h-7 max-w-full items-center gap-1">
    <div class="relative min-w-0">
      <input
        :value="modelValue"
        :size="inputSize"
        placeholder="标题已隐藏"
        class="h-7 max-w-[220px] rounded-md border border-transparent bg-transparent py-0 pl-1 pr-6 text-[13px] font-medium text-zinc-600 outline-none transition placeholder:text-zinc-300 hover:border-zinc-200 hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
        aria-label="编辑字段展示标题"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <Pencil class="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-300 transition group-hover:text-zinc-400" />
    </div>
    <button
      v-if="customized"
      type="button"
      class="flex h-6 w-6 items-center justify-center rounded-md text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600"
      :title="`恢复默认标题：${fallbackLabel}`"
      @click="emit('reset')"
    >
      <RotateCcw class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
