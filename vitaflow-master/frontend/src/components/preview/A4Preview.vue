<script setup lang="ts">
import PreviewToolbar from "./PreviewToolbar.vue"
import PdfPreviewFrame from "./PdfPreviewFrame.vue"
import PreviewFrame from "./PreviewFrame.vue"

// html 用于编辑时快速预览，pdfBlob 保留给需要精确 PDF 渲染的场景。
defineProps<{ html?: string; pdfBlob?: Blob | null; scale: number }>()

// 定义组件事件：用于向外抛出放大 (zoomIn) 和缩小 (zoomOut) 动作
const emit = defineEmits<{ zoomIn: []; zoomOut: [] }>()
function handleWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  if (event.deltaY < 0) emit("zoomIn")
  else emit("zoomOut")
}
</script>
<template>
  <section class="flex min-w-0 flex-1 flex-col overflow-hidden" @wheel="handleWheel">
    <PreviewToolbar :scale="scale" @zoom-in="$emit('zoomIn')" @zoom-out="$emit('zoomOut')" />
    <PreviewFrame v-if="html" :html="html" :scale="scale" />
    <PdfPreviewFrame v-else :pdf-blob="pdfBlob || null" :scale="scale" />
  </section>
</template>
