<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { Megaphone, X, History, Check } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import { dismissAnnouncementApi, type AnnouncementItem } from "@/api/announcement"

const props = defineProps<{ announcement: AnnouncementItem }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const neverShowAgain = ref(false)
const closing = ref(false)

async function close() {
  if (closing.value) return
  closing.value = true
  try {
    if (neverShowAgain.value) await dismissAnnouncementApi(props.announcement.id)
  } catch {
    // Closing should not trap the user if the preference request fails. In that
    // case the announcement will simply be shown again on the next visit.
  } finally {
    emit("close")
    closing.value = false
  }
}

async function goToAllAnnouncements() {
  await close()
  router.push("/announcements")
}

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(new Date(value)) : ""
}
</script>

<template>
  <div class="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm" @click.self="close">
    <section role="dialog" aria-modal="true" aria-labelledby="announcement-title" class="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header class="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
        <div class="flex min-w-0 gap-3"><span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white"><Megaphone class="h-4 w-4" /></span><div class="min-w-0"><h2 id="announcement-title" class="text-lg font-semibold tracking-tight text-zinc-900">{{ announcement.title }}</h2><p class="mt-1 text-xs text-zinc-400">{{ formatDate(announcement.published_at) }}</p></div></div>
        <button class="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" aria-label="关闭公告" @click="close"><X class="h-5 w-5" /></button>
      </header>
      <div class="announcement-content min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm leading-7 text-zinc-700 break-words whitespace-pre-wrap" v-html="announcement.content"></div>
      <footer class="flex flex-col gap-4 border-t border-zinc-100 bg-zinc-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <label class="group flex cursor-pointer select-none items-center gap-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900">
          <div class="relative flex h-5 w-5 items-center justify-center rounded-md border border-zinc-300 bg-white transition-all duration-200 group-hover:border-zinc-400" :class="{ '!border-zinc-900 !bg-zinc-900 shadow-sm': neverShowAgain }">
            <Check v-if="neverShowAgain" class="h-3.5 w-3.5 text-white stroke-[3]" />
          </div>
          <input v-model="neverShowAgain" type="checkbox" class="sr-only" />
          <span>下次不再提示</span>
        </label>
        <div class="flex items-center gap-3">
          <Button variant="outline" :disabled="closing" @click="goToAllAnnouncements"><History class="h-4 w-4" />全部公告</Button>
          <Button :disabled="closing" @click="close"><Check class="h-4 w-4" />{{ closing ? '处理中…' : '我知道了' }}</Button>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.announcement-content :deep(h1), .announcement-content :deep(h2), .announcement-content :deep(h3), .announcement-content :deep(h4) { margin: 1em 0 .45em; color: #18181b; font-weight: 700; line-height: 1.35; }
.announcement-content :deep(h1) { font-size: 1.5rem; }
.announcement-content :deep(h2) { font-size: 1.25rem; }
.announcement-content :deep(h3) { font-size: 1.1rem; }
.announcement-content :deep(p) { margin: .55em 0; }
.announcement-content :deep(ul), .announcement-content :deep(ol) { margin: .6em 0; padding-left: 1.5rem; }
.announcement-content :deep(ul) { list-style: disc; }
.announcement-content :deep(ol) { list-style: decimal; }
.announcement-content :deep(blockquote) { margin: .8em 0; border-left: 3px solid #d4d4d8; background: #fafafa; padding: .6rem .9rem; color: #52525b; }
.announcement-content :deep(s), .announcement-content :deep(strike), .announcement-content :deep(del), .announcement-content :deep(span[style*="line-through"]) { text-decoration: line-through !important; text-decoration-line: line-through !important; }
.announcement-content :deep(u) { text-decoration: underline; }
.announcement-content :deep(b), .announcement-content :deep(strong) { font-weight: bold; }
.announcement-content :deep(i), .announcement-content :deep(em) { font-style: italic; }
.announcement-content :deep(a) { color: #2563eb; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(37, 99, 235, 0.3); text-decoration-thickness: 1.5px; transition: all 0.2s ease; }
.announcement-content :deep(a:hover) { color: #1d4ed8; text-decoration-color: #2563eb; }
.announcement-content :deep(img) { display: inline-block; max-width: 100%; height: auto; margin: 1rem 0; border-radius: .75rem; }
.announcement-content :deep(img[data-size="25"]) { width: 25%; }
.announcement-content :deep(img[data-size="50"]) { width: 50%; }
.announcement-content :deep(img[data-size="75"]) { width: 75%; }
.announcement-content :deep(img[data-size="100"]) { width: 100%; }
</style>
