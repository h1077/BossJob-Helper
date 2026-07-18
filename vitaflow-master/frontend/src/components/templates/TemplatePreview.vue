<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

const props = defineProps<{ html?: string }>()
const frameWrap = ref<HTMLDivElement | null>(null)
const wrapWidth = ref(0)
let observer: ResizeObserver | null = null

const pageWidth = 794
const pageHeight = 1123
const scale = computed(() => (wrapWidth.value ? wrapWidth.value / pageWidth : 0.5))
const wrapHeight = computed(() => `${Math.round(pageHeight * scale.value)}px`)
const iframeStyle = computed(() => ({
  width: `${pageWidth}px`,
  height: `${pageHeight}px`,
  transform: `scale(${scale.value})`,
}))

const cleanHtml = computed(() => {
  if (!props.html) return ""
  return props.html + "<style>html, body { overflow: hidden !important; background: white !important; }</style>"
})

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    wrapWidth.value = entries[0]?.contentRect.width || 0
  })
  if (frameWrap.value) observer.observe(frameWrap.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="frameWrap" class="overflow-hidden rounded-lg border border-zinc-100/80 bg-white" :style="{ height: wrapHeight }">
    <iframe
      v-if="html"
      :key="html ? html.length : 0"
      class="pointer-events-none origin-top-left border-0"
      :srcdoc="cleanHtml"
      :style="iframeStyle"
      sandbox=""
      tabindex="-1"
      scrolling="no"
    />
    <div v-else class="flex h-full items-center justify-center text-sm text-gray-400">暂无预览</div>
  </div>
</template>
