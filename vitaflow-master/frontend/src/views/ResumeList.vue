<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { AlertCircle, CheckCircle2, Plus, Sparkles, X } from "lucide-vue-next"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import ResumeImportProgress from "@/components/resume/ResumeImportProgress.vue"
import ResumeCard from "@/components/resume/ResumeCard.vue"
import CreateResumeModal from "@/components/resume/CreateResumeModal.vue"
import ResumeGridSkeleton from "@/components/resume/ResumeGridSkeleton.vue"
import ResumeListEmptyState from "@/components/resume/ResumeListEmptyState.vue"
import ResumeListPagination from "@/components/resume/ResumeListPagination.vue"
import AppLayout from "@/components/layout/AppLayout.vue"
import Button from "@/components/ui/button/Button.vue"
import { useResumeStore } from "@/stores/resume"
import AiGenerateDialog from "@/components/ai/AiGenerateDialog.vue"
import { generateResumeStreamApi, getFlowPointSummaryApi, type FlowPointSummary } from "@/api/ai"
import { listTemplatesApi, type TemplateItem } from "@/api/template"
import AnnouncementModal from "@/components/announcement/AnnouncementModal.vue"
import { getCurrentAnnouncementApi, type AnnouncementItem } from "@/api/announcement"
import { importResumeFileApi } from "@/api/resume"
import { listResumeStartersApi, type ResumeStarterIndustry, type ResumeStarterLevel, type ResumeStarterRole } from "@/api/resumeStarter"

const router = useRouter()
const store = useResumeStore()
const showAiCreate = ref(false)
const showCreateChoice = ref(false)
const templateSelectMode = ref<"create" | "import" | "blank">("create")
const createMode = ref<"entry" | "starter">("entry")
const showDeleteConfirm = ref(false)
const resumeToDelete = ref<number | null>(null)

const aiLoading = ref(false)
const aiError = ref("")
const aiStreamText = ref("")
const aiInitialTargetPosition = ref("")
const aiInitialPersonalInfo = ref("")
const aiInitialStyle = ref("技术型")
const aiTemplateId = ref("tech")
const toastMessage = ref("")
const announcement = ref<AnnouncementItem | null>(null)
const flowPointSummary = ref<FlowPointSummary | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const importingResume = ref(false)
const importProgress = ref(0)
const importStageIndex = ref(0)
const importConfirmOpen = ref(false)
const selectedImportTemplateId = ref("tech")
const starterIndustries = ref<ResumeStarterIndustry[]>([])
const starterLevels = ref<ResumeStarterLevel[]>([])
const starterLoading = ref(false)
const starterRolesLoading = ref(false)
const starterError = ref("")
const starterRolesError = ref("")
const selectedStarterIndustryId = ref("")
const selectedStarterRoleId = ref("")
const selectedStarterLevelId = ref("junior")
const starterCreating = ref(false)
const isImportRendering = ref(false)
let importProgressTimer: ReturnType<typeof window.setInterval> | null = null

const importStages = [
  "读取文件内容",
  "识别简历文本",
  "提取履历结构",
  "生成简历数据",
  "创建并准备跳转",
]

const templates = ref<TemplateItem[]>([])
const modalPage = ref(1)
const pagedModalTemplates = computed(() => {
  const start = (modalPage.value - 1) * 8
  return templates.value.slice(start, start + 8)
})
const loadedStarterIndustryIds = new Set<string>()
let starterRoleRequestId = 0
const listLoading = ref(false)
const templateNames: Record<string, string> = {
  classic: "经典单栏",
  tech: "技术蓝线",
  modern: "现代侧栏",
  blue_timeline: "蓝色时间轴",
  minimal_light: "极简明亮",
  minimal_mono: "极简单色",
  modern_clean: "现代清新",
  elegant_line: "优雅线型",
  editorial_serif: "编辑部衬线",
  executive_panel: "商务简报",
  portfolio_cards: "作品集卡片",
  compact_matrix: "紧凑矩阵",
}

const isTruncatedMap = ref<Record<string | number, boolean>>({})
function checkTitleTruncation(event: MouseEvent, id: string | number) {
  const el = event.currentTarget as HTMLElement
  if (el) {
    isTruncatedMap.value[id] = el.scrollWidth > el.clientWidth
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(store.resumeListTotal / store.resumeListPageSize)))
const selectedStarterIndustry = computed(() => starterIndustries.value.find((item) => item.id === selectedStarterIndustryId.value) || starterIndustries.value[0])
const selectedStarterRole = computed<ResumeStarterRole | undefined>(() => selectedStarterIndustry.value?.roles.find((role) => role.starter_id === selectedStarterRoleId.value) || selectedStarterIndustry.value?.roles[0])
const selectedStarterLevel = computed(() => starterLevels.value.find((level) => level.id === selectedStarterLevelId.value) || starterLevels.value[1] || starterLevels.value[0])
const starterResumeTitle = computed(() => {
  if (!selectedStarterRole.value || !selectedStarterLevel.value) return "岗位起稿简历"
  return `${selectedStarterRole.value.title}简历 · ${selectedStarterLevel.value.short_label}`
})
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

