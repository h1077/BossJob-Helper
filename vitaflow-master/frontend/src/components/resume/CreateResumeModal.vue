<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
import { AlertCircle, ArrowRight, Briefcase, ChevronLeft, ChevronRight, FileUp, LayoutTemplate, Sparkles, X } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import TemplatePreview from "@/components/templates/TemplatePreview.vue"
import type { TemplateItem } from "@/api/template"
import type { ResumeStarterIndustry, ResumeStarterLevel, ResumeStarterRole } from "@/api/resumeStarter"

type TemplateSelectMode = "create" | "import" | "blank"
type CreateMode = "entry" | "starter"

const props = defineProps<{
  open: boolean
  templateSelectMode: TemplateSelectMode
  createMode: CreateMode
  templates: TemplateItem[]
  pagedTemplates: TemplateItem[]
  modalPage: number
  starterIndustries: ResumeStarterIndustry[]
  starterLevels: ResumeStarterLevel[]
  starterLoading: boolean
  starterRolesLoading: boolean
  starterError: string
  starterRolesError: string
  selectedStarterIndustry?: ResumeStarterIndustry
  selectedStarterRole?: ResumeStarterRole
  selectedStarterLevel?: ResumeStarterLevel
  selectedStarterIndustryId: string
  selectedStarterRoleId: string
  selectedStarterLevelId: string
  starterResumeTitle: string
  selectedStarterModules: Array<{ key: string; title: string }>
  starterCreating: boolean
  isImportRendering: boolean
}>()

const emit = defineEmits<{
  close: []
  back: []
  openStarter: []
  openBlank: []
  openImport: []
  loadStarterCatalog: []
  loadStarterRoles: [industryId: string]
  selectStarterIndustry: [industryId: string]
  "update:selectedStarterRoleId": [value: string]
  "update:selectedStarterLevelId": [value: string]
  "update:modalPage": [value: number]
  openStarterAiGenerate: []
  createStarterResume: []
  selectTemplate: [templateId: string]
}>()

const modalBody = ref<HTMLElement | null>(null)

const titleMap = {
  import: "选择导入模板",
  blank: "选择空白简历版式",
}

function resetScroll() {
  nextTick(() => {
    if (modalBody.value) modalBody.value.scrollTop = 0
  })
}

function modalTitle() {
  if (props.templateSelectMode === "import" || props.templateSelectMode === "blank") return titleMap[props.templateSelectMode]
  return props.createMode === "starter" ? "按岗位起稿" : "创建简历"
}

function modalDescription() {
  if (props.templateSelectMode === "import") return "选择导入后使用的简历版式"
  if (props.templateSelectMode === "blank") return "选择一款作为空白简历基础的版式"
  return props.createMode === "starter" ? "选择行业、岗位方向和经验阶段" : "选择一种更适合当前情况的开始方式"
}

