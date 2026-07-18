<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute } from "vue-router"
import { AlertCircle, Clock3 } from "lucide-vue-next"
import BrandLogo from "@/components/common/BrandLogo.vue"
import { getPublicSharedResumeApi, type PublicSharedResume } from "@/api/resume"

const route = useRoute()
const loading = ref(true)
const error = ref("")
const sharedResume = ref<PublicSharedResume | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)
const shellWidth = ref(794)
const shellHeight = ref(1123)
const frameHeight = ref(1123)
const frameScale = ref(1)
let frameResizeObserver: ResizeObserver | null = null

const patchedHtml = computed(() => {
  const html = sharedResume.value?.html || ""
  if (!html) return ""
  const style = `
    <style>
      @media screen {
        html, body {
          width: 210mm !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
          background: transparent !important;
        }
        .resume-page {
          width: 210mm !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          margin: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }
      }
    </style>
  `
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "")
  return withoutScripts.includes("</head>")
    ? withoutScripts.replace("</head>", `${style}</head>`)
    : `${style}${withoutScripts}`
})

const expireLabel = computed(() => {
  if (!sharedResume.value?.expire_time) return "分享长期有效"
  return `有效至 ${new Date(sharedResume.value.expire_time).toLocaleString("zh-CN", { hour12: false })}`
})

function updateFrameSize() {
  const iframe = frame.value
  const doc = iframe?.contentDocument
  if (!iframe || !doc) return
  const naturalWidth = 794
  const availableWidth = Math.max(280, Math.min(920, window.innerWidth - (window.innerWidth < 640 ? 24 : 64)))
  const scale = Math.min(1, availableWidth / naturalWidth)
  const height = Math.max(
    doc.documentElement.scrollHeight,
    doc.body?.scrollHeight || 0,
    doc.querySelector<HTMLElement>(".resume-page")?.scrollHeight || 0,
  )
  frameScale.value = scale
  frameHeight.value = height
  shellWidth.value = naturalWidth * scale
  shellHeight.value = height * scale
}

function handleFrameLoad() {
  frameResizeObserver?.disconnect()
  const doc = frame.value?.contentDocument
  if (!doc) return
  updateFrameSize()
  frameResizeObserver = new ResizeObserver(updateFrameSize)
  frameResizeObserver.observe(doc.documentElement)
  if (doc.body) frameResizeObserver.observe(doc.body)
  doc.fonts?.ready.then(updateFrameSize).catch(() => undefined)
  doc.querySelectorAll("img").forEach((image) => image.addEventListener("load", updateFrameSize, { once: true }))
  window.setTimeout(updateFrameSize, 250)
}

onMounted(async () => {
  window.addEventListener("resize", updateFrameSize)
  try {
    sharedResume.value = await getPublicSharedResumeApi(String(route.params.token || ""))
    await nextTick()
  } catch (reason: any) {
    error.value = reason?.message || "分享不存在或已失效"
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateFrameSize)
  frameResizeObserver?.disconnect()
})
</script>

<template>
  <div class="relative min-h-screen bg-[#fafafa] text-zinc-950 flex flex-col selection:bg-blue-100 selection:text-blue-900">
    <!-- Sticky Minimalist Header -->
    <header class="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md transition-all">
      <div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div class="flex items-center gap-3">
          <a href="/" title="访问官网" class="flex items-center transition-opacity hover:opacity-85 active:scale-95">
            <BrandLogo />
          </a>
          <span class="text-zinc-200 hidden sm:inline">|</span>
          <span class="hidden sm:inline text-xs font-medium text-zinc-500 tracking-wide">简历公开分享</span>
        </div>
        <div v-if="sharedResume" class="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <Clock3 class="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span class="truncate">{{ expireLabel }}</span>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="relative flex-1 mx-auto w-full max-w-5xl px-3 pt-6 pb-6 sm:px-6 sm:pt-8 sm:pb-8">
      <div v-if="loading" class="flex min-h-[60vh] flex-col items-center justify-center">
        <span class="h-9 w-9 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900"></span>
        <p class="mt-4 text-sm font-medium text-zinc-500 tracking-wide">正在加载分享简历...</p>
      </div>

      <section v-else-if="error" class="mx-auto mt-16 max-w-md rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><AlertCircle class="h-6 w-6" /></span>
        <h1 class="mt-5 text-lg font-semibold text-zinc-900">无法查看这份简历</h1>
        <p class="mt-2 text-sm leading-relaxed text-zinc-500">{{ error }}</p>
      </section>

      <template v-else-if="sharedResume">
        <div class="flex justify-center overflow-hidden">
          <div
            class="relative overflow-hidden bg-white border border-zinc-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:rounded-lg transition-all duration-300"
            :style="{ width: `${shellWidth}px`, height: `${shellHeight}px` }"
          >
            <iframe
              ref="frame"
              title="分享简历预览"
              class="absolute left-0 top-0 block origin-top-left border-0 bg-white"
              :srcdoc="patchedHtml"
              :style="{ width: '794px', height: `${frameHeight}px`, transform: `scale(${frameScale})` }"
              sandbox="allow-same-origin"
              scrolling="no"
              @load="handleFrameLoad"
            ></iframe>
          </div>
        </div>
      </template>
    </main>

    <!-- Professional Enterprise SaaS Footer -->
    <footer v-if="sharedResume && !loading && !error" class="border-t border-zinc-200/80 bg-white py-6 sm:py-8">
      <div class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div class="flex flex-col items-center sm:items-start text-center sm:text-left">
          <span class="text-sm font-bold tracking-tight text-zinc-900">VitaFlow 简历流</span>
          <p class="mt-1 text-xs text-zinc-500">还在为找工作发愁？使用 VitaFlow 轻松提炼出彩简历。</p>
        </div>
        <a href="/" target="_blank" class="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-5 text-xs font-medium !text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-95">
          免费制作同款简历 &rarr;
        </a>
      </div>
    </footer>
  </div>
</template>