function getResponsivePageSize() {
  if (typeof window === "undefined") return 8
  const width = window.innerWidth
  if (width >= 1024) return 8  // lg:grid-cols-4 -> 4 * 2 = 8
  if (width >= 768) return 6   // md:grid-cols-3 -> 3 * 2 = 6
  return 6                     // sm/mobile: grid-cols-2 -> 2 * 3 = 6
}

async function loadResumePage(page = store.resumeListPage, pageSize = getResponsivePageSize()) {
  listLoading.value = true
  try {
    await store.fetchResumeList(page, pageSize)
  } finally {
    listLoading.value = false
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
    if (selectedStarterIndustryId.value) {
      await loadStarterRoles(selectedStarterIndustryId.value)
    }
  } catch (error: any) {
    starterError.value = error?.message || "岗位起稿内容加载失败"
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

function handleResumeListBreakpointChange() {
  const nextPageSize = getResponsivePageSize()
  if (nextPageSize !== store.resumeListPageSize) loadResumePage(1, nextPageSize)
}

onMounted(async () => {
  const [currentAnnouncement] = await Promise.all([
    getCurrentAnnouncementApi().catch(() => null),
    loadResumePage(1),
    listTemplatesApi().then((items) => (templates.value = items)),
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null),
  ])
  announcement.value = currentAnnouncement
  window.addEventListener("resize", handleResumeListBreakpointChange)
})
onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResumeListBreakpointChange)
  stopImportProgress()
})
function selectTemplate(templateId: string) {
  if (templateSelectMode.value === "import") {
    selectedImportTemplateId.value = templateId
    showCreateChoice.value = false
    importConfirmOpen.value = true
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
    return
  }
  showCreateChoice.value = false
  createResume(templateId)
}

async function createResume(templateId: string) {
  const item = await store.createResume(templateId)
  showCreateChoice.value = false
  router.push(`/resumes/${item.id}/edit`)
}

