<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs"

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

const CSS_UNITS = 96 / 72

const props = defineProps<{ pdfBlob: Blob | null; scale: number }>()

const scroller = ref<HTMLDivElement | null>(null)
const pages = ref<Array<{ pageNumber: number; width: number; height: number }>>([])
const loading = ref(false)
const error = ref("")
const dragging = ref(false)
const canvasRefs = new Map<number, HTMLCanvasElement>()
const pageCache = new Map<number, PDFPageProxy>()
let pdfDoc: PDFDocumentProxy | null = null
let loadSeq = 0
let pdfjsPromise: Promise<PdfJsModule> | null = null
let dragStartX = 0
let dragStartY = 0
let dragStartScrollLeft = 0
let dragStartScrollTop = 0
let scrollerResizeObserver: ResizeObserver | null = null
let lastScrollerWidth = 0

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

function setCanvasRef(el: Element | null, pageNumber: number) {
  if (el instanceof HTMLCanvasElement) canvasRefs.set(pageNumber, el)
}

function startDrag(event: PointerEvent) {
  const el = scroller.value
  if (!el || event.button !== 0) return
  dragging.value = true
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartScrollLeft = el.scrollLeft
  dragStartScrollTop = el.scrollTop
  el.setPointerCapture?.(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  const el = scroller.value
  if (!el || !dragging.value) return
  event.preventDefault()
  el.scrollLeft = dragStartScrollLeft - (event.clientX - dragStartX)
  el.scrollTop = dragStartScrollTop - (event.clientY - dragStartY)
}

function stopDrag(event: PointerEvent) {
  const el = scroller.value
  if (!dragging.value) return
  dragging.value = false
  el?.releasePointerCapture?.(event.pointerId)
}

async function centerHorizontal() {
  await nextTick()
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  const el = scroller.value
  if (!el || el.clientWidth <= 0) return
  el.scrollLeft = Math.max((el.scrollWidth - el.clientWidth) / 2, 0)
}

async function destroyCurrentPdf() {
  pageCache.clear()
  canvasRefs.clear()
  if (pdfDoc) {
    const current = pdfDoc
    pdfDoc = null
    await Promise.resolve((current as any).destroy?.()).catch(() => undefined)
  }
}

async function renderPage(pageNumber: number, seq: number) {
  const canvas = canvasRefs.get(pageNumber)
  const page = pageCache.get(pageNumber)
  if (!canvas || !page || seq !== loadSeq) return

  const viewport = page.getViewport({ scale: CSS_UNITS })
  const outputScale = Math.min(window.devicePixelRatio || 1, 2)
  const context = canvas.getContext("2d")
  if (!context) return

  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)

  await page
    .render({
      canvas,
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    })
    .promise.catch((err: any) => {
      if (seq === loadSeq) throw err
    })
}

async function loadPdf(blob: Blob | null) {
  const seq = ++loadSeq
  error.value = ""
  pages.value = []
  await destroyCurrentPdf()

  if (!blob) return

  loading.value = true
  try {
    const buffer = await blob.arrayBuffer()
    if (seq !== loadSeq) return

    const { getDocument } = await loadPdfjs()
    const task = getDocument({ data: new Uint8Array(buffer) })
    const doc = await task.promise
    if (seq !== loadSeq) {
      await Promise.resolve((doc as any).destroy?.()).catch(() => undefined)
      return
    }

    pdfDoc = doc
    const nextPages: Array<{ pageNumber: number; width: number; height: number }> = []
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: CSS_UNITS })
      pageCache.set(pageNumber, page)
      nextPages.push({ pageNumber, width: viewport.width, height: viewport.height })
    }

    pages.value = nextPages
    loading.value = false
    await nextTick()
    await Promise.all(nextPages.map((item) => renderPage(item.pageNumber, seq)))
    await centerHorizontal()
  } catch (err: any) {
    if (seq === loadSeq) error.value = err?.message || "PDF 预览生成失败"
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

watch(
  () => props.pdfBlob,
  (blob) => {
    void loadPdf(blob)
  },
  { immediate: true },
)

watch(
  () => props.scale,
  () => {
    void centerHorizontal()
  },
)

onMounted(() => {
  scrollerResizeObserver = new ResizeObserver(() => {
    const width = scroller.value?.clientWidth || 0
    if (width > 0 && width !== lastScrollerWidth) {
      lastScrollerWidth = width
      void centerHorizontal()
    }
  })
  if (scroller.value) scrollerResizeObserver.observe(scroller.value)
})

onBeforeUnmount(() => {
  loadSeq += 1
  scrollerResizeObserver?.disconnect()
  void destroyCurrentPdf()
})
</script>

<template>
  <div
    ref="scroller"
    class="h-full overflow-auto bg-[#eef0f4] p-8 thin-scrollbar select-none"
    :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="stopDrag"
    @pointercancel="stopDrag"
    @pointerleave="stopDrag"
  >
    <div v-if="loading && !pages.length" class="flex h-full min-h-[360px] items-center justify-center">
      <div class="rounded-2xl border border-blue-100 bg-white px-6 py-5 text-center shadow-sm">
        <div class="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600"></div>
        <p class="text-sm font-medium text-zinc-700">正在生成预览</p>
      </div>
    </div>
    <div v-else-if="error" class="flex h-full min-h-[360px] items-center justify-center">
      <div class="rounded-2xl border border-red-100 bg-white px-6 py-5 text-center text-sm text-red-600 shadow-sm">
        {{ error }}
      </div>
    </div>
    <div v-else-if="!pages.length" class="flex h-full min-h-[360px] items-center justify-center text-sm text-zinc-400">
      暂无预览
    </div>
    <div v-else class="pdf-page-rail">
      <div
        v-for="page in pages"
        :key="page.pageNumber"
        class="overflow-hidden bg-white shadow-xl"
        :style="{ width: `${page.width * scale}px`, height: `${page.height * scale}px` }"
      >
        <canvas
          :ref="(el) => setCanvasRef(el as Element | null, page.pageNumber)"
          class="block origin-top-left"
          :style="{ width: `${page.width * scale}px`, height: `${page.height * scale}px` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-page-rail {
  display: flex;
  width: calc(100% + 360px);
  min-width: max-content;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

@supports (width: max(1px, 2px)) {
  .pdf-page-rail {
    width: max(calc(100% + 360px), max-content);
  }
}
</style>
