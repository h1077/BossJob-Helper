<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { ArrowRight, Briefcase, ChevronLeft, ChevronRight, FileText, FileUp, X } from "lucide-vue-next"
import AppLayout from "@/components/layout/AppLayout.vue"
import Button from "@/components/ui/button/Button.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import ResumeImportProgress from "@/components/resume/ResumeImportProgress.vue"
import TemplatePreview from "@/components/templates/TemplatePreview.vue"
import { getFlowPointSummaryApi, type FlowPointSummary } from "@/api/ai"
import { importResumeFileApi } from "@/api/resume"
import { listResumeStartersApi, type ResumeStarterIndustry, type ResumeStarterLevel, type ResumeStarterRole } from "@/api/resumeStarter"
import { listTemplatesApi, type TemplateItem } from "@/api/template"
import { useResumeStore } from "@/stores/resume"
import { showGlobalToast } from "@/utils/toast"

const router = useRouter()
const store = useResumeStore()
const templates = ref<TemplateItem[]>([])
const page = ref(1)
const pageSize = 8
const selectedTemplate = ref<TemplateItem | null>(null)
const useTemplateMode = ref<"choice" | "starter">("choice")
const creatingResume = ref(false)
const starterCreating = ref(false)
const starterLoading = ref(false)
const starterRolesLoading = ref(false)
const starterError = ref("")
const starterRolesError = ref("")
const starterIndustries = ref<ResumeStarterIndustry[]>([])
const starterLevels = ref<ResumeStarterLevel[]>([])
const selectedStarterIndustryId = ref("")
const selectedStarterRoleId = ref("")
const selectedStarterLevelId = ref("junior")
const importFileInput = ref<HTMLInputElement | null>(null)
const importConfirmOpen = ref(false)
const importingResume = ref(false)
const importProgress = ref(0)
const importStageIndex = ref(0)
const flowPointSummary = ref<FlowPointSummary | null>(null)
let importProgressTimer: ReturnType<typeof window.setInterval> | null = null
const importStages = [
  "读取文件内容",
  "识别简历文本",
  "提取履历结构",
  "生成简历数据",
  "创建并准备跳转",
]

const totalPages = computed(() => Math.max(1, Math.ceil(templates.value.length / pageSize)))
const pagedTemplates = computed(() => {
  const start = (page.value - 1) * pageSize
  return templates.value.slice(start, start + pageSize)
})
const selectedStarterIndustry = computed(() => starterIndustries.value.find((item) => item.id === selectedStarterIndustryId.value) || starterIndustries.value[0])
const selectedStarterRole = computed<ResumeStarterRole | undefined>(() => selectedStarterIndustry.value?.roles.find((role) => role.starter_id === selectedStarterRoleId.value) || selectedStarterIndustry.value?.roles[0])
const selectedStarterLevel = computed(() => starterLevels.value.find((level) => level.id === selectedStarterLevelId.value) || starterLevels.value[1] || starterLevels.value[0])
const selectedStarterModules = computed(() => {
  const modules = selectedStarterRole.value?.content?.modules
  if (Array.isArray(modules) && modules.length) return modules
  return [
    { key: "summary", title: "个人简介" },
    { key: "skills", title: "专业技能" },
    { key: "work", title: selectedStarterLevel.value?.id === "fresh" ? "实习/实践经历" : "工作经历" },
    { key: "projects", title: "项目经历" },
  ]
})
const starterResumeTitle = computed(() => {
  if (!selectedStarterRole.value || !selectedStarterLevel.value) return "岗位起稿简历"
  return `${selectedStarterRole.value.title}简历 · ${selectedStarterLevel.value.short_label}`
})
const loadedStarterIndustryIds = new Set<string>()
let starterRoleRequestId = 0

onMounted(async () => {
  templates.value = await listTemplatesApi()
})

onBeforeUnmount(() => {
  if (importProgressTimer) window.clearInterval(importProgressTimer)
})

watch(totalPages, (value) => {
  if (page.value > value) page.value = value
})

