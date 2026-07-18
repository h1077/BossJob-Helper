<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from "vue"

const props = defineProps<{ modelValue?: string; placeholder?: string; rows?: number }>()
const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

function adjustHeight() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

watch(() => props.modelValue, () => {
  nextTick(adjustHeight)
})

onMounted(() => {
  nextTick(adjustHeight)
})

function onInput(event: Event) {
  adjustHeight()
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>
<template>
  <textarea ref="textareaRef" :rows="rows || 5" :value="modelValue" :placeholder="placeholder" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-500" style="overflow: hidden;" @input="onInput" />
</template>