watch(
  () => [props.open, props.templateSelectMode, props.createMode],
  ([open]) => {
    if (open) resetScroll()
  },
)
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/40 p-4 backdrop-blur-sm" @click="emit('close')">
      <section
        class="my-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-xl transform"
        :class="templateSelectMode === 'create' && createMode === 'entry' ? 'max-w-3xl' : 'max-w-5xl'"
        @click.stop
      >
        <div class="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 bg-white px-5 py-4 sm:px-7 sm:py-5">
          <div class="flex min-w-0 items-start gap-2.5">
            <button
              v-if="['import', 'blank'].includes(templateSelectMode) || createMode === 'starter'"
              class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
              @click="emit('back')"
            >
              <ChevronLeft class="h-5 w-5" />
            </button>
            <div class="min-w-0">
              <h2 class="text-xl font-bold tracking-tight text-zinc-950">{{ modalTitle() }}</h2>
              <p class="mt-1 truncate text-xs leading-5 text-zinc-500">{{ modalDescription() }}</p>
            </div>
          </div>
          <button class="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" @click="emit('close')">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div ref="modalBody" class="min-h-0 flex-1 overflow-y-auto bg-zinc-50/50 p-3 thin-scrollbar sm:p-5">
          <div v-if="templateSelectMode === 'create' && createMode === 'entry'" class="mx-auto max-w-3xl">
            <div class="grid gap-3 sm:grid-cols-3">
              <button class="group flex min-h-40 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md active:scale-[0.99]" @click="emit('openStarter')">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <Briefcase class="h-4 w-4" />
                </span>
                <span>
                  <span class="block text-base font-semibold tracking-tight text-zinc-950">按岗位起稿</span>
                  <span class="mt-2 block text-sm leading-6 text-zinc-500">基于行业和岗位生成一份可继续编辑的内容初稿。</span>
                </span>
              </button>
              <button class="group flex min-h-40 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md active:scale-[0.99]" @click="emit('openBlank')">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <LayoutTemplate class="h-4 w-4" />
                </span>
                <span>
                  <span class="block text-base font-semibold tracking-tight text-zinc-950">空白简历</span>
                  <span class="mt-2 block text-sm leading-6 text-zinc-500">保留默认版式和空白内容，适合完全自己填写。</span>
                </span>
              </button>
              <button class="group flex min-h-40 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md active:scale-[0.99]" @click="emit('openImport')">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <FileUp class="h-4 w-4" />
                </span>
                <span>
                  <span class="block text-base font-semibold tracking-tight text-zinc-950">导入简历</span>
                  <span class="mt-2 block text-sm leading-6 text-zinc-500">上传已有文件，解析后套用你选择的简历版式。</span>
                </span>
              </button>
            </div>
          </div>

          <div v-if="templateSelectMode === 'create' && createMode === 'starter'" class="w-full">
            <div v-if="starterLoading" class="flex min-h-[360px] items-center justify-center text-sm text-zinc-500">正在加载岗位内容...</div>
            <div v-else-if="starterError" class="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <AlertCircle class="h-8 w-8 text-zinc-300" />
              <p class="mt-3 text-sm font-medium text-zinc-900">{{ starterError }}</p>
              <Button variant="outline" class="mt-4 h-9 rounded-full border-zinc-200 bg-white px-4 text-xs text-zinc-700" @click="emit('loadStarterCatalog')">重新加载</Button>
            </div>
            <div v-else-if="selectedStarterIndustry && selectedStarterLevel" class="space-y-4">
              <section>
                <div class="mb-2.5 flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold text-zinc-950">行业</h3>
                </div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  <button
                    v-for="industry in starterIndustries"
                    :key="industry.id"
                    class="h-8 truncate rounded-full border px-2 text-[13px] font-medium transition active:scale-[0.98]"
                    :class="selectedStarterIndustryId === industry.id ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950'"
                    @click="emit('selectStarterIndustry', industry.id)"
                  >
                    {{ industry.name }}
                  </button>
                </div>
              </section>

              <section>
                <div class="mb-2.5 flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold text-zinc-950">岗位方向</h3>
                </div>
                <div v-if="starterRolesLoading" class="grid min-h-[118px] gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div v-for="index in 6" :key="index" class="h-14 rounded-lg border border-zinc-100 bg-white px-3 py-2">
                    <div class="h-3.5 w-24 rounded-full bg-zinc-100"></div>
                    <div class="mt-2 h-3 w-32 rounded-full bg-zinc-100/80"></div>
                  </div>
                </div>
                <div v-else-if="starterRolesError" class="flex min-h-[118px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center">
                  <p class="text-sm text-zinc-500">{{ starterRolesError }}</p>
                  <Button variant="outline" class="mt-3 h-8 rounded-full border-zinc-200 bg-white px-4 text-xs text-zinc-700" @click="emit('loadStarterRoles', selectedStarterIndustryId)">重试</Button>
                </div>
                <div v-else-if="selectedStarterIndustry.roles.length" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    v-for="role in selectedStarterIndustry.roles"
                    :key="role.starter_id"
                    class="group relative flex h-14 flex-col justify-center rounded-lg border px-3 py-2 text-left transition active:scale-[0.99]"
                    :class="selectedStarterRoleId === role.starter_id ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'"
                    @click="emit('update:selectedStarterRoleId', role.starter_id)"
                  >
                    <span class="block truncate text-[13.5px] font-semibold leading-5" :class="selectedStarterRoleId === role.starter_id ? 'text-blue-900' : 'text-zinc-900'">{{ role.title }}</span>
                    <span class="mt-0.5 block truncate text-[11.5px] leading-4" :class="selectedStarterRoleId === role.starter_id ? 'text-blue-700/80' : 'text-zinc-500'">{{ role.subtitle }}</span>
                  </button>
                </div>
                <div v-else class="flex min-h-[118px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                  该行业暂无可用岗位预设
                </div>
              </section>

              <section>
                <h3 class="mb-2.5 text-sm font-semibold text-zinc-950">经验阶段</h3>
                <div class="inline-flex w-full flex-wrap rounded-xl bg-zinc-100/80 p-1 sm:w-auto">
                  <button
                    v-for="level in starterLevels"
                    :key="level.id"
                    class="flex-1 rounded-lg px-4 py-1.5 text-[13px] font-medium transition sm:flex-none"
                    :class="selectedStarterLevelId === level.id ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900'"
                    @click="emit('update:selectedStarterLevelId', level.id)"
                  >
                    {{ level.short_label }}
                  </button>
                </div>
              </section>

              <div class="min-h-[74px] rounded-xl border border-zinc-100 bg-zinc-50 px-3.5 py-3">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm font-semibold text-zinc-950">{{ selectedStarterRole ? starterResumeTitle : "选择岗位后生成初稿" }}</p>
                    <div v-if="selectedStarterRole" class="mt-2 flex flex-wrap gap-1.5">
                      <span v-for="module in selectedStarterModules" :key="module.key" class="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-100">
                        {{ module.title }}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button variant="outline" class="h-9 rounded-full border-zinc-200 bg-white px-4 text-[13px] text-zinc-800 hover:bg-zinc-50 sm:w-36" :disabled="starterRolesLoading || !selectedStarterRole" @click="emit('openStarterAiGenerate')">
                      <Sparkles class="h-3.5 w-3.5 text-blue-500" />
                      AI 智能生成
                    </Button>
                    <Button class="h-9 rounded-full bg-zinc-900 px-5 text-[13px] text-white hover:bg-zinc-800 sm:w-36" :disabled="starterCreating || starterRolesLoading || !selectedStarterRole" @click="emit('createStarterResume')">
                      {{ starterCreating ? "正在创建..." : "创建初稿" }}
                      <ArrowRight v-if="!starterCreating" class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="templateSelectMode === 'import'" class="mb-6 flex items-start gap-2 rounded-lg border border-zinc-200/60 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-600 sm:items-center">
            <AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 sm:mt-0" />
            <span class="leading-normal sm:truncate">
              <strong class="font-medium text-zinc-900">支持智能解析的文件格式：</strong>单文件支持 PDF、Word、TXT、Markdown；多图支持 JPG/PNG 合并图文识别。
            </span>
          </div>

          <div v-if="['import', 'blank'].includes(templateSelectMode)">
            <div class="mb-4 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-2">
                <button class="inline-flex h-8 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950" @click="emit('back')">
                  返回
                </button>
                <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {{ templateSelectMode === 'import' ? '选择导入版式' : '选择空白版式' }}
                </h3>
              </div>
              <span class="text-[11px] font-medium text-zinc-500">点击卡片即可直接应用</span>
            </div>

            <div v-if="isImportRendering" class="flex min-h-[300px] items-center justify-center text-sm text-zinc-500">
              <div class="flex items-center gap-2">
                <svg class="h-4 w-4 animate-spin text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                正在准备模板...
              </div>
            </div>
            <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              <article
                v-for="item in pagedTemplates"
                :key="item.template_id"
                class="group relative flex cursor-pointer flex-col rounded-[1.5rem] bg-white p-2 shadow-sm ring-1 ring-zinc-100 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-zinc-200/50 hover:ring-zinc-200 sm:rounded-[2rem] sm:p-2.5"
                @click="emit('selectTemplate', item.template_id)"
              >
                <div class="pointer-events-none relative aspect-[1/1.1] w-full overflow-hidden rounded-[1.25rem] border border-zinc-100/80 bg-zinc-50 sm:rounded-[1.5rem]">
                  <div class="absolute inset-x-0 top-0 w-full transform transition-transform duration-700 ease-out group-hover:scale-[1.05]">
                    <TemplatePreview :html="item.preview_html" />
                  </div>
                  <div class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-50 via-zinc-50/80 to-transparent"></div>
                </div>

                <div class="mb-1 mt-3 flex min-h-[24px] items-center justify-between gap-2 px-2 sm:px-3">
                  <h2 class="flex-1 truncate text-xs font-medium tracking-tight text-zinc-900 transition-colors group-hover:text-zinc-950 sm:text-sm">{{ item.name }}</h2>
                  <div class="relative flex shrink-0 items-center">
                    <span class="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600 transition-all duration-200 group-hover:scale-95 group-hover:opacity-0 group-hover:pointer-events-none sm:px-2.5 sm:py-1 sm:text-[10px]">
                      {{ item.category }}
                    </span>
                    <span class="absolute right-0 hidden translate-x-1 shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-blue-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 sm:flex">
                      {{ templateSelectMode === 'import' ? '应用导入' : '使用该版式' }}
                    </span>
                  </div>
                </div>
              </article>
            </div>

            <div v-if="!isImportRendering && templates.length > 8" class="mt-8 flex flex-col items-center justify-between gap-4 transition-all duration-300 sm:flex-row sm:rounded-[2rem] sm:bg-white sm:p-3 sm:pl-7 sm:pr-3 sm:shadow-sm sm:ring-1 sm:ring-zinc-100 sm:hover:shadow-md">
              <div class="hidden items-center gap-3 text-sm text-zinc-500 sm:flex">
                <span>共 <strong class="font-semibold text-zinc-900">{{ templates.length }}</strong> 款模板</span>
                <span class="text-zinc-200">|</span>
                <span>第 <strong class="font-semibold text-zinc-900">{{ modalPage }}</strong> / {{ Math.ceil(templates.length / 8) }} 页</span>
              </div>
              <div class="flex w-full items-center justify-between gap-1 rounded-[1.5rem] bg-zinc-50 p-1.5 ring-1 ring-zinc-100/80 sm:w-auto sm:justify-start">
                <button class="inline-flex h-10 items-center justify-center gap-1.5 rounded-[1.25rem] bg-white px-4.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white active:scale-[0.98]" :disabled="modalPage <= 1" @click="emit('update:modalPage', modalPage - 1)">
                  <ChevronLeft class="h-4 w-4 text-zinc-400" />
                  <span class="text-xs font-semibold tracking-wide">上一页</span>
                </button>
                <span class="px-4 font-mono text-xs font-semibold tracking-wider text-zinc-600">
                  {{ modalPage }} / {{ Math.ceil(templates.length / 8) }}
                </span>
                <button class="inline-flex h-10 items-center justify-center gap-1.5 rounded-[1.25rem] bg-white px-4.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white active:scale-[0.98]" :disabled="modalPage >= Math.ceil(templates.length / 8)" @click="emit('update:modalPage', modalPage + 1)">
                  <span class="text-xs font-semibold tracking-wide">下一页</span>
                  <ChevronRight class="h-4 w-4 text-zinc-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active > div,
.modal-fade-leave-active > div,
.modal-fade-enter-active section,
.modal-fade-leave-active section {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-fade-enter-from > div,
.modal-fade-enter-from section {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
}
.modal-fade-leave-to > div,
.modal-fade-leave-to section {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
}
</style>