function changePage(nextPage: number) {
  page.value = Math.min(totalPages.value, Math.max(1, nextPage))
}

function requireLogin() {
  const token = localStorage.getItem("vitaflow_token")
  if (!token) {
    router.push('/login')
    return false
  }
  return true
}

function openUseChoice(item: TemplateItem) {
  if (!requireLogin()) return
  selectedTemplate.value = item
  useTemplateMode.value = "choice"
}

function closeUseChoice() {
  selectedTemplate.value = null
  useTemplateMode.value = "choice"
}

async function createBlankResume() {
  if (!selectedTemplate.value || creatingResume.value) return
  creatingResume.value = true
  try {
    const item = await store.createResume(selectedTemplate.value.template_id)
    router.push(`/resumes/${item.id}/edit`)
  } finally {
    creatingResume.value = false
  }
}

async function loadStarterCatalog() {
  starterLoading.value = true
  starterError.value = ""
  starterRolesError.value = ""
  try {
    const catalog = await listResumeStartersApi()
    starterIndustries.value = catalog.industries || []
    starterLevels.value = catalog.levels || []
    if (!selectedStarterIndustryId.value && starterIndustries.value.length) {
      selectedStarterIndustryId.value = starterIndustries.value[0].id
    }
    if (!starterLevels.value.some((item) => item.id === selectedStarterLevelId.value)) {
      selectedStarterLevelId.value = starterLevels.value[0]?.id || "junior"
    }
    if (selectedStarterIndustryId.value) await loadStarterRoles(selectedStarterIndustryId.value)
  } catch (error: any) {
    starterError.value = error?.message || "岗位内容加载失败"
  } finally {
    starterLoading.value = false
  }
}

function mergeStarterIndustry(nextIndustry: ResumeStarterIndustry) {
  const index = starterIndustries.value.findIndex((item) => item.id === nextIndustry.id)
  if (index >= 0) {
    starterIndustries.value.splice(index, 1, {
      ...starterIndustries.value[index],
      ...nextIndustry,
      roles: nextIndustry.roles || [],
    })
  } else {
    starterIndustries.value.push({ ...nextIndustry, roles: nextIndustry.roles || [] })
  }
}

async function loadStarterRoles(industryId: string) {
  if (!industryId) {
    selectedStarterRoleId.value = ""
    return
  }
  const cachedIndustry = starterIndustries.value.find((item) => item.id === industryId)
  if (loadedStarterIndustryIds.has(industryId) && cachedIndustry?.roles?.length) {
    const hasSelectedRole = cachedIndustry.roles.some((role) => role.starter_id === selectedStarterRoleId.value)
    selectedStarterRoleId.value = hasSelectedRole ? selectedStarterRoleId.value : cachedIndustry.roles[0].starter_id
    return
  }

  const requestId = ++starterRoleRequestId
  starterRolesLoading.value = true
  starterRolesError.value = ""
  selectedStarterRoleId.value = ""
  try {
    const catalog = await listResumeStartersApi({ industry_id: industryId })
    if (requestId !== starterRoleRequestId) return
    const nextIndustry = catalog.industries.find((item) => item.id === industryId)
    if (!nextIndustry) {
      starterRolesError.value = "该行业岗位内容加载失败"
      return
    }
    mergeStarterIndustry(nextIndustry)
    loadedStarterIndustryIds.add(industryId)
    selectedStarterRoleId.value = nextIndustry.roles[0]?.starter_id || ""
  } catch (error: any) {
    if (requestId === starterRoleRequestId) {
      starterRolesError.value = error?.message || "岗位方向加载失败"
    }
  } finally {
    if (requestId === starterRoleRequestId) starterRolesLoading.value = false
  }
}

function selectStarterIndustry(industryId: string) {
  selectedStarterIndustryId.value = industryId
  void loadStarterRoles(industryId)
}

function openStarterFlow() {
  useTemplateMode.value = "starter"
  if (!starterIndustries.value.length && !starterLoading.value) void loadStarterCatalog()
}

