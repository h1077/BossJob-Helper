<script setup lang="ts">
import { onMounted, ref } from "vue"
import { ChevronRight, Megaphone, RefreshCw, X } from "lucide-vue-next"
import AppLayout from "@/components/layout/AppLayout.vue"
import Button from "@/components/ui/button/Button.vue"
import {
  getAnnouncementDetailApi, getAnnouncementHistoryApi,
  type AnnouncementHistoryItem, type AnnouncementHistoryPage, type AnnouncementItem,
} from "@/api/announcement"

const data = ref<AnnouncementHistoryPage>({ items: [], total: 0, page: 1, page_size: 10 })
const loading = ref(false)
const detailLoading = ref(false)
const error = ref("")
const detail = ref<AnnouncementItem | null>(null)

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value)) : ""
}

async function load(page = 1) {
  loading.value = true
  error.value = ""
  try {
    data.value = await getAnnouncementHistoryApi(page, data.value.page_size)
  } catch (err: any) {
    error.value = err.message || "公告加载失败"
  } finally {
    loading.value = false
  }
}

async function openDetail(item: AnnouncementHistoryItem) {
  detailLoading.value = true
  error.value = ""
  try {
    detail.value = await getAnnouncementDetailApi(item.id)
  } catch (err: any) {
    error.value = err.message || "公告详情加载失败"
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <AppLayout>
    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 md:py-14">
      <header class="mb-8 flex items-end justify-between gap-4">
        <div><p class="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-zinc-400">Announcements</p><h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">历史公告</h1><p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-zinc-500">查看 VitaFlow 的更新与重要通知</p></div>
        <Button variant="outline" size="sm" :disabled="loading" @click="load(data.page)"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />刷新</Button>
      </header>

      <div v-if="error" class="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
      <section class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div v-if="loading" class="flex h-72 items-center justify-center text-sm text-zinc-400"><RefreshCw class="mr-2 h-4 w-4 animate-spin" />正在加载公告</div>
        <div v-else-if="!data.items.length" class="flex h-72 flex-col items-center justify-center text-zinc-400"><span class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100"><Megaphone class="h-5 w-5" /></span><p class="text-sm">暂无历史公告</p></div>
        <div v-else class="divide-y divide-zinc-100">
          <button v-for="item in data.items" :key="item.id" class="group flex w-full items-center gap-4 px-5 py-5 text-left transition hover:bg-zinc-50 sm:px-6" :disabled="detailLoading" @click="openDetail(item)">
            <span class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 sm:flex"><Megaphone class="h-4 w-4" /></span>
            <span class="min-w-0 flex-1"><span class="flex items-center justify-between gap-4"><strong class="truncate text-sm font-semibold text-zinc-900 sm:text-base">{{ item.title }}</strong><time class="shrink-0 text-xs text-zinc-400">{{ formatDate(item.published_at) }}</time></span><span class="mt-1.5 line-clamp-2 block text-sm leading-6 text-zinc-500">{{ item.summary || '点击查看公告详情' }}</span></span>
            <ChevronRight class="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-600" />
          </button>
        </div>
        <footer v-if="data.total > data.page_size" class="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-sm text-zinc-500"><span>共 {{ data.total }} 条 · 第 {{ data.page }} 页</span><div class="flex gap-2"><Button variant="outline" size="sm" :disabled="data.page <= 1" @click="load(data.page - 1)">上一页</Button><Button variant="outline" size="sm" :disabled="data.page * data.page_size >= data.total" @click="load(data.page + 1)">下一页</Button></div></footer>
      </section>
    </main>

    <Transition name="fade">
      <div v-if="detail" class="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm" @click.self="detail = null">
        <section role="dialog" aria-modal="true" class="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="flex items-start justify-between border-b border-zinc-100 px-6 py-5"><div><h2 class="text-xl font-semibold tracking-tight text-zinc-900">{{ detail.title }}</h2><p class="mt-1.5 text-xs text-zinc-400">发布于 {{ formatDate(detail.published_at) }}</p></div><button class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="关闭" @click="detail = null"><X class="h-5 w-5" /></button></header>
          <div class="history-announcement-content min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm leading-7 text-zinc-700 break-words whitespace-pre-wrap" v-html="detail.content"></div>
          <footer class="flex justify-end border-t border-zinc-100 bg-zinc-50 px-6 py-4"><Button @click="detail = null">关闭</Button></footer>
        </section>
      </div>
    </Transition>
  </AppLayout>
</template>

<style scoped>
.history-announcement-content :deep(h1), .history-announcement-content :deep(h2), .history-announcement-content :deep(h3), .history-announcement-content :deep(h4) { margin: 1em 0 .45em; color: #18181b; font-weight: 700; line-height: 1.35; }
.history-announcement-content :deep(h1) { font-size: 1.5rem; }
.history-announcement-content :deep(h2) { font-size: 1.25rem; }
.history-announcement-content :deep(h3) { font-size: 1.1rem; }
.history-announcement-content :deep(p) { margin: .55em 0; }
.history-announcement-content :deep(ul), .history-announcement-content :deep(ol) { margin: .6em 0; padding-left: 1.5rem; }
.history-announcement-content :deep(ul) { list-style: disc; }
.history-announcement-content :deep(ol) { list-style: decimal; }
.history-announcement-content :deep(blockquote) { margin: .8em 0; border-left: 3px solid #d4d4d8; background: #fafafa; padding: .6rem .9rem; color: #52525b; }
.history-announcement-content :deep(s), .history-announcement-content :deep(strike), .history-announcement-content :deep(del), .history-announcement-content :deep(span[style*="line-through"]) { text-decoration: line-through !important; text-decoration-line: line-through !important; }
.history-announcement-content :deep(u) { text-decoration: underline; }
.history-announcement-content :deep(b), .history-announcement-content :deep(strong) { font-weight: bold; }
.history-announcement-content :deep(i), .history-announcement-content :deep(em) { font-style: italic; }
.history-announcement-content :deep(a) { color: #2563eb; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(37, 99, 235, 0.3); text-decoration-thickness: 1.5px; transition: all 0.2s ease; }
.history-announcement-content :deep(a:hover) { color: #1d4ed8; text-decoration-color: #2563eb; }
.history-announcement-content :deep(img) { display: inline-block; max-width: 100%; height: auto; margin: 1rem 0; border-radius: .75rem; }
.history-announcement-content :deep(img[data-size="25"]) { width: 25%; }
.history-announcement-content :deep(img[data-size="50"]) { width: 50%; }
.history-announcement-content :deep(img[data-size="75"]) { width: 75%; }
.history-announcement-content :deep(img[data-size="100"]) { width: 100%; }
</style>