async function createStarterResume() {
  if (starterCreating.value || !selectedStarterRole.value) return
  starterCreating.value = true
  try {
    const item = await store.createResumeFromStarter(selectedStarterRole.value.starter_id, selectedStarterLevelId.value, "__industry_default")
    showCreateChoice.value = false
    router.push(`/resumes/${item.id}/edit`)
  } finally {
    starterCreating.value = false
  }
}
async function generateResume(payload: any) {
  aiLoading.value = true
  aiError.value = ""
  aiStreamText.value = ""
  try {
    const result = await generateResumeStreamApi(payload, {
      onDelta: (text) => (aiStreamText.value += text),
    })
    if (payload.template_id) {
      result.template_id = payload.template_id
      result.template_config = result.template_config || {}
    }
    const item = await store.createResumeFromAi(result)
    showAiCreate.value = false
    router.push(`/resumes/${item.id}/edit`)
  } catch (error: any) {
    aiError.value = error.message === "SILENT_ERROR" ? "" : (error.message || "AI 生成失败")
  } finally {
    aiLoading.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

const pointConfirmOpen = ref(false)
const pointConfirmPayload = ref<any>(null)

type PointRule = FlowPointSummary["rules"][number]

function formatPointCost(rule?: PointRule) {
  if (!rule) return "本次消耗未知"
  const parts = [`${rule.points_per_call} 点`]
  const inputRate = rule.points_per_million_input_tokens ?? rule.points_per_million_tokens ?? 0
  const outputRate = rule.points_per_million_output_tokens ?? rule.points_per_million_tokens ?? 0
  const hasSplitRate = inputRate > 0 || outputRate > 0
  if (inputRate > 0) {
    parts.push(`输入 ${inputRate} 点/百万 Tokens`)
  }
  if (outputRate > 0) {
    parts.push(`输出 ${outputRate} 点/百万 Tokens`)
  }
  if (!hasSplitRate && (rule.points_per_1k_tokens || 0) > 0) {
    parts.push(`${rule.points_per_1k_tokens} 点/千 Tokens`)
  }
  return parts.join(" + ")
}

const pointConfirmDescription = computed(() => {
  if (!flowPointSummary.value) return "正在获取点数信息..."
  const rule = flowPointSummary.value.rules.find(r => r.feature_type === "generate_resume")
  return `预计消耗：${formatPointCost(rule)}（当前余额：${flowPointSummary.value.balance} 点）`
})

const importPointRule = computed(() => flowPointSummary.value?.rules.find(r => r.feature_type === "import_resume"))
const importCostText = computed(() => {
  if (!flowPointSummary.value) return "正在获取点数信息"
  return `${formatPointCost(importPointRule.value)} · 当前余额 ${flowPointSummary.value.balance} 点`
})

const importConfirmDescription = computed(() => {
  if (!flowPointSummary.value) return `正在获取点数信息...`
  const rule = flowPointSummary.value.rules.find(r => r.feature_type === "import_resume")
  return `本次智能导入预计消耗 ${formatPointCost(rule)}（当前余额：${flowPointSummary.value.balance} 点）。支持 PDF、Word、TXT/Markdown 单文件导入，也支持一次选择多张图片。`
})

function requestGenerateWithPoints(payload: any) {
  pointConfirmPayload.value = {
    ...payload,
    template_id: aiTemplateId.value || payload.template_id || "tech",
  }
  pointConfirmOpen.value = true
  getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
}

function openAiCreate() {
  aiInitialTargetPosition.value = ""
  aiInitialPersonalInfo.value = ""
  aiInitialStyle.value = "技术型"
  aiTemplateId.value = "tech"
  showAiCreate.value = true
}

function openStarterAiGenerate() {
  if (!selectedStarterRole.value || !selectedStarterIndustry.value || !selectedStarterLevel.value) return
  const modules = selectedStarterModules.value.map((item) => item.title).join("、")
  const keywords = selectedStarterRole.value.keywords?.slice(0, 8).join("、") || ""
  aiInitialTargetPosition.value = selectedStarterRole.value.title
  aiInitialStyle.value = selectedStarterIndustry.value.id.includes("internet") || selectedStarterIndustry.value.id.includes("data") ? "技术型" : "专业简洁"
  aiTemplateId.value = selectedStarterRole.value.default_template_id || "tech"
  aiInitialPersonalInfo.value = [
    `目标行业：${selectedStarterIndustry.value.name}`,
    `目标岗位：${selectedStarterRole.value.title}`,
    `经验阶段：${selectedStarterLevel.value.label}`,
    keywords ? `岗位关键词：${keywords}` : "",
    modules ? `建议模块：${modules}` : "",
    "",
    "请在这里补充你的真实信息：姓名/城市/学历/专业/技能/项目/实习或工作经历/证书奖项/求职亮点。",
  ].filter(Boolean).join("\n")
  showCreateChoice.value = false
  showAiCreate.value = true
}

function openCreateChoice() {
  templateSelectMode.value = "create"
  createMode.value = "entry"
  modalPage.value = 1
  showCreateChoice.value = true
}

function closeCreateModal() {
  showCreateChoice.value = false
}

function backToCreateEntry() {
  templateSelectMode.value = "create"
  createMode.value = "entry"
}

function openStarterFlow() {
  templateSelectMode.value = "create"
  createMode.value = "starter"
  showCreateChoice.value = true
  if (!starterIndustries.value.length && !starterLoading.value) loadStarterCatalog()
}

function openImportFlow() {
  templateSelectMode.value = "import"
  createMode.value = "entry"
  showCreateChoice.value = true
  modalPage.value = 1
  isImportRendering.value = true

  setTimeout(() => {
    isImportRendering.value = false
    if (!templates.value.length) listTemplatesApi().then((items) => (templates.value = items)).catch(() => null)
  }, 250)

  getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
}

function openBlankFlow() {
  templateSelectMode.value = "blank"
  createMode.value = "entry"
  showCreateChoice.value = true
  modalPage.value = 1
  isImportRendering.value = true

  setTimeout(() => {
    isImportRendering.value = false
    if (!templates.value.length) listTemplatesApi().then((items) => (templates.value = items)).catch(() => null)
  }, 250)

}

function handlePointConfirm() {
  pointConfirmOpen.value = false
  if (pointConfirmPayload.value) {
    generateResume(pointConfirmPayload.value)
    pointConfirmPayload.value = null
  }
}

function goToEdit(id: number) {
  router.push(`/resumes/${id}/edit`)
}

function showToast(message: string) {
  toastMessage.value = message
  setTimeout(() => {
    if (toastMessage.value === message) {
      toastMessage.value = ""
    }
  }, 2500)
}

function stopImportProgress() {
  if (importProgressTimer) window.clearInterval(importProgressTimer)
  importProgressTimer = null
}

function startImportProgress() {
  stopImportProgress()
  importProgress.value = 8
  importStageIndex.value = 0
  importProgressTimer = window.setInterval(() => {
    if (importProgress.value >= 92) return
    const nextProgress = Math.min(92, importProgress.value + (importProgress.value < 45 ? 7 : importProgress.value < 72 ? 5 : 3))
    importProgress.value = nextProgress
    importStageIndex.value = Math.min(importStages.length - 1, Math.floor((nextProgress / 100) * importStages.length))
  }, 900)
}

function finishImportProgress() {
  stopImportProgress()
  importProgress.value = 100
  importStageIndex.value = importStages.length - 1
}

function handleImportConfirm() {
  importConfirmOpen.value = false
  setTimeout(() => importFileInput.value?.click(), 60)
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ""
  if (!files.length) return
  const imageFiles = files.filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(file.name))
  if (files.length > 1 && imageFiles.length !== files.length) {
    showToast("多文件导入仅支持多张图片，PDF/Word 请单独上传")
    return
  }
  importingResume.value = true
  startImportProgress()
  try {
    const item = await importResumeFileApi(files.length === 1 ? files[0] : files, selectedImportTemplateId.value)
    finishImportProgress()
    showToast("导入成功")
    router.push(`/resumes/${item.id}/edit`)
  } catch (error: any) {
    showToast(error?.message || "导入失败，未识别到有效简历内容")
    stopImportProgress()
  } finally {
    importingResume.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

async function handleDuplicate(id: number) {
  try {
    await store.duplicateResume(id)
    showToast("复制成功")
  } catch (error) {
    showToast("复制失败，请重试")
  }
}

function triggerDelete(id: number) {
  resumeToDelete.value = id
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (resumeToDelete.value === null) return
  try {
    await store.deleteResume(resumeToDelete.value)
    showDeleteConfirm.value = false
    resumeToDelete.value = null
    showToast("删除成功")
  } catch (error) {
    showToast("删除失败，请重试")
  }
}
</script>

<template>
  <AppLayout>
    <AnnouncementModal v-if="announcement" :announcement="announcement" @close="announcement = null" />
    <main class="mx-auto max-w-7xl px-4 sm:px-6 py-4 md:py-10 relative">
      <!-- Toast Notification -->
      <Transition name="toast-slide">
        <div v-if="toastMessage" class="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex w-max max-w-[90vw] items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white shadow-xl border border-zinc-800">
          <CheckCircle2 v-if="toastMessage.includes('成功')" class="h-4 w-4 shrink-0 text-emerald-400" />
          <AlertCircle v-else class="h-4 w-4 shrink-0 text-red-400" />
          <span class="break-words">{{ toastMessage }}</span>
        </div>
      </Transition>

      <ResumeImportProgress
        :open="importingResume"
        :progress="importProgress"
        :stage-index="importStageIndex"
        :stages="importStages"
        :template-name="templateNames[selectedImportTemplateId] || '所选模板'"
      />

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          <p class="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-zinc-400">My Workspace</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-zinc-950 tracking-tight">工作台</h1>
          <p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-zinc-500">
            管理、编辑并导出你的极简专业简历
            <span v-if="store.resumeListTotal" class="ml-2 text-zinc-400">共 {{ store.resumeListTotal }} 份</span>
          </p>
        </div>
        <div class="flex items-center justify-end gap-2.5 w-full sm:w-auto mt-1 sm:mt-0">
          <Button variant="outline" class="h-9 px-4.5 rounded-full bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-200 ease-out active:scale-[0.98] text-xs sm:text-sm font-medium shadow-none flex items-center justify-center" @click="openCreateChoice">
            <Plus class="h-3.5 w-3.5 mr-1.5 text-zinc-500 shrink-0" /> 创建简历
          </Button>
          <input ref="importFileInput" type="file" class="hidden" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp" multiple @change="handleImportFile" />
          <Button class="h-9 px-4.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 transition-all duration-200 ease-out active:scale-[0.98] text-xs sm:text-sm font-medium shadow-none flex items-center justify-center" @click="openAiCreate">
            <Sparkles class="h-3.5 w-3.5 mr-1.5 text-zinc-400 shrink-0" /> AI 智能生成
          </Button>
        </div>
      </div>

      <CreateResumeModal
        :open="showCreateChoice"
        :template-select-mode="templateSelectMode"
        :create-mode="createMode"
        :templates="templates"
        :paged-templates="pagedModalTemplates"
        v-model:modal-page="modalPage"
        :starter-industries="starterIndustries"
        :starter-levels="starterLevels"
        :starter-loading="starterLoading"
        :starter-roles-loading="starterRolesLoading"
        :starter-error="starterError"
        :starter-roles-error="starterRolesError"
        :selected-starter-industry="selectedStarterIndustry"
        :selected-starter-role="selectedStarterRole"
        :selected-starter-level="selectedStarterLevel"
        :selected-starter-industry-id="selectedStarterIndustryId"
        v-model:selected-starter-role-id="selectedStarterRoleId"
        v-model:selected-starter-level-id="selectedStarterLevelId"
        :starter-resume-title="starterResumeTitle"
        :selected-starter-modules="selectedStarterModules"
        :starter-creating="starterCreating"
        :is-import-rendering="isImportRendering"
        @close="closeCreateModal"
        @back="backToCreateEntry"
        @open-starter="openStarterFlow"
        @open-blank="openBlankFlow"
        @open-import="openImportFlow"
        @load-starter-catalog="loadStarterCatalog"
        @load-starter-roles="loadStarterRoles"
        @select-starter-industry="selectStarterIndustry"
        @open-starter-ai-generate="openStarterAiGenerate"
        @create-starter-resume="createStarterResume"
        @select-template="selectTemplate"
      />

      <!-- AI Generation Modal -->
      <Transition name="modal-fade">
        <div v-if="showAiCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div class="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transform transition-all" @click.stop>
            <div class="shrink-0 flex items-center justify-between border-b border-zinc-100 px-6 py-5 bg-zinc-50/50">
              <div>
                <h2 class="text-lg font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
                  <Sparkles class="w-4 h-4 text-zinc-700"/> AI 智能生成
                </h2>
                <p class="mt-1 text-xs text-zinc-500">输入基础信息，AI 将为你提炼出彩简历</p>
              </div>
              <button class="p-2 text-zinc-400 hover:bg-zinc-200/50 hover:text-zinc-600 rounded-full transition-colors" @click="showAiCreate = false">
                <X class="h-5 w-5" />
              </button>
            </div>
            <div class="min-h-0 flex-1 p-4 sm:p-6 thin-scrollbar" :class="aiLoading ? 'overflow-hidden' : 'overflow-y-auto'">
              <p v-if="aiError" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{{ aiError }}</p>
              <AiGenerateDialog
                :loading="aiLoading"
                :stream-text="aiStreamText"
                :initial-target-position="aiInitialTargetPosition"
                :initial-personal-info="aiInitialPersonalInfo"
                :initial-style="aiInitialStyle"
                @generate="requestGenerateWithPoints"
              />
            </div>
          </div>
        </div>
      </Transition>


      <!-- Resume List -->
      <ResumeGridSkeleton v-if="listLoading && !store.resumeList.length" />

      <div v-else-if="store.resumeList.length" class="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <ResumeCard
          v-for="item in store.resumeList"
          :key="item.id"
          :item="item"
          :templates="templates"
          :template-names="templateNames"
          :is-title-truncated="isTruncatedMap[item.id]"
          @edit="goToEdit"
          @duplicate="handleDuplicate"
          @delete="triggerDelete"
          @check-title="checkTitleTruncation"
        />
      </div>

      <ResumeListPagination
        v-if="store.resumeList.length && totalPages > 1"
        :page="store.resumeListPage"
        :total-pages="totalPages"
        :total="store.resumeListTotal"
        :loading="listLoading"
        @change="loadResumePage"
      />

      <!-- Empty State -->
      <ResumeListEmptyState v-if="!listLoading && !store.resumeList.length" @create="openCreateChoice" />
    </main>

    <ConfirmDialog 
      v-model:open="showDeleteConfirm" 
      title="确认删除该简历吗？" 
      description="删除后将无法恢复，请谨慎操作。" 
      cancel-text="取消"
      destructive
      @confirm="confirmDelete" 
    />

    <ConfirmDialog
      v-model:open="pointConfirmOpen"
      title="确认进行智能生成？"
      :description="pointConfirmDescription"
      confirm-text="确认使用"
      cancel-text="取消"
      @confirm="handlePointConfirm"
    />

    <ConfirmDialog
      v-model:open="importConfirmOpen"
      :title="`导入简历至「${templateNames[selectedImportTemplateId] || '所选模板'}」`"
      :description="importConfirmDescription"
      confirm-text="选择文件"
      cancel-text="取消"
      @confirm="handleImportConfirm"
    />
  </AppLayout>
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
/* Modal Scale Transition */
.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(10px);
}

/* Toast Transition */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}

</style>
