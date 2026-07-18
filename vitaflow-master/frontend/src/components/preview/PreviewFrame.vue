<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { createResumePaginationScript } from "@/utils/resumePagination"

const props = defineProps<{ html: string; scale: number }>()

interface PageSlice {
  index: number
  sourceTopMm: number
  viewportTopMm: number
  viewportHeightMm: number
}

interface PageMetrics {
  pageHeightPx: number
  mmPx: number
  firstBottomPx: number
  nextTopPx: number
  nextBottomPx: number
  firstContentEndPx: number
  nextContentHeightPx: number
}

const measureFrame = ref<HTMLIFrameElement | null>(null)
const scroller = ref<HTMLDivElement | null>(null)
const dragging = ref(false)
const pageSlices = ref<PageSlice[]>([{ index: 0, sourceTopMm: 0, viewportTopMm: 0, viewportHeightMm: 297 }])
const shellStyle = computed(() => ({
  width: `calc(210mm * ${props.scale})`,
  height: `calc(297mm * ${props.scale})`,
}))

let outerResizeObserver: ResizeObserver | null = null
let frameResizeObserver: ResizeObserver | null = null
let frameMutationObserver: MutationObserver | null = null
let scheduledUpdate = 0
const pendingTimers = new Set<number>()
let dragStartX = 0
let dragStartY = 0
let dragStartScrollLeft = 0
let dragStartScrollTop = 0
let lastScrollerWidth = 0

function handleViewportChange() {
  scheduleUpdatePageCount([0, 120, 360])
  void centerHorizontal()
}

function clearPendingTimers() {
  pendingTimers.forEach((timer) => window.clearTimeout(timer))
  pendingTimers.clear()
}

function patchHtml(page?: PageSlice) {
  const transform = page ? `transform: translateY(-${page.sourceTopMm}mm);` : ""
  const overflow = page ? "hidden" : "visible"
  const style = `
    <style>
      @media screen {
        html, body {
          width: 210mm !important;
          margin: 0 !important;
          overflow: ${overflow} !important;
          background: white !important;
        }
        .resume-page {
          width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          ${transform}
          transform-origin: top left;
        }
      }
    </style>
  `
  const script = createResumePaginationScript()
  const withStyle = props.html.includes("</head>") ? props.html.replace("</head>", `${style}</head>`) : `${style}${props.html}`
  return withStyle.includes("</body>") ? withStyle.replace("</body>", `${script}</body>`) : `${withStyle}${script}`
}

function pageViewportStyle(page: PageSlice) {
  return {
    top: `calc(${page.viewportTopMm}mm * ${props.scale})`,
    width: `calc(210mm * ${props.scale})`,
    height: `calc(${page.viewportHeightMm}mm * ${props.scale})`,
  }
}

function isScrollerVisible() {
  const el = scroller.value
  return Boolean(el && el.getClientRects().length && el.clientWidth > 0 && el.clientHeight > 0)
}

function pageHeightPx(doc: Document) {
  const marker = doc.createElement("div")
  marker.style.cssText = "position:absolute;left:-9999px;top:0;height:297mm;width:1px;pointer-events:none;"
  doc.body.appendChild(marker)
  const height = marker.getBoundingClientRect().height
  marker.remove()
  return height || 1123
}

function cssLengthToPx(value: string, mmPx: number, fallbackPx = 0) {
  const raw = String(value || "").trim()
  if (!raw) return fallbackPx
  const valueNumber = Number.parseFloat(raw)
  if (!Number.isFinite(valueNumber)) return fallbackPx
  if (raw.includes("px")) return valueNumber
  if (raw.includes("mm")) return valueNumber * mmPx
  return valueNumber * mmPx
}

function clampMargin(value: number, pageHeight: number) {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(value, pageHeight * 0.35)
}