async function createStarterResume() {
  if (!selectedTemplate.value || !selectedStarterRole.value || starterCreating.value) return
  starterCreating.value = true
  try {
    const item = await store.createResumeFromStarter(
      selectedStarterRole.value.starter_id,
      selectedStarterLevelId.value,
      selectedTemplate.value.template_id,
    )
    router.push(`/resumes/${item.id}/edit`)
  } finally {
    starterCreating.value = false
  }
}

function importExistingResume() {
  if (!selectedTemplate.value) return
  getFlowPointSummaryApi()
    .then((data) => {
      flowPointSummary.value = data
      importConfirmOpen.value = true
    })
    .catch(() => {
      flowPointSummary.value = null
      importConfirmOpen.value = true
    })
}

const importConfirmDescription = computed(() => {
  const rule = flowPointSummary.value?.rules.find((item) => item.feature_type === "import_resume")
  let cost = "按后台规则扣点"
  if (rule) {
    const inputRate = rule.points_per_million_input_tokens ?? rule.points_per_million_tokens ?? 0
    const outputRate = rule.points_per_million_output_tokens ?? rule.points_per_million_tokens ?? 0
    cost = `${rule.points_per_call} 点`
    if (inputRate > 0) cost += ` + 输入 ${inputRate} 点/百万 Tokens`
    if (outputRate > 0) cost += ` + 输出 ${outputRate} 点/百万 Tokens`
  }
  const balance = flowPointSummary.value ? `，当前余额 ${flowPointSummary.value.balance} 点` : ""
  return `将使用「${selectedTemplate.value?.name || "所选模板"}」导入，预计消耗 ${cost}${balance}。支持 PDF、Word、文本或多张图片。`
})

function chooseImportFile() {
  importConfirmOpen.value = false
  window.setTimeout(() => importFileInput.value?.click(), 60)
}

function startImportProgress() {
  if (importProgressTimer) window.clearInterval(importProgressTimer)
  importProgress.value = 8
  importStageIndex.value = 0
  importProgressTimer = window.setInterval(() => {
    if (importProgress.value >= 92) return
    importProgress.value = Math.min(92, importProgress.value + (importProgress.value < 45 ? 7 : 4))
    importStageIndex.value = Math.min(importStages.length - 1, Math.floor((importProgress.value / 100) * importStages.length))
  }, 850)
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ""
  if (!files.length || !selectedTemplate.value) return
  const imageFiles = files.filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name))
  if (files.length > 1 && imageFiles.length !== files.length) {
    showGlobalToast("多文件导入仅支持多张图片，PDF 或 Word 请单独上传", "error")
    return
  }

  importingResume.value = true
  startImportProgress()
  try {
    const item = await importResumeFileApi(
      files.length === 1 ? files[0] : files,
      selectedTemplate.value.template_id,
    )
    importProgress.value = 100
    importStageIndex.value = importStages.length - 1
    showGlobalToast("简历导入成功")
    router.push(`/resumes/${item.id}/edit`)
  } catch (error: any) {
    showGlobalToast(error?.message || "导入失败，未识别到有效简历内容", "error")
  } finally {
    if (importProgressTimer) window.clearInterval(importProgressTimer)
    importProgressTimer = null
    importingResume.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}
</script>

