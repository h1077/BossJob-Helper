<script setup lang="ts">
import { computed } from "vue"
import { Copy, Trash2 } from "lucide-vue-next"
import TemplatePreview from "@/components/templates/TemplatePreview.vue"
import type { TemplateItem } from "@/api/template"
import type { ResumeItem } from "@/types/resume"

const props = defineProps<{
  item: ResumeItem
  templates: TemplateItem[]
  templateNames: Record<string, string>
  isTitleTruncated?: boolean
}>()

defineEmits<{
  edit: [id: number]
  duplicate: [id: number]
  delete: [id: number]
  checkTitle: [event: MouseEvent, id: number]
}>()

const template = computed(() => props.templates.find((item) => item.template_id === props.item.template_id))
const templateName = computed(() => props.templateNames[props.item.template_id] || template.value?.name || "自定义模板")

function formatUpdateTime(timeStr?: string) {
  if (!timeStr) return "最近"
  try {
    const date = new Date(timeStr)
    if (Number.isNaN(date.getTime())) return "最近"
    const now = new Date()
    const diff = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
    if (diff < 60) return "刚刚"
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}天前`
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  } catch {
    return "最近"
  }
}
</script>

<template>
  <div
    class="group relative flex flex-col rounded-[1.5rem] bg-white p-2 shadow-sm ring-1 ring-zinc-100 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-zinc-200/50 hover:ring-zinc-200 sm:rounded-[2rem] sm:p-2.5 cursor-pointer"
    @click="$emit('edit', item.id)"
  >
    <div class="absolute right-4 top-4 z-10 flex translate-y-0.5 items-center gap-1.5 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 sm:right-6 sm:top-6">
      <button class="rounded-lg border border-zinc-200/60 bg-white/90 p-1 text-zinc-500 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-zinc-900 active:scale-95 sm:p-1.5" title="复制" @click.stop="$emit('duplicate', item.id)">
        <Copy class="h-3.5 w-3.5" />
      </button>
      <button class="rounded-lg border border-zinc-200/60 bg-white/90 p-1 text-zinc-500 shadow-sm backdrop-blur-md transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600 active:scale-95 sm:p-1.5" title="删除" @click.stop="$emit('delete', item.id)">
        <Trash2 class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="pointer-events-none relative aspect-[1/1.1] w-full overflow-hidden rounded-[1.25rem] border border-zinc-100/80 bg-zinc-50 sm:rounded-[1.5rem]">
      <div class="absolute inset-x-0 top-0 w-full transform transition-transform duration-700 ease-out group-hover:scale-[1.05]">
        <TemplatePreview :html="template?.preview_html" />
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-50 via-zinc-50/80 to-transparent"></div>
    </div>

    <div class="mb-2 mt-3 flex flex-1 flex-col px-2 sm:mt-4 sm:px-3">
      <div class="group/title relative mb-1.5">
        <h2 class="truncate text-xs font-medium tracking-tight text-zinc-900 transition-colors group-hover/title:text-zinc-950 sm:text-sm" @mouseenter="$emit('checkTitle', $event, item.id)">{{ item.title }}</h2>
        <div v-if="isTitleTruncated" class="absolute bottom-full left-0 z-50 mb-1.5 hidden w-max max-w-xs animate-in rounded-xl border border-zinc-700/50 bg-zinc-900 p-2.5 text-xs leading-relaxed text-white shadow-2xl backdrop-blur-md fade-in zoom-in-95 group-hover/title:block pointer-events-none whitespace-normal break-words">
          {{ item.title }}
          <div class="absolute left-4 top-full -mt-1 h-2 w-2 rotate-45 border-b border-r border-zinc-700/50 bg-zinc-900 pointer-events-none"></div>
        </div>
      </div>
      <div class="mt-1.5 flex min-h-[24px] items-center justify-between text-[11px] tracking-wide text-zinc-400/90">
        <span class="truncate pr-1 sm:pr-2">{{ formatUpdateTime(item.update_time || item.create_time) }}<span class="hidden sm:inline"> · {{ item.language === "en" ? "English" : "简体中文" }}</span></span>
        <div class="relative flex shrink-0 items-center">
          <span class="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 transition-all duration-200 group-hover:scale-95 group-hover:opacity-0 group-hover:pointer-events-none sm:px-2.5 sm:py-1 sm:text-[10px]">
            {{ templateName }}
          </span>
          <span class="absolute right-0 hidden translate-x-1 shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-zinc-700 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-zinc-900 group-hover:opacity-100 sm:flex">
            点击编辑 &rarr;
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