function getPageMetrics(doc: Document, page: HTMLElement, pageHeight: number): PageMetrics {
  const view = doc.defaultView || window
  const style = view.getComputedStyle(page)
  const mmPx = pageHeight / 297
  const firstTopPx = clampMargin(
    cssLengthToPx(style.getPropertyValue("--page-margin-top"), mmPx, Number.parseFloat(style.paddingTop)),
    pageHeight,
  )
  const firstBottomPx = clampMargin(
    cssLengthToPx(style.getPropertyValue("--page-margin-bottom"), mmPx, Number.parseFloat(style.paddingBottom)),
    pageHeight,
  )
  const nextTopPx = clampMargin(cssLengthToPx(style.getPropertyValue("--page-margin-next-top"), mmPx, firstTopPx), pageHeight)
  const nextBottomPx = clampMargin(cssLengthToPx(style.getPropertyValue("--page-margin-next-bottom"), mmPx, firstBottomPx), pageHeight)
  const nextContentHeightPx = Math.max(pageHeight - nextTopPx - nextBottomPx, pageHeight * 0.35)
  return {
    pageHeightPx: pageHeight,
    mmPx,
    firstBottomPx,
    nextTopPx,
    nextBottomPx,
    firstContentEndPx: pageHeight - firstBottomPx,
    nextContentHeightPx,
  }
}

function getMeasuredContentHeight(doc: Document, page: HTMLElement, metrics: PageMetrics) {
  const pageRect = page.getBoundingClientRect()
  const view = doc.defaultView || window
  let contentBottom = 0

  page.querySelectorAll<HTMLElement>("*").forEach((element) => {
    // Layout wrappers often include the configured bottom padding. Measuring
    // them would count that margin twice, so use their visible leaf content.
    if (element.children.length > 0) return
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const style = view.getComputedStyle(element)
    if (style.display === "none" || style.visibility === "hidden") return
    contentBottom = Math.max(contentBottom, rect.bottom - pageRect.top)
  })

  // Some rich-text blocks contain direct text alongside child elements. Range
  // rectangles capture those text nodes without counting structural grid
  // borders or wrapper padding as printable content.
  const walker = doc.createTreeWalker(page, NodeFilter.SHOW_TEXT)
  let textNode = walker.nextNode()
  while (textNode) {
    if (textNode.textContent?.trim()) {
      const parent = textNode.parentElement
      const style = parent ? view.getComputedStyle(parent) : null
      if (!style || (style.display !== "none" && style.visibility !== "hidden")) {
        const range = doc.createRange()
        range.selectNodeContents(textNode)
        Array.from(range.getClientRects()).forEach((rect) => {
          if (rect.width > 0 && rect.height > 0) {
            contentBottom = Math.max(contentBottom, rect.bottom - pageRect.top)
          }
        })
        range.detach()
      }
    }
    textNode = walker.nextNode()
  }

  return Math.max(contentBottom, 0) + metrics.firstBottomPx
}

function buildPageSlices(contentHeight: number, metrics: PageMetrics): PageSlice[] {
  const effectiveHeight = Math.max(contentHeight - metrics.firstBottomPx, 0)
  // Browser millimetre conversion, font metrics and the page-break guards can
  // leave a tiny amount of synthetic overflow. Do not turn that rounding
  // residue into a completely blank trailing page.
  const overflowTolerancePx = metrics.mmPx * 2
  const toMm = (px: number) => px / metrics.mmPx
  const slices: PageSlice[] = [
    {
      index: 0,
      sourceTopMm: 0,
      viewportTopMm: 0,
      viewportHeightMm: toMm(metrics.firstContentEndPx),
    },
  ]
  if (effectiveHeight <= metrics.firstContentEndPx + overflowTolerancePx) return slices

  let sourceTop = metrics.firstContentEndPx
  let index = 1
  while (sourceTop < effectiveHeight - overflowTolerancePx && index < 80) {
    slices.push({
      index,
      sourceTopMm: toMm(sourceTop),
      viewportTopMm: toMm(metrics.nextTopPx),
      viewportHeightMm: toMm(metrics.nextContentHeightPx),
    })
    sourceTop += metrics.nextContentHeightPx
    index += 1
  }
  return slices
}

function updatePageCount() {
  const frame = measureFrame.value
  const doc = frame?.contentDocument
  if (!frame || !doc || !doc.body || !isScrollerVisible()) return
  const pageHeight = pageHeightPx(doc)
  const page = doc.querySelector(".resume-page") as HTMLElement | null
  if (!pageHeight || !page) return
  const metrics = getPageMetrics(doc, page, pageHeight)
  const contentHeight = getMeasuredContentHeight(doc, page, metrics)
  if (!contentHeight) return
  const slices = buildPageSlices(contentHeight, metrics)
  pageSlices.value = slices
}

function scheduleUpdatePageCount(delays = [0, 80, 180, 420, 900]) {
  window.cancelAnimationFrame(scheduledUpdate)
  clearPendingTimers()
  scheduledUpdate = window.requestAnimationFrame(updatePageCount)
  delays.forEach((delay) => {
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer)
      updatePageCount()
    }, delay)
    pendingTimers.add(timer)
  })
}