<template>
  <AppLayout>
    <input ref="importFileInput" type="file" class="hidden" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp" multiple @change="handleImportFile" />
    <main class="mx-auto max-w-7xl px-4 sm:px-6 py-8 md:py-16">
      <!-- Header Area -->
      <div class="max-w-2xl">
        <p class="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-zinc-400">Template Gallery</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-zinc-950 tracking-tight">模板中心</h1>
        <p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-zinc-500 leading-relaxed">
          挑选一个符合你行业风格的极简模板，开启专业简历之旅。<br />
          所有模板均经过专业优化，排版精良，开箱即用。
        </p>
      </div>
      
      <!-- Templates Grid -->
      <div class="mt-12 grid grid-cols-2 gap-3 sm:gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        <article v-for="item in pagedTemplates" :key="item.template_id" 
                 class="group relative flex flex-col rounded-[1.5rem] sm:rounded-[2rem] bg-white p-2 sm:p-2.5 shadow-sm ring-1 ring-zinc-100 transition-all duration-500 hover:shadow-2xl hover:shadow-zinc-200/50 hover:ring-zinc-200 hover:-translate-y-2">
          
          <!-- Preview Image Area -->
          <div class="relative w-full aspect-[1/1.1] overflow-hidden rounded-[1.25rem] sm:rounded-[1.5rem] bg-zinc-50 pointer-events-none border border-zinc-100/80">
            <div class="absolute inset-x-0 top-0 w-full transform transition-transform duration-700 ease-out group-hover:scale-[1.05]">
              <TemplatePreview :html="item.preview_html" />
            </div>
            <!-- Soft fade at bottom -->
            <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-50 via-zinc-50/80 to-transparent pointer-events-none"></div>
          </div>
          
          <!-- Content Info -->
          <div class="mt-3 sm:mt-5 mb-1 flex flex-col flex-1 px-1.5 sm:px-3">
            <div class="flex items-center justify-between mb-3 gap-1 sm:gap-2">
              <h2 class="text-xs sm:text-base font-medium tracking-tight text-zinc-900 truncate">{{ item.name }}</h2>
              <span class="shrink-0 inline-flex items-center rounded-full bg-zinc-100 px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold text-zinc-600 transition-colors uppercase tracking-wider">
                {{ item.category }}
              </span>
            </div>
            <div class="mt-auto">
              <Button class="w-full h-8 sm:h-10 text-xs sm:text-sm bg-zinc-900 text-white hover:bg-zinc-800 transition-all duration-300 shadow-md rounded-xl font-medium active:scale-[0.98] border-none" @click="openUseChoice(item)">
                开始使用
              </Button>
            </div>
          </div>
        </article>
      </div>

      <div v-if="templates.length > 0" class="mt-12 flex flex-col items-center justify-between gap-4 rounded-[2rem] bg-white p-3 sm:pl-7 sm:pr-3 shadow-sm ring-1 ring-zinc-100 sm:flex-row transition-all duration-300 hover:shadow-md">
        <div class="flex items-center gap-3 text-sm text-zinc-500">
          <span>共 <strong class="font-semibold text-zinc-900">{{ templates.length }}</strong> 个精选模板</span>
          <span class="text-zinc-200">|</span>
          <span>第 <strong class="font-semibold text-zinc-900">{{ page }}</strong> / {{ totalPages }} 页</span>
        </div>
        <div class="flex items-center gap-1 bg-zinc-50 p-1.5 rounded-[1.5rem] ring-1 ring-zinc-100/80 w-full sm:w-auto justify-between sm:justify-start">
          <button
            class="inline-flex h-10 items-center justify-center gap-1.5 rounded-[1.25rem] bg-white px-4.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white active:scale-[0.98]"
            :disabled="page <= 1"
            @click="changePage(page - 1)"
          >
            <ChevronLeft class="h-4 w-4 text-zinc-400" />
            <span class="text-xs font-semibold tracking-wide">上一页</span>
          </button>
          <span class="px-4 text-xs font-semibold tracking-wider text-zinc-600 font-mono">
            {{ page }} / {{ totalPages }}
          </span>
          <button
            class="inline-flex h-10 items-center justify-center gap-1.5 rounded-[1.25rem] bg-white px-4.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white active:scale-[0.98]"
            :disabled="page >= totalPages"
            @click="changePage(page + 1)"
          >
            <span class="text-xs font-semibold tracking-wide">下一页</span>
            <ChevronRight class="h-4 w-4 text-zinc-400" />
          </button>
        </div>
      </div>
    </main>

    <Transition name="choice-fade">
      <div v-if="selectedTemplate" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm" @click="closeUseChoice">
        <section
          class="w-full max-h-[90vh] overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)]"
          :class="useTemplateMode === 'starter' ? 'max-w-5xl' : 'max-w-3xl'"
          @click.stop
        >
          <header class="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5 sm:px-7">
            <div class="flex min-w-0 items-start gap-2.5">
              <button
                v-if="useTemplateMode === 'starter'"
                class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
                @click="useTemplateMode = 'choice'"
              >
                <ChevronLeft class="h-5 w-5" />
              </button>
              <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Use Template</p>
              <h2 class="mt-1 text-xl font-semibold tracking-tight text-zinc-950">{{ useTemplateMode === 'starter' ? '选择岗位内容' : '如何开始这份简历？' }}</h2>
              <p class="mt-1 truncate text-sm text-zinc-500">已选择「{{ selectedTemplate.name }}」，创建后会应用该模板。</p>
              </div>
            </div>
            <button class="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" title="关闭" @click="closeUseChoice"><X class="h-5 w-5" /></button>
          </header>

          <div v-if="useTemplateMode === 'choice'" class="grid gap-3 p-5 sm:grid-cols-3 sm:p-7">
            <button class="group flex min-h-[190px] flex-col rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-200/50 active:scale-[0.99]" :disabled="creatingResume" @click="createBlankResume">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white"><FileText class="h-5 w-5" /></span>
              <h3 class="mt-5 text-base font-semibold text-zinc-950">创建空白简历</h3>
              <p class="mt-1.5 text-sm leading-6 text-zinc-500">使用这套模板创建一份新简历，从基本信息开始填写。</p>
              <span class="mt-auto inline-flex items-center gap-1.5 pt-5 text-xs font-semibold text-zinc-900">{{ creatingResume ? "正在创建..." : "立即创建" }}<ArrowRight v-if="!creatingResume" class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
            </button>

            <button class="group flex min-h-[190px] flex-col rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-200/50 active:scale-[0.99]" @click="openStarterFlow">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200"><Briefcase class="h-5 w-5" /></span>
              <h3 class="mt-5 text-base font-semibold text-zinc-950">按岗位起稿</h3>
              <p class="mt-1.5 text-sm leading-6 text-zinc-500">选择行业、岗位和经验阶段，用当前模板生成内容初稿。</p>
              <span class="mt-auto inline-flex items-center gap-1.5 pt-5 text-xs font-semibold text-zinc-900">选择岗位<ArrowRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
            </button>

            <button class="group flex min-h-[190px] flex-col rounded-2xl border border-blue-100 bg-blue-50/40 p-5 text-left transition hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-lg hover:shadow-blue-100/60 active:scale-[0.99]" @click="importExistingResume">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100"><FileUp class="h-5 w-5" /></span>
              <h3 class="mt-5 text-base font-semibold text-zinc-950">导入现有简历</h3>
              <p class="mt-1.5 text-sm leading-6 text-zinc-500">上传 PDF、Word 或图片，智能识别后套用当前模板。</p>
              <span class="mt-auto inline-flex items-center gap-1.5 pt-5 text-xs font-semibold text-blue-700">选择文件导入<ArrowRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
            </button>
          </div>

          <div v-else class="max-h-[calc(90vh-92px)] overflow-y-auto bg-zinc-50/50 p-5 sm:p-7">
            <div v-if="starterLoading" class="flex min-h-[340px] items-center justify-center text-sm text-zinc-500">正在加载岗位内容...</div>
            <div v-else-if="starterError" class="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
              <p class="text-sm font-medium text-zinc-900">{{ starterError }}</p>
              <Button variant="outline" class="mt-4 h-9 rounded-full border-zinc-200 bg-white px-4 text-xs text-zinc-700" @click="loadStarterCatalog">重新加载</Button>
            </div>
            <div v-else-if="selectedStarterIndustry && selectedStarterLevel" class="space-y-4">
              <section>
                <h3 class="mb-2.5 text-sm font-semibold text-zinc-950">行业</h3>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  <button
                    v-for="industry in starterIndustries"
                    :key="industry.id"
                    class="h-8 truncate rounded-full border px-2 text-[13px] font-medium transition active:scale-[0.98]"
                    :class="selectedStarterIndustryId === industry.id ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950'"
                    @click="selectStarterIndustry(industry.id)"
                  >
                    {{ industry.name }}
                  </button>
                </div>
              </section>

              <section>
                <h3 class="mb-2.5 text-sm font-semibold text-zinc-950">岗位方向</h3>
                <div v-if="starterRolesLoading" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div v-for="index in 6" :key="index" class="h-14 rounded-lg border border-zinc-100 bg-white px-3 py-2">
                    <div class="h-3.5 w-24 rounded-full bg-zinc-100"></div>
                    <div class="mt-2 h-3 w-32 rounded-full bg-zinc-100/80"></div>
                  </div>
                </div>
                <div v-else-if="starterRolesError" class="flex min-h-[96px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center">
                  <p class="text-sm text-zinc-500">{{ starterRolesError }}</p>
                  <Button variant="outline" class="mt-3 h-8 rounded-full border-zinc-200 bg-white px-4 text-xs text-zinc-700" @click="loadStarterRoles(selectedStarterIndustryId)">重试</Button>
                </div>
                <div v-else-if="selectedStarterIndustry.roles.length" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <button
                    v-for="role in selectedStarterIndustry.roles"
                    :key="role.starter_id"
                    class="group relative flex h-14 flex-col justify-center rounded-lg border px-3 py-2 text-left transition active:scale-[0.99]"
                    :class="selectedStarterRoleId === role.starter_id ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'"
                    @click="selectedStarterRoleId = role.starter_id"
                  >
                    <span class="block truncate text-[13.5px] font-semibold leading-5" :class="selectedStarterRoleId === role.starter_id ? 'text-blue-900' : 'text-zinc-900'">{{ role.title }}</span>
                    <span class="mt-0.5 block truncate text-[11.5px] leading-4" :class="selectedStarterRoleId === role.starter_id ? 'text-blue-700/80' : 'text-zinc-500'">{{ role.subtitle }}</span>
                  </button>
                </div>
                <div v-else class="flex min-h-[96px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
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
                    @click="selectedStarterLevelId = level.id"
                  >
                    {{ level.short_label }}
                  </button>
                </div>
              </section>

              <div class="rounded-xl border border-zinc-100 bg-white px-3.5 py-3">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm font-semibold text-zinc-950">{{ selectedStarterRole ? starterResumeTitle : "选择岗位后生成初稿" }}</p>
                    <div v-if="selectedStarterRole" class="mt-2 flex flex-wrap gap-1.5">
                      <span
                        v-for="module in selectedStarterModules"
                        :key="module.key"
                        class="rounded-full bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-100"
                      >
                        {{ module.title }}
                      </span>
                    </div>
                  </div>
                  <Button class="h-9 rounded-full bg-zinc-900 px-5 text-[13px] text-white hover:bg-zinc-800 sm:w-36" :disabled="starterCreating || starterRolesLoading || !selectedStarterRole" @click="createStarterResume">
                    {{ starterCreating ? "正在创建..." : "创建初稿" }}
                    <ArrowRight v-if="!starterCreating" class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Transition>

    <ResumeImportProgress
      :open="importingResume"
      :progress="importProgress"
      :stage-index="importStageIndex"
      :stages="importStages"
      :template-name="selectedTemplate?.name || ''"
    />

    <ConfirmDialog
      v-model:open="importConfirmOpen"
      title="确认导入现有简历？"
      :description="importConfirmDescription"
      confirm-text="选择文件"
      cancel-text="取消"
      :destructive="false"
      @confirm="chooseImportFile"
    />
  </AppLayout>
</template>

<style scoped>
.choice-fade-enter-active,
.choice-fade-leave-active {
  transition: opacity 0.18s ease;
}

.choice-fade-enter-active section,
.choice-fade-leave-active section {
  transition: transform 0.24s ease, opacity 0.18s ease;
}

.choice-fade-enter-from,
.choice-fade-leave-to {
  opacity: 0;
}

.choice-fade-enter-from section,
.choice-fade-leave-to section {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