function cleanupFrameObservers() {
  frameResizeObserver?.disconnect()
  frameMutationObserver?.disconnect()
  frameResizeObserver = null
  frameMutationObserver = null
}

function onMeasureLoad() {
  cleanupFrameObservers()
  const doc = measureFrame.value?.contentDocument
  if (doc) {
    frameResizeObserver = new ResizeObserver(() => scheduleUpdatePageCount([60, 240]))
    frameMutationObserver = new MutationObserver(() => scheduleUpdatePageCount([60, 240]))
    frameResizeObserver.observe(doc.documentElement)
    if (doc.body) {
      frameResizeObserver.observe(doc.body)
      frameMutationObserver.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true })
      Array.from(doc.images || []).forEach((image) => {
        if (!image.complete) image.addEventListener("load", () => scheduleUpdatePageCount([0, 120, 360]), { once: true })
      })
    }
  }
  scheduleUpdatePageCount()
}

function handleWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) return
  const el = scroller.value
  if (!el || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
  const before = el.scrollTop
  el.scrollTop += event.deltaY
  if (el.scrollTop !== before) event.preventDefault()
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

watch(
  () => props.html,
  async () => {
    pageSlices.value = [{ index: 0, sourceTopMm: 0, viewportTopMm: 0, viewportHeightMm: 297 }]
    await nextTick()
    scheduleUpdatePageCount()
    await centerHorizontal()
  },
)

watch(
  () => props.scale,
  () => {
    void centerHorizontal()
  },
)

onMounted(() => {
  outerResizeObserver = new ResizeObserver(() => {
    scheduleUpdatePageCount([0, 120, 360])
    const width = scroller.value?.clientWidth || 0
    if (width > 0 && width !== lastScrollerWidth) {
      lastScrollerWidth = width
      void centerHorizontal()
    }
  })
  if (scroller.value) outerResizeObserver.observe(scroller.value)
  window.addEventListener("resize", handleViewportChange)
  window.addEventListener("orientationchange", handleViewportChange)
  document.addEventListener("visibilitychange", handleViewportChange)
  scheduleUpdatePageCount()
  void centerHorizontal()
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(scheduledUpdate)
  clearPendingTimers()
  outerResizeObserver?.disconnect()
  cleanupFrameObservers()
  window.removeEventListener("resize", handleViewportChange)
  window.removeEventListener("orientationchange", handleViewportChange)
  document.removeEventListener("visibilitychange", handleViewportChange)
})
</script>

<template>
  <div
    ref="scroller"
    class="h-full overflow-auto bg-[#eef0f4] p-8 pb-24 md:pb-8 thin-scrollbar select-none"
    :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
    @wheel.capture="handleWheel"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="stopDrag"
    @pointercancel="stopDrag"
    @pointerleave="stopDrag"
  >
    <iframe
      ref="measureFrame"
      class="pointer-events-none absolute h-[297mm] w-[210mm] opacity-0"
      scrolling="no"
      :srcdoc="patchHtml()"
      @load="onMeasureLoad"
    />
    <div class="preview-page-rail" :style="{ gap: `${12 * scale}px` }">
      <template v-for="(page, i) in pageSlices" :key="page.index">
        <div v-if="i > 0" class="pointer-events-none flex select-none items-center justify-center text-gray-400/50 tracking-wider" :style="{ fontSize: `${11 * scale}px` }">
          <svg class="mr-1" :style="{ width: `${14 * scale}px`, height: `${14 * scale}px` }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tips: 如果分页内容被截断，可在设置中调整「边距」或「行高」
        </div>
        <div class="relative overflow-hidden bg-white shadow-xl" :style="shellStyle">
          <div class="absolute left-0 overflow-hidden" :style="pageViewportStyle(page)">
            <iframe
              class="pointer-events-none origin-top-left border-0 bg-white"
              scrolling="no"
              :srcdoc="patchHtml(page)"
              :style="{ width: '210mm', height: '297mm', transform: `scale(${scale})` }"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.preview-page-rail {
  display: flex;
  width: calc(100% + 360px);
  min-width: max-content;
  flex-direction: column;
  align-items: center;
}

@supports (width: max(1px, 2px)) {
  .preview-page-rail {
    width: max(calc(100% + 360px), max-content);
  }
}
</style>
