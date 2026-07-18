<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowLeft, Bot, CheckCircle2, Coins, Download, FileText, FileSearch, Languages, LoaderCircle, Redo2, Save, Settings, Share2, Trash2, Undo2, X, Edit3, Eye, ScanLine, Pencil, AlertCircle, LayoutTemplate, ArrowRight, Menu, Info } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Input from "@/components/ui/input/Input.vue"
import FlowAgentIcon from "@/components/common/FlowAgentIcon.vue"
import FlowPointIcon from "@/components/ui/FlowPointIcon.vue"
import ModuleSidebar from "@/components/editor/ModuleSidebar.vue"
import ResumeFormPanel from "@/components/editor/ResumeFormPanel.vue"
import StyleConfigPanel from "@/components/editor/StyleConfigPanel.vue"
import A4Preview from "@/components/preview/A4Preview.vue"
import ResumeScorePanel from "@/components/ai/ResumeScorePanel.vue"
import JdOptimizeModal from "@/components/ai/JdOptimizeModal.vue"
import ResumeTranslatePanel from "@/components/ai/ResumeTranslatePanel.vue"
import ResumeAiChatPanel from "@/components/ai/ResumeAiChatPanel.vue"
import { normalizeResumeData, useResumeStore } from "@/stores/resume"
import { useEditorStore, type EditorHistorySnapshot } from "@/stores/editor"
import { exportPdfApi, exportWordApi } from "@/api/export"
import { clearResumeChatMessagesApi, decideResumeChatChangeApi, getAiCapabilityApi, getResumeChatMessagesApi, optimizeByJdStreamApi, optimizeSectionStreamApi, scoreResumeStreamApi, sendResumeChatMessageStreamApi, regenerateResumeChatMessageStreamApi, getFlowPointSummaryApi, translateResumeStreamApi, type FlowPointSummary, type AiCapability, type AiChatAttachment, type AiChatModelOption } from "@/api/ai"
import { previewHtmlApi } from "@/api/resume"
import { listTemplatesApi, type TemplateItem } from "@/api/template"
import TemplatePreview from "@/components/templates/TemplatePreview.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import ResumeShareDialog from "@/components/resume/ResumeShareDialog.vue"
import { showGlobalToast } from "@/utils/toast"
import { createPresetSection } from "@/utils/resumePresets"
import { applyResumeLanguage, normalizeResumeLanguage } from "@/utils/resumeLocale"

const route = useRoute()
const router = useRouter()
const resumeStore = useResumeStore()
const editor = useEditorStore()
const showStyle = ref(false)
const mobileMenuOpen = ref(false)
const showTemplateModal = ref(false)
const templates = ref<TemplateItem[]>([])
const showDeleteConfirm = ref(false)
const showShareDialog = ref(false)

function triggerDelete() {
  mobileMenuOpen.value = false
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!resumeStore.currentResume?.id) return
  try {
    await resumeStore.deleteResume(resumeStore.currentResume.id)
    showDeleteConfirm.value = false
    showGlobalToast("删除成功", "success")
    router.push("/resumes")
  } catch (error) {
    showGlobalToast("删除失败，请重试")
  }
}

function toggleMobileMenu() {
  if (showStyle.value || showTemplateModal.value) {
    showStyle.value = false
    showTemplateModal.value = false
    mobileMenuOpen.value = false
  } else {
    mobileMenuOpen.value = !mobileMenuOpen.value
  }
}

async function openTemplateModal() {
  if (showTemplateModal.value) {
    showTemplateModal.value = false
    return
  }
  showTemplateModal.value = true
  showStyle.value = false
  if (!templates.value.length) {
    templates.value = await listTemplatesApi()
  }
}
async function selectTemplate(templateId: string) {
  if (resumeStore.currentResume?.template_id === templateId) {
    showTemplateModal.value = false
    return
  }
  if (resumeStore.templateConfig) {
    resumeStore.templateConfig.template_id = templateId
    const defaults: Record<string, { theme_color: string; bg_color: string; icon_color: string; line_height?: number }> = {
      classic: { theme_color: "#2563eb", bg_color: "#ffffff", icon_color: "#2563eb" },
      tech: { theme_color: "#2563eb", bg_color: "#ffffff", icon_color: "#2563eb" },
      modern: { theme_color: "#0f766e", bg_color: "#ffffff", icon_color: "#ffffff" },
      blue_timeline: { theme_color: "#4673f4", bg_color: "#ffffff", icon_color: "#ffffff" },
      minimal_light: { theme_color: "#333333", bg_color: "#ffffff", icon_color: "#333333" },
      minimal_mono: { theme_color: "#000000", bg_color: "#ffffff", icon_color: "#6b7280" },
      modern_clean: { theme_color: "#0f766e", bg_color: "#ffffff", icon_color: "#0f766e" },
      elegant_line: { theme_color: "#111827", bg_color: "#ffffff", icon_color: "#111827" },
      editorial_serif: { theme_color: "#8f2d3b", bg_color: "#ffffff", icon_color: "#8f2d3b" },
      executive_panel: { theme_color: "#1f3a5f", bg_color: "#ffffff", icon_color: "#ffffff" },
      portfolio_cards: { theme_color: "#2f855a", bg_color: "#ffffff", icon_color: "#2f855a" },
      compact_matrix: { theme_color: "#475569", bg_color: "#ffffff", icon_color: "#475569", line_height: 1.45 },
    }
    if (defaults[templateId]) {
      resumeStore.templateConfig.theme_color = defaults[templateId].theme_color
      resumeStore.templateConfig.bg_color = defaults[templateId].bg_color
      resumeStore.templateConfig.icon_color = defaults[templateId].icon_color
      resumeStore.templateConfig.header_icon_color = defaults[templateId].icon_color
      if (defaults[templateId].line_height) resumeStore.templateConfig.line_height = defaults[templateId].line_height
    }
    editor.saved = false
    await save()
  }
  showTemplateModal.value = false
  showGlobalToast("已应用新模板并保存", "success")
}
type SidePanel = "none" | "style" | "chat" | "score" | "jd" | "translate" | "outline" | "suggestions" | "global"
const sidePanel = ref<SidePanel>("chat")

let activeIconFlightCleanup: (() => void) | null = null
let tabSwitchRequestId = 0

type HeroIconSnapshot = {
  element: HTMLElement
  rect: DOMRect
}

function captureVisibleHeroIcon(): HeroIconSnapshot | null {
  const elements = document.querySelectorAll<HTMLElement>('[style*="ai-hero-icon"]')
  for (const element of elements) {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
      return { element, rect }
    }
  }
  return null
}

function createHeroIconClone(element: HTMLElement, rect: DOMRect) {
  const clone = element.cloneNode(true) as HTMLElement
  clone.classList.add("ai-hero-flight-clone")
  clone.setAttribute("aria-hidden", "true")
  Object.assign(clone.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    viewTransitionName: "none",
    transformOrigin: "center",
    willChange: "left, top, width, height, opacity, filter",
  })
  document.body.appendChild(clone)
  return clone
}

function cancelActiveIconFlight() {
  const cleanup = activeIconFlightCleanup
  activeIconFlightCleanup = null
  cleanup?.()
}

function startHeroIconFlight(source: HeroIconSnapshot, target: HeroIconSnapshot) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

  const sourceRect = source.rect
  const targetRect = target.rect
  if (!sourceRect.width || !sourceRect.height || !targetRect.width || !targetRect.height) return

  const sourceClone = createHeroIconClone(source.element, sourceRect)
  const targetClone = createHeroIconClone(target.element, sourceRect)
  const targetOriginalOpacity = target.element.style.opacity
  target.element.style.opacity = "0"

  const sourceAnimation = sourceClone.animate(
    [
      {
        left: `${sourceRect.left}px`,
        top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        opacity: 1,
        filter: "blur(0)",
      },
      {
        left: `${targetRect.left}px`,
        top: `${targetRect.top}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`,
        opacity: 0,
        filter: "blur(3px)",
      },
    ],
    { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
  )
  const targetAnimation = targetClone.animate(
    [
      {
        left: `${sourceRect.left}px`,
        top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        opacity: 0,
        filter: "blur(3px)",
      },
      {
        left: `${targetRect.left}px`,
        top: `${targetRect.top}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`,
        opacity: 1,
        filter: "blur(0)",
      },
    ],
    { duration: 540, delay: 70, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
  )

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    sourceAnimation.cancel()
    targetAnimation.cancel()
    sourceClone.remove()
    targetClone.remove()
    target.element.style.opacity = targetOriginalOpacity
    if (activeIconFlightCleanup === cleanup) activeIconFlightCleanup = null
  }
  activeIconFlightCleanup = cleanup
  void Promise.allSettled([sourceAnimation.finished, targetAnimation.finished]).then(cleanup)
}

const switchTab = async (tab: "chat" | "score" | "jd" | "translate" | "outline" | "suggestions" | "global") => {
  if (sidePanel.value === tab) return
  const requestId = ++tabSwitchRequestId
  cancelActiveIconFlight()
  const sourceIcon = captureVisibleHeroIcon()
  sidePanel.value = tab
  await nextTick()
  if (tab === 'chat') {
    const chatList = document.querySelector('.chat-stage .overflow-y-auto')
    if (chatList) chatList.scrollTop = chatList.scrollHeight
  }
  if (requestId !== tabSwitchRequestId || !sourceIcon) return
  const targetIcon = captureVisibleHeroIcon()
  if (targetIcon) startHeroIconFlight(sourceIcon, targetIcon)
}

const mainMode = ref<"edit" | "ai">("edit")
const mobileTab = ref<"edit" | "ai" | "preview">("edit")
const formPanelExpanded = ref(true)

const score = ref<any>(null)
const scoreLoading = ref(false)
const scoreError = ref("")
const scoreStreamText = ref("")
const optimizeResult = ref<any>(null)
const optimizeLoading = ref(false)
const optimizeError = ref("")
const optimizeStreamText = ref("")
const optimizeSectionKey = ref("")
const jdText = ref("")
const jdResult = ref<any>(null)
const jdLoading = ref(false)
const jdError = ref("")
const jdStreamText = ref("")
const translationResult = ref<any>(null)
const translationLoading = ref(false)
const translationError = ref("")
const translationStreamText = ref("")
let isInitiatingScore = false
let isInitiatingOptimize = false
let isInitiatingJd = false
let isInitiatingTranslation = false
const chatMessages = ref<any[]>([])
const chatLoading = ref(false)
const chatLoaded = ref(false)
const aiCapability = ref<AiCapability | null>(null)
const flowPointSummary = ref<FlowPointSummary | null>(null)
const aiCapabilityLoaded = ref(false)
const chatDecisionLoadingId = ref<number | string | null>(null)
const selectedChatModelId = ref<number | null>(Number(localStorage.getItem("vitaflow_chat_model_id") || 0) || null)
const chatModels = computed<AiChatModelOption[]>(() => aiCapability.value?.chat_models || [])
const selectedChatModel = computed(() => chatModels.value.find((item) => item.id === selectedChatModelId.value) || chatModels.value[0] || null)
const effectiveChatModelId = computed(() => selectedChatModel.value?.id ?? selectedChatModelId.value ?? null)
const supportsChatImages = computed(() => Boolean(selectedChatModel.value?.supports_multimodal ?? aiCapability.value?.supports_multimodal))

const isMobile = ref(false)
const leftPanelWidth = ref(600)
const isWide = computed(() => !isMobile.value && leftPanelWidth.value >= 800)
let resizeHandler: () => void

onMounted(() => {
  isMobile.value = window.innerWidth < 768
  resizeHandler = () => { isMobile.value = window.innerWidth < 768 }
  window.addEventListener('resize', resizeHandler)
  window.addEventListener('keydown', handleHistoryShortcut)
  
  getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
})

onUnmounted(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  window.removeEventListener('keydown', handleHistoryShortcut)
})

watch(sidePanel, (newVal) => {
  if (newVal === "chat" && !chatLoaded.value) {
    loadChatMessages()
  }
  if (newVal === "chat" && !aiCapabilityLoaded.value) {
    loadAiCapability()
  }
})

watch(selectedChatModelId, (value) => {
  if (value) localStorage.setItem("vitaflow_chat_model_id", String(value))
  else localStorage.removeItem("vitaflow_chat_model_id")
})

const isResizing = ref(false)

function startResize(e: MouseEvent) {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  
  const startX = e.clientX
  const startWidth = leftPanelWidth.value
  
  function onMouseMove(e: MouseEvent) {
    if (!isResizing.value) return
    const delta = e.clientX - startX
    let newWidth = startWidth + delta
    if (newWidth < 400) newWidth = 400
    if (newWidth > 1200) newWidth = 1200
    leftPanelWidth.value = newWidth
  }
  
  function onMouseUp() {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const showAiOptimizeModal = ref(false)
const chatError = ref("")
const previewRefreshing = ref(false)
const exportLoading = ref<"" | "pdf" | "word">("")
const applySuccess = ref(false)
let applyTimer: ReturnType<typeof setTimeout> | undefined
const toastMessage = ref("")
const toastType = ref<"success" | "error">("success")

function showToast(msg: string, type: "success" | "error" = "success") {
  toastMessage.value = msg
  toastType.value = type
  setTimeout(() => {
    if (toastMessage.value === msg) {
      toastMessage.value = ""
    }
  }, 3000)
}
let saveDebounceTimer: ReturnType<typeof setTimeout> | undefined
let historyCommitTimer: ReturnType<typeof setTimeout> | undefined
let pendingHistoryLabel = "编辑内容"
let saveChain: Promise<unknown> = Promise.resolve()
let previewRequestSeq = 0
const resumeId = computed(() => Number(route.params.id))
const activeOptimizeResult = computed(() => (optimizeSectionKey.value === editor.currentSection ? optimizeResult.value : null))
const activeOptimizeLoading = computed(() => optimizeSectionKey.value === editor.currentSection && optimizeLoading.value)
const activeOptimizeError = computed(() => (optimizeSectionKey.value === editor.currentSection ? optimizeError.value : ""))
const activeOptimizeStreamText = computed(() => (optimizeSectionKey.value === editor.currentSection ? optimizeStreamText.value : ""))
const activeOptimizePreview = computed(() => {
  if (!resumeStore.resumeData || !activeOptimizeResult.value) return null
  return normalizeOptimizedSection(editor.currentSection, activeOptimizeResult.value, resumeStore.resumeData)
})
const aiWorkbenchOpen = computed(() => ["chat", "score", "jd", "translate"].includes(sidePanel.value))
const aiWorkbenchTitle = computed(() => {
  if (sidePanel.value === "score") return "简历 简历诊断"
  if (sidePanel.value === "jd") return "JD 匹配作战室"
  if (sidePanel.value === "translate") return "简历翻译"
  return "AI 简历助手"
})
const aiWorkbenchDescription = computed(() => {
  if (sidePanel.value === "score") return "扫描表达质量、岗位竞争力与内容完整度"
  if (sidePanel.value === "jd") return "把岗位要求、当前差距和可采纳修改放在同一张桌面上"
  return "围绕当前简历讨论、改写，并在写入前审阅每一处变化"
})

function debouncedSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = undefined
    void save().catch(() => undefined)
  }, 1500)
}

function cancelDebouncedSave() {
  if (!saveDebounceTimer) return
  clearTimeout(saveDebounceTimer)
  saveDebounceTimer = undefined
}

onMounted(async () => {
  try {
    await resumeStore.fetchResumeDetail(resumeId.value)
    if (!resumeStore.currentResume?.resume_data.layout.section_order.includes(editor.currentSection)) {
      editor.setCurrentSection("basics")
    }
    const initialSnapshot = captureEditorSnapshot()
    if (initialSnapshot) editor.resetHistory(initialSnapshot)
    if (sidePanel.value === "chat") {
      if (!chatLoaded.value) loadChatMessages()
      if (!aiCapabilityLoaded.value) loadAiCapability()
    }
    if (window.innerWidth < 768) {
      editor.setPreviewScale(Number(((window.innerWidth - 32) / 794).toFixed(2)))
    }
  } catch (error: any) {
    console.error("Failed to load resume:", error)
    showToast("简历不存在或无权限访问", "error")
    router.replace("/")
  }
})

onBeforeUnmount(() => {
  if (applyTimer) clearTimeout(applyTimer)
  tabSwitchRequestId += 1
  cancelActiveIconFlight()
  cancelDebouncedSave()
  cancelHistoryCommit()
  editor.setCurrentSection("basics")
})



async function performSave(options: { refreshPreview?: boolean } = {}) {
  if (!resumeStore.currentResume) return
  const { refreshPreview = true } = options
  editor.setSaving(true)
  try {
    const config = resumeStore.currentResume.template_config
    resumeStore.currentResume.template_id = config.template_id
    await resumeStore.updateResume({
      title: resumeStore.currentResume.title,
      language: resumeStore.currentResume.language,
      resume_data: resumeStore.currentResume.resume_data,
      template_id: resumeStore.currentResume.template_id,
      template_config: config,
    } as any)
    if (refreshPreview) await refreshPreviewLatest()
    editor.setSaved(true)
  } catch (error) {
    editor.saveError = true
    throw error
  } finally {
    editor.setSaving(false)
  }
}

function save(options: { refreshPreview?: boolean } = {}) {
  saveChain = saveChain.catch(() => undefined).then(() => performSave(options))
  return saveChain
}

async function saveAndGoToAiRecords() {
  await save({ refreshPreview: false })
  router.push("/ai-records")
}

async function openShareDialog() {
  mobileMenuOpen.value = false
  try {
    await save({ refreshPreview: false })
    showShareDialog.value = true
  } catch {
    showGlobalToast("保存简历失败，请稍后重试", "error")
  }
}

async function refreshPreviewLatest() {
  if (!resumeStore.currentResume) return
  const requestSeq = ++previewRequestSeq
  previewRefreshing.value = true
  try {
    const html = await previewHtmlApi(resumeStore.currentResume.id)
    if (requestSeq === previewRequestSeq) {
      resumeStore.previewHtml = html
    }
  } finally {
    if (requestSeq === previewRequestSeq) previewRefreshing.value = false
  }
}

function captureEditorSnapshot(): EditorHistorySnapshot | null {
  const current = resumeStore.currentResume
  if (!current) return null
  return JSON.parse(JSON.stringify({
    title: current.title || "",
    language: current.language || "zh-CN",
    resume_data: current.resume_data,
    template_id: current.template_id,
    template_config: current.template_config,
  })) as EditorHistorySnapshot
}

function commitEditorHistory(label = "编辑内容") {
  const snapshot = captureEditorSnapshot()
  return snapshot ? editor.commitHistory(snapshot, label) : false
}

function cancelHistoryCommit() {
  if (!historyCommitTimer) return
  clearTimeout(historyCommitTimer)
  historyCommitTimer = undefined
}

function scheduleHistoryCommit(label = "编辑内容") {
  if (editor.applyingHistory) return
  pendingHistoryLabel = label
  cancelHistoryCommit()
  historyCommitTimer = setTimeout(() => {
    historyCommitTimer = undefined
    commitEditorHistory(pendingHistoryLabel)
  }, 600)
}

function flushHistoryCommit() {
  if (!historyCommitTimer) return false
  cancelHistoryCommit()
  return commitEditorHistory(pendingHistoryLabel)
}

async function restoreHistorySnapshot(snapshot: EditorHistorySnapshot | null) {
  if (!snapshot || !resumeStore.currentResume) return
  cancelDebouncedSave()
  cancelHistoryCommit()
  editor.applyingHistory = true
  const restored = JSON.parse(JSON.stringify(snapshot)) as EditorHistorySnapshot
  resumeStore.currentResume.title = restored.title
  resumeStore.currentResume.language = normalizeResumeLanguage(restored.language)
  resumeStore.currentResume.resume_data = normalizeResumeData(restored.resume_data, restored.language)
  resumeStore.currentResume.template_id = restored.template_id
  resumeStore.currentResume.template_config = restored.template_config as any
  if (!resumeStore.currentResume.resume_data.layout.section_order.includes(editor.currentSection)) {
    editor.setCurrentSection("basics")
  }
  editor.saved = false
  try {
    await save()
  } finally {
    editor.applyingHistory = false
  }
}

async function undoLastChange() {
  if (editor.applyingHistory) return
  flushHistoryCommit()
  await restoreHistorySnapshot(editor.takeUndoSnapshot())
}

async function redoLastChange() {
  if (editor.applyingHistory) return
  flushHistoryCommit()
  await restoreHistorySnapshot(editor.takeRedoSnapshot())
}

function handleHistoryShortcut(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return
  const key = event.key.toLowerCase()
  const wantsUndo = key === "z" && !event.shiftKey
  const wantsRedo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey)
  if (!wantsUndo && !wantsRedo) return
  event.preventDefault()
  if (wantsUndo) void undoLastChange()
  else void redoLastChange()
}

function markChanged(label: unknown = "编辑内容") {
  editor.saved = false
  scheduleHistoryCommit(typeof label === "string" ? label : "编辑内容")
  debouncedSave()
}

function setResumeLanguage(language: "zh-CN" | "en") {
  const current = resumeStore.currentResume
  if (!current) return
  const previousLanguage = normalizeResumeLanguage(current.language)
  if (previousLanguage === language) return
  applyResumeLanguage(current.resume_data, previousLanguage, language)
  current.resume_data.layout.language_locked = true
  current.language = language
  current.resume_data = normalizeResumeData(current.resume_data, language)
  markChanged("切换简历语言")
}

async function resetStyleChanged() {
  markChanged("恢复默认样式")
  cancelDebouncedSave()
  flushHistoryCommit()
  try {
    await save()
  } catch (error: any) {
    showToast(error?.message || "保存默认样式失败", "error")
  }
}

function addCustomSection(presetType?: string) {
  const data = resumeStore.resumeData
  if (!data) return
  const section = createPresetSection(presetType)
  data.custom_sections.push(section)
  data.layout.section_order.push(section.id)
  data.layout.section_titles[section.id] = section.title
  editor.setCurrentSection(section.id)
  markChanged(presetType ? `添加${section.title}` : "添加自定义模块")
}

function removeCustomSection(key: string) {
  const data = resumeStore.resumeData
  if (!data) return
  data.custom_sections = data.custom_sections.filter((item) => item.id !== key)
  data.layout.section_order = data.layout.section_order.filter((item) => item !== key)
  delete data.layout.section_titles[key]
  if (data.layout.field_labels) delete data.layout.field_labels[key]
  editor.setCurrentSection("basics")
  markChanged()
}

function selectSection(key: string) {
  editor.setCurrentSection(key)
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function splitTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  return String(value ?? "")
    .split(/[,，、;；\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeLines(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  return String(value ?? "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (Array.isArray(value)) return value.map((item: unknown) => asText(item)).filter(Boolean).join("\n")
  if (isObject(value)) return String(value.content || value.description || value.text || "")
  return String(value)
}

function itemIdentity(item: any) {
  return String(item?.id || item?.name || item?.company || item?.organization || item?.school || item?.title || item?.publisher || item?.platform || "").trim()
}

function normalizeSectionItem(key: string, item: any, currentItem: any, index: number) {
  const next = { ...(isObject(currentItem) ? currentItem : {}), ...(isObject(item) ? item : { description: asText(item) }) }
  next.id = next.id || currentItem?.id || `${key}_${Date.now()}_${index}`
  if (key === "skills") {
    next.keywords = splitTags(next.keywords)
    next.description = asText(next.description)
  }
  if (["work", "projects"].includes(key)) {
    next.highlights = normalizeLines(next.highlights)
    next.description = asText(next.description)
  }
  if (key === "education" || key === "awards") next.description = asText(next.description)
  if (key === "projects") next.tech_stack = Array.isArray(next.tech_stack) ? next.tech_stack.join(" / ") : asText(next.tech_stack)
  return next
}

function currentSectionValue(key: string, data: any) {
  if (data?.[key] !== undefined) return data[key]
  return data?.custom_sections?.find((item: any) => item.id === key)
}

function unwrapOptimizedSection(key: string, result: any) {
  let value = result?.optimized_section ?? result
  for (let i = 0; i < 6; i += 1) {
    if (!isObject(value)) break
    if (value.optimized_section !== undefined) {
      value = value.optimized_section
      continue
    }
    if (value.section_content !== undefined) {
      value = value.section_content
      continue
    }
    if (value.resume_data?.[key] !== undefined) {
      value = value.resume_data[key]
      continue
    }
    if (value[key] !== undefined) {
      value = value[key]
      continue
    }
    if (key === "summary" && value.summary !== undefined) {
      value = value.summary
      continue
    }
    break
  }
  return value
}

function normalizeListSection(key: string, value: any, currentValue: any) {
  let items = Array.isArray(value) ? value : []
  if (!items.length && isObject(value) && Array.isArray(value.items)) items = value.items
  if (!items.length && isObject(value) && ["name", "school", "company", "title"].some((field) => value[field])) items = [value]
  const currentItems = Array.isArray(currentValue) ? currentValue : []
  const used = new Set<number>()
  const normalized = items.map((item: any, index: number) => {
    const identity = itemIdentity(item)
    let matchIndex = identity ? currentItems.findIndex((currentItem, currentIndex) => !used.has(currentIndex) && itemIdentity(currentItem) === identity) : -1
    if (matchIndex < 0 && index < currentItems.length && !used.has(index)) matchIndex = index
    if (matchIndex >= 0) used.add(matchIndex)
    return normalizeSectionItem(key, item, matchIndex >= 0 ? currentItems[matchIndex] : {}, index)
  })
  currentItems.forEach((item, index) => {
    if (!used.has(index)) normalized.push(normalizeSectionItem(key, item, item, normalized.length))
  })
  return normalized
}

function normalizeCustomSectionValue(value: any, currentValue: any) {
  const current = isObject(currentValue) ? currentValue : { id: editor.currentSection, title: "自定义模块", items: [] }
  let items: any[] = []
  if (Array.isArray(value)) items = value
  else if (isObject(value) && Array.isArray(value.items)) items = value.items
  else if (isObject(value) && (value.title || value.content || value.description)) items = [value]
  else if (asText(value)) items = [{ title: "", content: asText(value) }]
  if (current.preset_type || (isObject(value) && value.preset_type)) {
    const currentItems = Array.isArray(current.items) ? current.items : []
    const used = new Set<number>()
    return {
      ...current,
      ...(isObject(value) ? value : {}),
      id: current.id,
      title: (isObject(value) && (value.title || value.section_title)) || current.title || "自定义模块",
      preset_type: current.preset_type || (isObject(value) ? value.preset_type : undefined),
      items: items.map((item, index) => {
        const identity = itemIdentity(item)
        let matchIndex = identity ? currentItems.findIndex((currentItem, currentIndex) => !used.has(currentIndex) && itemIdentity(currentItem) === identity) : -1
        if (matchIndex < 0 && index < currentItems.length && !used.has(index)) matchIndex = index
        if (matchIndex >= 0) used.add(matchIndex)
        const currentItem = matchIndex >= 0 && isObject(currentItems[matchIndex]) ? currentItems[matchIndex] : {}
        return {
          ...currentItem,
          ...(isObject(item) ? item : { description: asText(item) }),
          id: item?.id || currentItem.id || `item_${Date.now()}_${index}`,
        }
      }),
    }
  }
  return {
    ...current,
    title: (isObject(value) && (value.title || value.section_title)) || current.title || "自定义模块",
    items: items.map((item, index) => {
      const currentItem = Array.isArray(current.items) && isObject(current.items[index]) ? current.items[index] : {}
      return {
        id: item?.id || currentItem.id || `item_${Date.now()}_${index}`,
        title: asText(item?.title || item?.name || currentItem.title),
        content: asText(item?.content || item?.description || item?.text || currentItem.content),
      }
    }),
  }
}

function normalizeOptimizedSection(key: string, result: any, data: any) {
  const value = unwrapOptimizedSection(key, result)
  const currentValue = currentSectionValue(key, data)
  if (key === "summary") return { ...(isObject(currentValue) ? currentValue : {}), content: asText(isObject(value) && value.content !== undefined ? value.content : value) }
  if (["education", "skills", "work", "projects", "awards"].includes(key)) return normalizeListSection(key, value, currentValue)
  if (currentValue) return normalizeCustomSectionValue(value, currentValue)
  return null
}

async function exportPdf() {
  if (exportLoading.value) return
  exportLoading.value = "pdf"
  try {
    if (!editor.saved) await save({ refreshPreview: false })
    await exportPdfApi(resumeId.value, resumeStore.currentResume?.title || "简历")
  } catch (error: any) {
    showToast(error?.message || "PDF 导出失败", "error")
  } finally {
    exportLoading.value = ""
  }
}

async function exportWord() {
  if (exportLoading.value) return
  exportLoading.value = "word"
  try {
    if (!editor.saved) await save({ refreshPreview: false })
    await exportWordApi(resumeId.value, resumeStore.currentResume?.title || "简历")
  } catch (error: any) {
    showToast(error?.message || "Word 导出失败", "error")
  } finally {
    exportLoading.value = ""
  }
}

async function refreshScore() {
  if (!resumeStore.resumeData) return
  scoreLoading.value = true
  scoreError.value = ""
  scoreStreamText.value = ""
  try {
    score.value = await scoreResumeStreamApi(
      { resume_id: resumeId.value, resume_data: resumeStore.resumeData, target_position: resumeStore.resumeData.basics.title },
      { onDelta: (text) => (scoreStreamText.value += text) },
    )
  } catch (error: any) {
    scoreError.value = error.message === "SILENT_ERROR" ? "" : (error.message || "AI 评分失败")
  } finally {
    isInitiatingScore = false
    scoreLoading.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

function showApplySuccess() {
  applySuccess.value = true
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = setTimeout(() => (applySuccess.value = false), 1800)
}

async function openScorePanel() {
  if (sidePanel.value === "score") {
    sidePanel.value = "none"
    return
  }
  sidePanel.value = "score"
}

async function loadChatMessages() {
  chatError.value = ""
  try {
    chatMessages.value = (await getResumeChatMessagesApi(resumeId.value)) as unknown as any[]
    chatLoaded.value = true
  } catch (error: any) {
    chatError.value = error.message || "对话记录加载失败"
  }
}

async function openChatPanel() {
  if (sidePanel.value === "chat") {
    sidePanel.value = "none"
    return
  }
  sidePanel.value = "chat"
  if (!aiCapabilityLoaded.value) await loadAiCapability()
  if (!chatLoaded.value) await loadChatMessages()
}

async function loadAiCapability() {
  try {
    aiCapability.value = await getAiCapabilityApi()
    const models = aiCapability.value?.chat_models || []
    if (models.length) {
      const currentAvailable = selectedChatModelId.value && models.some((item) => item.id === selectedChatModelId.value)
      if (!currentAvailable) {
        const defaultId = aiCapability.value?.default_chat_model_id
        selectedChatModelId.value = defaultId && models.some((item) => item.id === defaultId) ? defaultId : models[0].id
      } else if (selectedChatModel.value?.id && selectedChatModelId.value !== selectedChatModel.value.id) {
        selectedChatModelId.value = selectedChatModel.value.id
      }
    } else {
      selectedChatModelId.value = null
    }
  } catch {
    aiCapability.value = null
  } finally {
    aiCapabilityLoaded.value = true
  }
}

async function sendChatMessage(content: string, attachments: AiChatAttachment[] = []) {
  if (!resumeStore.currentResume || chatLoading.value) return
  if (!aiCapabilityLoaded.value) await loadAiCapability()
  if (attachments.length && !supportsChatImages.value) {
    chatError.value = "当前选择的模型不支持图片输入，请切换到支持多模态的模型后再发送。"
    return
  }
  flushHistoryCommit()
  chatLoading.value = true
  chatError.value = ""
  const stamp = Date.now()
  const pendingUser = { id: `user-${stamp}`, role: "user", content, attachments }
  const pendingAssistant = { id: `assistant-${stamp}`, role: "assistant", content: "", streaming: true, phase: "replying", phaseText: "正在组织回复" }
  chatMessages.value.push(pendingUser, pendingAssistant)
  const assistantIndex = chatMessages.value.length - 1
  try {
    if (!editor.saved) await save({ refreshPreview: false })
    const response = (await sendResumeChatMessageStreamApi(
      resumeId.value,
      { content, attachments, model_config_id: effectiveChatModelId.value },
      {
        onDelta: (text) => {
          const assistant = chatMessages.value[assistantIndex]
          if (assistant) assistant.content += text
        },
        onPhase: (phase, text) => {
          const assistant = chatMessages.value[assistantIndex]
          if (assistant) Object.assign(assistant, { phase, phaseText: text })
        },
      },
    )) as any
    const savedAssistant = response?.assistant_message
    const assistant = chatMessages.value[assistantIndex]
    if (assistant && savedAssistant) Object.assign(assistant, savedAssistant, { streaming: false })
    else if (assistant) assistant.streaming = false
    if (response?.resolved_message) {
      const resolved = chatMessages.value.find((item) => item.id === response.resolved_message.id)
      if (resolved) Object.assign(resolved, response.resolved_message)
    }
    if (response?.resume_data && resumeStore.currentResume) {
      cancelDebouncedSave()
      await resumeStore.fetchResumeDetail(resumeId.value)
      commitEditorHistory("AI 助手修改")
      editor.setSaved(true)
      showApplySuccess()
    }
    const usage = response?.usage
    if (usage) {
      const points = Number(usage.points_used || 0)
      if (points > 0) {
        showGlobalToast(`本次对话消耗了 ${points} 点 Flow Points`, "success")
      }
    }
    chatLoaded.value = true
  } catch (error: any) {
    const assistant = chatMessages.value[assistantIndex]
    if (assistant) assistant.streaming = false
    if (!assistant?.content) chatMessages.value = chatMessages.value.filter((item) => item.id !== pendingAssistant.id)
    chatError.value = error.message === "SILENT_ERROR" ? "" : (error.message || "AI 对话失败")
  } finally {
    chatLoading.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

async function regenerateChatMessage(message?: any, overrideContent?: string, overrideAttachments?: AiChatAttachment[]) {
  if (!resumeStore.currentResume || chatLoading.value) return
  if (!aiCapabilityLoaded.value) await loadAiCapability()
  let userIndex = -1
  if (message) {
    userIndex = chatMessages.value.findIndex((item) => item.id === message.id)
  } else {
    for (let index = chatMessages.value.length - 1; index >= 0; index -= 1) {
      if (chatMessages.value[index]?.role === "user") {
        userIndex = index
        break
      }
    }
  }
  if (userIndex < 0) return

  const userMessage = chatMessages.value[userIndex]
  if (!userMessage || userMessage.role !== "user") return
  const content = String(overrideContent ?? userMessage.content ?? "").trim()
  const attachments = overrideAttachments ? [...overrideAttachments] : [...(userMessage.attachments || [])]
  if (!content && !attachments.length) return
  if (attachments.length && !supportsChatImages.value) {
    chatError.value = "当前选择的模型不支持图片输入，请切换到支持多模态的模型后再重新生成。"
    return
  }

  const numericId = Number(userMessage.id)
  const hasPersistedMessage = Number.isFinite(numericId) && !String(userMessage.id).startsWith("user-")
  if (!hasPersistedMessage) {
    chatMessages.value = chatMessages.value.slice(0, userIndex)
    chatError.value = ""
    await sendChatMessage(content || "请结合我上传的图片分析简历。", attachments)
    return
  }

  flushHistoryCommit()
  chatLoading.value = true
  chatError.value = ""
  userMessage.content = content || "请结合我上传的图片分析简历。"
  userMessage.attachments = attachments
  chatMessages.value = chatMessages.value.slice(0, userIndex + 1)
  const pendingAssistant = {
    id: `assistant-regenerate-${Date.now()}`,
    role: "assistant",
    content: "",
    streaming: true,
    phase: "understanding_intent",
    phaseText: "正在重新理解这条消息",
  }
  chatMessages.value.push(pendingAssistant)
  const assistantIndex = chatMessages.value.length - 1

  try {
    if (!editor.saved) await save({ refreshPreview: false })
    const response = (await regenerateResumeChatMessageStreamApi(
      resumeId.value,
      numericId,
      { content: content || "请结合我上传的图片分析简历。", attachments, model_config_id: effectiveChatModelId.value },
      {
        onDelta: (text: string) => {
          const assistant = chatMessages.value[assistantIndex]
          if (assistant) assistant.content += text
        },
        onPhase: (phase: string, text: string) => {
          const assistant = chatMessages.value[assistantIndex]
          if (assistant) Object.assign(assistant, { phase, phaseText: text })
        },
      },
    )) as any
    const assistant = chatMessages.value[assistantIndex]
    if (assistant && response?.assistant_message) {
      Object.assign(assistant, response.assistant_message, { streaming: false })
    } else if (assistant) {
      assistant.streaming = false
    }
    if (response?.resolved_message) {
      const resolved = chatMessages.value.find((item) => item.id === response.resolved_message.id)
      if (resolved) Object.assign(resolved, response.resolved_message)
    }
    if (response?.resume_data && resumeStore.currentResume) {
      cancelDebouncedSave()
      await resumeStore.fetchResumeDetail(resumeId.value)
      commitEditorHistory("AI 助手修改")
      editor.setSaved(true)
      showApplySuccess()
    }
    const points = Number(response?.usage?.points_used || 0)
    if (points > 0) {
      showGlobalToast(`本次重新生成消耗了 ${points} 点 Flow Points`, "success")
    }
    chatLoaded.value = true
  } catch (error: any) {
    await loadChatMessages().catch(() => null)
    chatError.value = error.message === "SILENT_ERROR" ? "" : (error.message || "重新发送失败")
  } finally {
    chatLoading.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

async function clearChatMessages() {
  chatError.value = ""
  try {
    await clearResumeChatMessagesApi(resumeId.value)
    chatMessages.value = []
    chatLoaded.value = true
  } catch (error: any) {
    chatError.value = error.message || "清除对话记录失败"
  }
}

async function confirmClearChatMessages() {
  if (chatLoading.value || !chatMessages.value.length) return
  if (window.confirm("确定清除当前简历的 AI 对话记录吗？")) await clearChatMessages()
}

async function optimizeCurrentSection() {
  if (!resumeStore.resumeData) return
  const key = editor.currentSection
  optimizeSectionKey.value = key
  optimizeResult.value = null
  optimizeLoading.value = true
  optimizeError.value = ""
  optimizeStreamText.value = ""
  try {
    optimizeResult.value = await optimizeSectionStreamApi(
      {
        resume_id: resumeId.value,
        section_type: key,
        section_title: resumeStore.resumeData.layout.section_titles[key],
        section_content: currentSectionValue(key, resumeStore.resumeData),
        full_resume_data: resumeStore.resumeData,
        target_position: resumeStore.resumeData.basics.title,
      },
      { onDelta: (text) => (optimizeStreamText.value += text) },
    )
  } catch (error: any) {
    optimizeResult.value = null
    optimizeError.value = error.message === "SILENT_ERROR" ? "" : (error.message || "模块优化失败")
  } finally {
    isInitiatingOptimize = false
    optimizeLoading.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

function clearSectionOptimizeResult() {
  optimizeResult.value = null
  optimizeError.value = ""
  optimizeStreamText.value = ""
  if (!optimizeLoading.value) optimizeSectionKey.value = ""
}

async function optimizeJd(jd: string) {
  if (!resumeStore.resumeData) return
  jdLoading.value = true
  jdError.value = ""
  jdStreamText.value = ""
  sidePanel.value = "jd"
  try {
    jdResult.value = await optimizeByJdStreamApi(
      { resume_id: resumeId.value, resume_data: resumeStore.resumeData, job_description: jd },
      { onDelta: (text) => (jdStreamText.value += text) },
    )
  } catch (error: any) {
    jdError.value = error.message === "SILENT_ERROR" ? "" : (error.message || "JD 优化失败")
  } finally {
    isInitiatingJd = false
    jdLoading.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

async function translateResume(targetLanguage: "zh-CN" | "en") {
  if (!resumeStore.currentResume || !resumeStore.resumeData) return
  translationLoading.value = true
  translationError.value = ""
  translationStreamText.value = ""
  translationResult.value = null
  sidePanel.value = "translate"
  try {
    translationResult.value = await translateResumeStreamApi(
      {
        resume_id: resumeId.value,
        resume_data: resumeStore.resumeData,
        current_language: resumeStore.currentResume.language,
        target_language: targetLanguage,
      },
      { onDelta: (text) => (translationStreamText.value += text) },
    )
  } catch (error: any) {
    translationError.value = error.message === "SILENT_ERROR" ? "" : (error.message || "简历翻译失败")
  } finally {
    isInitiatingTranslation = false
    translationLoading.value = false
    getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
  }
}

function clearTranslationResult() {
  translationResult.value = null
  translationError.value = ""
  translationStreamText.value = ""
}

function returnToContentEditor() {
  mainMode.value = "edit"
  mobileTab.value = "edit"
  sidePanel.value = "none"
}

async function applyTranslationResult(result: any) {
  if (!resumeStore.currentResume || !result?.translated_resume_data) return
  flushHistoryCommit()
  const targetLanguage = normalizeResumeLanguage(result.target_language)
  resumeStore.currentResume.language = targetLanguage
  resumeStore.currentResume.resume_data = normalizeResumeData(result.translated_resume_data, targetLanguage)
  resumeStore.currentResume.resume_data.layout.language_locked = true
  commitEditorHistory("应用简历翻译")
  await save()
  clearTranslationResult()
  returnToContentEditor()
  showApplySuccess()
}

function mergeOptimizedResumeData(currentData: any, optimizedData: any) {
  const rawData = optimizedData?.resume_data && typeof optimizedData.resume_data === "object" ? optimizedData.resume_data : optimizedData
  const mergedData = { ...(rawData || {}) }
  const currentLayout = currentData?.layout || {}
  const optimizedLayout = mergedData.layout || {}
  const currentTitles = currentLayout.section_titles && typeof currentLayout.section_titles === "object" ? currentLayout.section_titles : {}
  const optimizedTitles = optimizedLayout.section_titles && typeof optimizedLayout.section_titles === "object" ? optimizedLayout.section_titles : {}
  const sectionTitles = { ...currentTitles }
  for (const [key, title] of Object.entries(optimizedTitles)) {
    if (typeof title === "string" && title && title !== key) sectionTitles[key] = title
  }
  mergedData.layout = {
    ...optimizedLayout,
    section_order: Array.isArray(optimizedLayout.section_order) && optimizedLayout.section_order.length ? optimizedLayout.section_order : currentLayout.section_order,
    hidden_sections: Array.isArray(optimizedLayout.hidden_sections) ? optimizedLayout.hidden_sections : currentLayout.hidden_sections,
    field_labels: optimizedLayout.field_labels && typeof optimizedLayout.field_labels === "object" ? optimizedLayout.field_labels : currentLayout.field_labels,
    section_titles: sectionTitles,
  }
  return normalizeResumeData(mergedData, resumeStore.currentResume?.language)
}

async function applyOptimizeResult(targetResult?: any) {
  if (!resumeStore.currentResume) return
  const result = targetResult || optimizeResult.value
  if (!result) return
  flushHistoryCommit()
  if (result.optimized_resume_data) {
    resumeStore.currentResume.resume_data = mergeOptimizedResumeData(resumeStore.currentResume.resume_data, result.optimized_resume_data)
  }
  if (result.optimized_section) {
    const key = editor.currentSection
    if ((resumeStore.currentResume.resume_data as any)[key] !== undefined) (resumeStore.currentResume.resume_data as any)[key] = result.optimized_section
    else {
      const custom = resumeStore.currentResume.resume_data.custom_sections.find((item) => item.id === key)
      if (custom) Object.assign(custom, result.optimized_section)
    }
    resumeStore.currentResume.resume_data = normalizeResumeData(resumeStore.currentResume.resume_data, resumeStore.currentResume.language)
  }
  if (!resumeStore.currentResume.resume_data.layout.section_order.includes(editor.currentSection)) editor.setCurrentSection("basics")
  commitEditorHistory(result === jdResult.value ? "采纳 JD 优化" : "采纳 AI 优化")
  await save()
  if (aiWorkbenchOpen.value) returnToContentEditor()
  showApplySuccess()
}

async function applySectionOptimizeResult() {
  if (!resumeStore.currentResume || !resumeStore.resumeData) return
  flushHistoryCommit()
  const key = optimizeSectionKey.value || editor.currentSection
  const nextSection = normalizeOptimizedSection(key, optimizeResult.value, resumeStore.resumeData)
  if (!nextSection) return
  if ((resumeStore.currentResume.resume_data as any)[key] !== undefined) {
    ;(resumeStore.currentResume.resume_data as any)[key] = nextSection
  } else {
    const custom = resumeStore.currentResume.resume_data.custom_sections.find((item) => item.id === key)
    if (custom && isObject(nextSection)) Object.assign(custom, nextSection)
  }
  resumeStore.currentResume.resume_data = normalizeResumeData(resumeStore.currentResume.resume_data, resumeStore.currentResume.language)
  editor.setCurrentSection(key)
  commitEditorHistory(`润色${resumeStore.resumeData.layout.section_titles[key] || "当前模块"}`)
  clearSectionOptimizeResult()
  await save()
}

async function resolveChatDecision(message: any, action: "apply" | "reject") {
  if (!resumeStore.currentResume || !message?.id || chatDecisionLoadingId.value !== null) return
  if (action === "apply") flushHistoryCommit()
  const previousStatus = message.action_status || "pending"
  chatDecisionLoadingId.value = message.id
  message.action_status = "applying"
  chatError.value = ""
  try {
    const response = (await decideResumeChatChangeApi(resumeId.value, Number(message.id), action)) as any
    if (response?.assistant_message) Object.assign(message, response.assistant_message)
    if (action === "apply" && response?.resume_data) {
      cancelDebouncedSave()
      await resumeStore.fetchResumeDetail(resumeId.value)
      commitEditorHistory("AI 助手修改")
      editor.setSaved(true)
      if (!resumeStore.resumeData?.layout.section_order.includes(editor.currentSection)) editor.setCurrentSection("basics")
      showApplySuccess()
    }
  } catch (error: any) {
    message.action_status = previousStatus
    chatError.value = error.message || (action === "apply" ? "修改写入失败" : "取消修改失败")
  } finally {
    chatDecisionLoadingId.value = null
  }
}

function openStylePanel() {
  if (showStyle.value) {
    showStyle.value = false
    return
  }
  showStyle.value = true
  showTemplateModal.value = false
}

function openJdPanel() {
  if (sidePanel.value === "jd") {
    sidePanel.value = "none"
    return
  }
  sidePanel.value = "jd"
}

function closeSidePanel() {
  sidePanel.value = "none"
}

const sidePanelTitle = computed(() => {
  if (sidePanel.value === "style") return "样式设置"
  if (sidePanel.value === "jd") return "岗位描述(JD)匹配优化"
  if (sidePanel.value === "translate") return "简历翻译"
  if (sidePanel.value === "chat") return "AI 简历助手"
  return "AI 简历诊断"
})

// ========================
// Flow Points Confirmation Logic
// ========================
const pointConfirmOpen = ref(false)
const pointConfirmFeature = ref<"resume_score" | "jd_optimize" | "resume_translate" | "section_optimize">("resume_score")
const pointConfirmCallback = ref<(() => void) | null>(null)

const pointConfirmTitle = computed(() => {
  if (pointConfirmFeature.value === "resume_score") return "智能诊断"
  if (pointConfirmFeature.value === "jd_optimize") return "JD 优化"
  if (pointConfirmFeature.value === "resume_translate") return "简历翻译"
  return "模块优化"
})

const pointConfirmDescription = computed(() => {
  if (!flowPointSummary.value) return "正在获取点数信息..."
  const rule = flowPointSummary.value.rules.find(r => r.feature_type === pointConfirmFeature.value)
  if (!rule) return "本次消耗未知"
  
  let costText = `${rule.points_per_call} 点`
  const inputRate = rule.points_per_million_input_tokens ?? rule.points_per_million_tokens ?? 0
  const outputRate = rule.points_per_million_output_tokens ?? rule.points_per_million_tokens ?? 0
  if (inputRate > 0) {
    costText += ` + 输入 ${inputRate} 点/百万Tokens`
  }
  if (outputRate > 0) {
    costText += ` + 输出 ${outputRate} 点/百万Tokens`
  }
  return `预计消耗：${costText}（当前余额：${flowPointSummary.value.balance} 点）`
})

function requestFeatureWithPoints(feature: "resume_score" | "jd_optimize" | "resume_translate" | "section_optimize", callback: () => void) {
  pointConfirmFeature.value = feature
  pointConfirmCallback.value = callback
  pointConfirmOpen.value = true
  getFlowPointSummaryApi().then((data) => (flowPointSummary.value = data)).catch(() => null)
}

function handlePointConfirm() {
  pointConfirmOpen.value = false
  if (pointConfirmCallback.value) {
    pointConfirmCallback.value()
    pointConfirmCallback.value = null
  }
}

function handleFocusOut(event: Event) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    setTimeout(() => {
      if (!editor.saved) {
        cancelDebouncedSave()
        void save().catch(() => undefined)
      }
    }, 50)
  }
}
</script>

<template>
  <div v-if="resumeStore.currentResume && resumeStore.resumeData && resumeStore.templateConfig" class="fixed inset-0 flex flex-col overflow-hidden bg-zinc-100/60" @focusout="handleFocusOut">
    <!-- Premium Header -->
    <header class="flex h-14 md:h-16 shrink-0 items-center gap-1.5 md:gap-4 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md px-2 md:px-6 relative z-40">
      <Button size="icon" variant="ghost" class="h-8 w-8 md:h-10 md:w-10 shrink-0 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100" @click="router.push('/resumes')">
        <ArrowLeft class="h-4 w-4 md:h-5 md:w-5" />
      </Button>
      
      <div class="h-8 w-[1px] bg-zinc-200 hidden sm:block"></div>
      
      <div class="flex items-center gap-1.5 md:gap-3 flex-1 min-w-0">
        <div class="group relative inline-grid items-center min-w-[40px] max-w-[140px] sm:max-w-[400px]">
          <span class="col-start-1 row-start-1 invisible whitespace-pre pl-1 md:pl-2 pr-6 md:pr-8 py-1 border border-transparent text-[14px] sm:text-[18px] font-semibold tracking-tight overflow-hidden">{{ resumeStore.currentResume.title || '无标题简历' }}</span>
          <input 
            v-model="resumeStore.currentResume.title" 
            placeholder="无标题简历"
            size="1"
            class="peer col-start-1 row-start-1 w-full min-w-0 border border-transparent bg-transparent pl-1 pr-6 md:pl-2 md:pr-8 py-1 text-[14px] sm:text-[18px] font-semibold tracking-tight text-zinc-900 shadow-none hover:border-zinc-200 hover:bg-zinc-50 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all outline-none rounded-md truncate"
            @input="markChanged" 
          />
          <Pencil class="absolute right-1.5 md:right-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none opacity-40 transition-opacity group-hover:opacity-100 peer-focus:opacity-0" />
        </div>
        <div class="flex shrink-0 items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-medium transition-colors whitespace-nowrap" :class="editor.saving ? 'text-amber-500' : editor.saveError ? 'text-red-500' : 'text-zinc-500'">
          <Save v-if="editor.saving" class="h-3 w-3 md:h-3.5 md:w-3.5 animate-pulse shrink-0" /> 
          <CheckCircle2 v-else class="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" :class="editor.saveError ? 'text-red-500' : 'text-emerald-500'" />
          <span class="hidden sm:inline">{{ editor.saving ? '保存中...' : editor.saveError ? '保存失败' : '已自动保存' }}</span>
        </div>
      </div>
      
      <!-- 极简撤销恢复按钮组与操作区 -->
      <div class="ml-auto flex items-center gap-1 md:gap-2.5 shrink-0">
        <div class="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            class="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent"
            :disabled="editor.applyingHistory || !editor.canUndo"
            :title="editor.canUndo ? `撤销：${editor.undoLabel}` : '没有可撤销的操作'"
            aria-label="撤销上一步操作"
            @click="undoLastChange"
          >
            <Undo2 class="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            class="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent"
            :disabled="editor.applyingHistory || !editor.canRedo"
            :title="editor.canRedo ? `恢复：${editor.redoLabel}` : '没有可恢复的操作'"
            aria-label="恢复上一步操作"
            @click="redoLastChange"
          >
            <Redo2 class="h-4 w-4" />
          </Button>
        </div>

        <div class="h-6 w-[1px] bg-zinc-200 hidden md:block mx-0.5 md:mx-1"></div>

        <!-- Flow Points 账户余额展示（移动至右侧主功能区，支持点击保存并跳转） -->
        <div 
          v-if="flowPointSummary" 
          class="hidden md:flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm cursor-pointer hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95"
          title="点击保存并前往 Flow Points 兑换页"
          @click="saveAndGoToAiRecords"
        >
          <FlowPointIcon class="h-4 w-4 text-zinc-700" />
          <span>{{ flowPointSummary.balance }}</span>
        </div>

        <div class="h-6 w-[1px] bg-zinc-200 hidden md:block mx-0.5 md:mx-1"></div>

        <!-- Desktop Action Buttons -->
        <div class="hidden md:flex items-center gap-2">
          <Button size="sm" variant="outline" class="shrink-0 h-10 px-3.5 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 rounded-lg shadow-sm font-medium text-sm flex items-center justify-center" @click="openTemplateModal" title="更换模板">
            <LayoutTemplate class="h-4 w-4 shrink-0 mr-1.5" /> <span>模板</span>
          </Button>
          <Button size="sm" variant="outline" class="shrink-0 h-10 px-3.5 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 rounded-lg shadow-sm font-medium text-sm flex items-center justify-center" @click="openStylePanel" title="主题设置">
            <Settings class="h-4 w-4 shrink-0 mr-1.5" /> <span>设置</span>
          </Button>
          <Button size="sm" variant="outline" class="shrink-0 h-10 px-3.5 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 rounded-lg shadow-sm font-medium text-sm flex items-center justify-center" @click="openShareDialog" title="分享简历">
            <Share2 class="h-4 w-4 shrink-0 mr-1.5" /> <span>分享</span>
          </Button>
          <Button v-if="false" size="sm" variant="outline" class="!hidden md:!inline-flex shrink-0 h-10 px-4 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 rounded-lg shadow-sm font-medium" :disabled="!!exportLoading" @click="exportWord">
            <FileText class="h-4 w-4 shrink-0 mr-1.5" /> Word
          </Button>
          <Button size="sm" class="shrink-0 h-10 px-5 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg shadow-md active:scale-95 transition-all font-medium text-sm whitespace-nowrap flex items-center justify-center" :disabled="!!exportLoading" @click="exportPdf">
            <Download class="h-4 w-4 shrink-0 mr-1.5" /> 导出
          </Button>
        </div>

        <!-- Mobile Hamburger Button -->
        <button 
          @click="toggleMobileMenu" 
          class="md:hidden p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 focus:outline-none transition-colors"
          aria-label="Toggle Mobile Menu"
        >
          <Menu v-if="!mobileMenuOpen && !showStyle && !showTemplateModal" class="h-5 w-5" />
          <X v-else class="h-5 w-5" />
        </button>
      </div>

      <!-- Mobile Dropdown Menu -->
      <Transition name="modal-fade">
        <div v-if="mobileMenuOpen" class="md:hidden absolute top-[calc(100%-4px)] right-2 w-36 border border-zinc-200/80 rounded-2xl bg-white/95 backdrop-blur-xl p-2 space-y-1 shadow-2xl z-50">
          <div v-if="flowPointSummary" class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-zinc-100/70 text-zinc-700 text-xs font-medium mb-1 cursor-pointer hover:bg-zinc-200/50 transition-colors" @click="saveAndGoToAiRecords">
            <div class="flex items-center gap-1.5">
              <FlowPointIcon class="h-3.5 w-3.5 text-zinc-600" />
              <span>余额</span>
            </div>
            <span class="font-semibold text-zinc-900">{{ flowPointSummary.balance }}</span>
          </div>
          <button 
            class="flex items-center w-full gap-2 px-2.5 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-xs font-medium"
            @click="mobileMenuOpen = false; openTemplateModal()"
          >
            <LayoutTemplate class="h-3.5 w-3.5 text-zinc-500" />
            <span>模板</span>
          </button>
          <button 
            class="flex items-center w-full gap-2 px-2.5 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-xs font-medium"
            @click="mobileMenuOpen = false; openStylePanel()"
          >
            <Settings class="h-4 w-4 text-zinc-500" />
            <span>设置</span>
          </button>
          <button
            class="flex items-center w-full gap-2 px-2.5 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors text-xs font-medium"
            @click="openShareDialog"
          >
            <Share2 class="h-4 w-4 text-zinc-500" />
            <span>分享</span>
          </button>
          <button 
            class="flex items-center w-full gap-2 px-2.5 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors text-xs font-medium"
            @click="triggerDelete"
          >
            <Trash2 class="h-4 w-4 text-red-500" />
            <span>删除</span>
          </button>
          <button 
            class="flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-95 text-xs font-medium shadow-sm mt-2"
            :disabled="!!exportLoading"
            @click="mobileMenuOpen = false; exportPdf()"
          >
            <Download class="h-4 w-4 text-zinc-400" />
            <span>导出 PDF</span>
          </button>
        </div>
      </Transition>
    </header>

    <!-- Main Workspace -->
    <div class="relative flex min-h-0 flex-1 overflow-hidden pb-0">
      <div class="workspace-surface flex min-w-0 flex-1">
        <!-- Left Unified Sidebar -->
        <!-- Left Unified Sidebar -->
        <div :class="['flex-col h-full shrink-0 bg-white overflow-hidden transition-none relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]', (mobileTab === 'edit' || mobileTab === 'ai') ? 'flex w-full' : 'hidden md:flex']" :style="{ width: isMobile ? '100%' : leftPanelWidth + 'px' }">
          
          <!-- Mode Switcher -->
          <div class="hidden md:flex shrink-0 border-b border-zinc-200/50 p-1.5 md:p-2.5 bg-zinc-50/80 justify-center w-full z-10 relative">
             <div class="flex w-full bg-zinc-200/50 p-1 rounded-lg md:rounded-xl shadow-inner border border-zinc-200/80">
                <button 
                  class="relative flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-1 md:py-1.5 rounded-md md:rounded-lg text-xs md:text-[14px] font-medium transition-all duration-300"
                  :class="mainMode === 'edit' ? 'text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'"
                  @click="mainMode = 'edit'"
                >
                  <div v-if="mainMode === 'edit'" class="absolute inset-0 bg-white rounded-md md:rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)]"></div>
                  <Edit3 class="relative z-10 w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span class="relative z-10">内容编辑</span>
                </button>
                <button 
                  class="relative flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-1 md:py-1.5 rounded-md md:rounded-lg text-xs md:text-[14px] font-medium transition-all duration-300"
                  :class="mainMode === 'ai' ? 'text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'"
                  @click="mainMode = 'ai'; if(sidePanel === 'none') sidePanel = 'chat'"
                >
                  <div v-if="mainMode === 'ai'" class="absolute inset-0 bg-white rounded-md md:rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-blue-100/50"></div>
                  <FlowAgentIcon class="relative z-10 w-3.5 h-3.5 md:w-4 md:h-4" :class="mainMode === 'ai' ? 'text-blue-500' : ''" />
                  <span class="relative z-10 font-bold tracking-tight">Flow Agent</span>
                </button>
             </div>
          </div>

          <!-- Traditional Edit Mode -->
          <div v-show="mainMode === 'edit'" class="flex flex-col flex-1 min-h-0 overflow-hidden relative bg-zinc-50/30">
            <ModuleSidebar 
              class="w-full shrink-0 relative z-20 shadow-[0_4px_12px_rgba(0,0,0,0.02)]" 
              :data="resumeStore.resumeData" 
              :current="editor.currentSection" 
              @select="selectSection" 
              @change="markChanged" 
              @add-custom="addCustomSection" 
              @remove-custom="removeCustomSection" 
              @optimize="() => requestFeatureWithPoints('section_optimize', optimizeCurrentSection)" 
            />

            <ResumeFormPanel
              class="relative z-10 flex-1 min-h-0 min-w-0"
              :data="resumeStore.resumeData"
              :config="resumeStore.templateConfig"
              :current="editor.currentSection"
              :language="resumeStore.currentResume.language"
              :show-style="false"
              :optimize-result="activeOptimizeResult"
              :optimize-preview="activeOptimizePreview"
              :optimize-loading="activeOptimizeLoading"
              :optimize-error="activeOptimizeError"
              :optimize-stream-text="activeOptimizeStreamText"
              :is-wide="isWide"
              @change="markChanged"
              @optimize="() => requestFeatureWithPoints('section_optimize', optimizeCurrentSection)"
              @apply-optimize="applySectionOptimizeResult"
              @clear-optimize="clearSectionOptimizeResult"
            />
          </div>

          <!-- AI Workbench Mode -->
          <div v-show="mainMode === 'ai'" class="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
            <header class="relative shrink-0 border-b border-zinc-200/60 bg-white flex flex-col z-10">
              <nav class="flex items-center overflow-x-auto overflow-y-hidden px-2 md:px-4 py-2.5 md:py-3 gap-1 md:gap-2 w-full scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button class="flex-1 flex items-center justify-center gap-1 md:gap-1.5 h-8 md:h-9 rounded-full px-1.5 sm:px-2 md:px-4 text-[11px] sm:text-xs md:text-[14px] font-medium transition-all duration-300 border select-none" :class="sidePanel === 'chat' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm'" @click="switchTab('chat')">
                  <Bot class="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" /> <span class="whitespace-nowrap">AI 助手</span>
                </button>
                <button class="flex-1 flex items-center justify-center gap-1 md:gap-1.5 h-8 md:h-9 rounded-full px-1.5 sm:px-2 md:px-4 text-[11px] sm:text-xs md:text-[14px] font-medium transition-all duration-300 border select-none" :class="sidePanel === 'score' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm'" @click="switchTab('score')">
                  <ScanLine class="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" /> <span class="whitespace-nowrap">简历诊断</span>
                </button>
                <button class="flex-1 flex items-center justify-center gap-1 md:gap-1.5 h-8 md:h-9 rounded-full px-1.5 sm:px-2 md:px-4 text-[11px] sm:text-xs md:text-[14px] font-medium transition-all duration-300 border select-none" :class="sidePanel === 'jd' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm'" @click="switchTab('jd')">
                  <FileSearch class="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" /> <span class="whitespace-nowrap">JD 优化</span>
                </button>
                <button class="flex-1 flex items-center justify-center gap-1 md:gap-1.5 h-8 md:h-9 rounded-full px-1.5 sm:px-2 md:px-4 text-[11px] sm:text-xs md:text-[14px] font-medium transition-all duration-300 border select-none" :class="sidePanel === 'translate' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm'" @click="switchTab('translate')">
                  <Languages class="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" /> <span class="whitespace-nowrap">简历翻译</span>
                </button>
              </nav>
            </header>

            <div class="relative min-h-0 flex-1 overflow-hidden p-0 md:p-0">
                <ResumeAiChatPanel v-if="sidePanel === 'chat'" key="chat" v-model:selected-model-id="selectedChatModelId" :chat-models="chatModels" :messages="chatMessages" :loading="chatLoading" :error="chatError" :decision-loading-id="chatDecisionLoadingId" :active="mainMode === 'ai' && sidePanel === 'chat'" :supports-multimodal="supportsChatImages" @send="sendChatMessage" @regenerate="regenerateChatMessage" @clear="clearChatMessages" @confirm="resolveChatDecision($event, 'apply')" @reject="resolveChatDecision($event, 'reject')" />
              <ResumeScorePanel v-else-if="sidePanel === 'score'" key="score" :score="score" :loading="scoreLoading" :error="scoreError" :stream-text="scoreStreamText" :is-wide="isWide" @refresh="() => requestFeatureWithPoints('resume_score', refreshScore)" />
              <JdOptimizeModal v-else-if="sidePanel === 'jd'" key="jd" v-model="jdText" :result="jdResult" :loading="jdLoading" :error="jdError" :stream-text="jdStreamText" :current-data="resumeStore.resumeData" :is-wide="isWide" @optimize="(jd) => requestFeatureWithPoints('jd_optimize', () => optimizeJd(jd))" @apply="applyOptimizeResult({ optimized_resume_data: $event })" @clear="jdResult = null; jdError = ''; jdStreamText = ''" />
              <ResumeTranslatePanel
                v-else-if="sidePanel === 'translate'"
                key="translate"
                :current-language="resumeStore.currentResume.language"
                :result="translationResult"
                :loading="translationLoading"
                :error="translationError"
                :stream-text="translationStreamText"
                @translate="(target) => requestFeatureWithPoints('resume_translate', () => translateResume(target))"
                @apply="applyTranslationResult"
                @clear="clearTranslationResult"
              />
            </div>
          </div>
        </div>

        <!-- Resizer Handle -->
        <div
          v-if="!isMobile"
          class="relative z-30 w-4 -ml-2 h-full cursor-col-resize flex items-center justify-center group"
          @mousedown="startResize"
        >
           <!-- Subtle hover line -->
           <div class="absolute inset-y-0 left-1/2 -ml-[0.5px] w-[1px] bg-blue-500 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300 delay-75"></div>
           
           <!-- Drag pill -->
           <div class="relative z-10 flex h-8 w-1 rounded-full bg-zinc-300 shadow-sm ring-1 ring-black/5 group-hover:bg-blue-500 group-active:bg-blue-600 transition-all duration-300 group-hover:scale-125"></div>
        </div>

        <!-- Preview Canvas -->
        <div :class="['relative flex-1 bg-zinc-100/50 flex-col overflow-hidden', mobileTab === 'preview' ? 'flex' : 'hidden md:flex']">
          <A4Preview class="flex-1" :html="resumeStore.previewHtml" :scale="editor.previewScale" @zoom-in="editor.setPreviewScale(Math.min(1, editor.previewScale + 0.05))" @zoom-out="editor.setPreviewScale(Math.max(0.45, editor.previewScale - 0.05))" />
          <div v-if="previewRefreshing" class="pointer-events-none absolute right-5 top-16 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-500 shadow-sm backdrop-blur">
            预览更新中
          </div>
        </div>
      </div>

      <!-- Backdrop for closing side panels when clicking outside -->
      <Transition name="fade">
        <div v-if="showStyle || showTemplateModal" class="absolute inset-0 z-[55] bg-transparent" @click="showStyle = false; showTemplateModal = false"></div>
      </Transition>

      <!-- Style remains a focused utility drawer. -->
      <Transition name="slide-panel">
        <aside v-if="showStyle" class="absolute bottom-0 right-0 top-0 z-[60] flex w-full flex-col border-l border-zinc-200/80 bg-white/95 backdrop-blur-2xl shadow-2xl md:w-[420px]">
          <div class="shrink-0 border-b border-zinc-100/80 px-4 py-2 md:px-5 md:py-3.5 bg-white/50">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base md:text-lg font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
                <Settings class="w-4 h-4 md:w-5 md:h-5 text-zinc-700"/> 设置
              </h2>
              <Button size="icon" variant="ghost" class="!hidden md:!inline-flex text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-full h-8 w-8 transition-colors" @click="showStyle = false">
                <X class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-6 thin-scrollbar bg-white/40">
            <section class="mb-8">
              <div class="mb-3 flex items-center gap-1.5 relative group">
                <h3 class="text-[14px] font-semibold text-zinc-900">简历语言</h3>
                <Info class="h-4 w-4 text-zinc-400 cursor-help transition-colors group-hover:text-zinc-600" />
                <div class="pointer-events-none absolute left-0 top-full mt-1.5 w-[280px] origin-top-left scale-95 rounded-[12px] bg-zinc-800 p-3 text-[13px] leading-relaxed text-zinc-100 opacity-0 shadow-xl transition-all duration-200 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 z-50">
                  切换语言会更新默认模块标题、字段标签和导出语言；已填写正文、手动修改或 AI 生成的标题不会被覆盖。
                </div>
              </div>
              <div class="grid grid-cols-2 gap-1.5 rounded-[10px] bg-zinc-100/80 p-1 ring-1 ring-zinc-200/50">
                <button
                  class="h-9 rounded-lg text-sm font-medium transition"
                  :class="normalizeResumeLanguage(resumeStore.currentResume.language) === 'zh-CN' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'"
                  @click="setResumeLanguage('zh-CN')"
                >
                  简体中文
                </button>
                <button
                  class="h-9 rounded-lg text-sm font-medium transition"
                  :class="normalizeResumeLanguage(resumeStore.currentResume.language) === 'en' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'"
                  @click="setResumeLanguage('en')"
                >
                  English
                </button>
              </div>
            </section>
            <StyleConfigPanel :config="resumeStore.templateConfig" @change="markChanged" @reset-default="resetStyleChanged" />
          </div>
        </aside>
      </Transition>

      <Transition name="apply-success">
        <div v-if="applySuccess" class="pointer-events-none absolute inset-0 z-[64] flex items-center justify-center overflow-hidden">
          <div class="apply-success-ring absolute h-72 w-72 rounded-full border border-blue-400/40"></div>
          <div class="apply-success-ring apply-success-ring--delay absolute h-72 w-72 rounded-full border border-blue-400/30"></div>
          <div class="relative flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white"><CheckCircle2 class="h-5 w-5" /></span>
            <div><div class="text-sm font-semibold text-zinc-950">修改已写入简历</div><div class="mt-0.5 text-xs text-zinc-500">预览已同步更新</div></div>
          </div>
        </div>
      </Transition>

      <!-- Template Selection Side Panel (Consistent with Style Panel) -->
      <Transition name="slide-panel">
        <aside v-if="showTemplateModal" class="absolute bottom-0 right-0 top-0 z-[60] flex w-full flex-col border-l border-zinc-200/80 bg-white/95 backdrop-blur-2xl shadow-2xl md:w-[420px]">
          <div class="shrink-0 border-b border-zinc-100/80 px-4 py-2 md:px-5 md:py-3.5 bg-white/50">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base md:text-lg font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
                <LayoutTemplate class="w-4 h-4 md:w-5 md:h-5 text-zinc-700"/> 选择模板
              </h2>
              <Button size="icon" variant="ghost" class="!hidden md:!inline-flex text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-full h-8 w-8 transition-colors" @click="showTemplateModal = false">
                <X class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 thin-scrollbar bg-white/40">
            <div class="grid grid-cols-2 gap-3.5">
              <article v-for="item in templates" :key="item.template_id" 
                       class="group flex flex-col rounded-xl border border-zinc-200/60 bg-white p-2.5 sm:p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-zinc-300 cursor-pointer"
                       @click="selectTemplate(item.template_id)">
                <div class="relative w-full aspect-[4/3] overflow-hidden rounded-md bg-white border border-zinc-100 transition-transform duration-300 group-hover:scale-[1.02] shadow-sm">
                  <div class="absolute inset-x-0 top-0">
                    <TemplatePreview :html="item.preview_html" />
                  </div>
                  <div class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                </div>
                <div class="mt-2.5 sm:mt-3 flex flex-col gap-0.5 sm:gap-1 flex-1">
                  <h3 class="font-medium text-zinc-900 text-xs sm:text-sm truncate">{{ item.name }}</h3>
                  <p class="text-[10px] sm:text-xs text-zinc-500">{{ item.category }}适用</p>
                </div>
                <div class="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold"
                     :class="resumeStore.currentResume?.template_id === item.template_id ? 'text-zinc-400' : 'text-zinc-900'">
                  <span>{{ resumeStore.currentResume?.template_id === item.template_id ? '当前使用' : '立即应用' }}</span>
                  <CheckCircle2 v-if="resumeStore.currentResume?.template_id === item.template_id" class="h-3 sm:h-3.5 w-3 sm:w-3.5 shrink-0 text-zinc-400" />
                  <ArrowRight v-else class="h-3 sm:h-3.5 w-3 sm:w-3.5 transition-transform group-hover:translate-x-1 shrink-0" />
                </div>
              </article>
            </div>
          </div>
        </aside>
      </Transition>
    </div>

    <!-- Toast Notification -->
    <Teleport to="body">
      <Transition name="toast-slide">
        <div v-if="toastMessage" class="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex w-max max-w-[90vw] items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white shadow-xl border border-zinc-800">
          <CheckCircle2 v-if="toastType === 'success'" class="h-4 w-4 shrink-0 text-emerald-400" />
          <AlertCircle v-else-if="toastType === 'error'" class="h-4 w-4 shrink-0 text-red-400" />
          <span class="break-words">{{ toastMessage }}</span>
        </div>
      </Transition>
    </Teleport>

    <Transition name="export-fade">
      <div v-if="exportLoading" class="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/45 px-6 backdrop-blur-sm">
        <div class="w-full max-w-[320px] rounded-2xl border border-white/20 bg-white px-6 py-7 text-center shadow-2xl">
          <LoaderCircle class="mx-auto h-10 w-10 animate-spin text-zinc-900" />
          <h3 class="mt-4 text-base font-semibold text-zinc-900">
            {{ exportLoading === 'pdf' ? '正在导出 PDF' : '正在导出 Word' }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-zinc-500">
            正在生成文件，请勿关闭页面。
          </p>
        </div>
      </div>
    </Transition>

    <!-- Mobile Bottom Nav (Apple Liquid Glass Navigation Pod) -->
    <div class="md:hidden fixed bottom-2.5 left-1/2 -translate-x-1/2 z-50 max-w-[260px] w-[82%] bg-white/55 backdrop-blur-3xl border border-white/80 rounded-full p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),_0_8px_32px_-6px_rgba(0,0,0,0.14)] select-none">
      <div class="relative w-full flex items-center justify-between">
        <!-- Gliding Active Indicator Pill -->
        <div 
          class="absolute top-0 bottom-0 w-1/3 bg-white rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12),_inset_0_1px_1px_rgba(255,255,255,1)] transition-transform duration-300 ease-out pointer-events-none"
          :class="{
            'translate-x-0': mobileTab === 'edit',
            'translate-x-[100%]': mobileTab === 'ai',
            'translate-x-[200%]': mobileTab === 'preview'
          }"
        ></div>

        <!-- Edit Tab -->
        <button class="relative z-10 flex items-center justify-center flex-1 h-[34px] gap-1 group active:scale-95 transition-all duration-300 rounded-full bg-transparent" :class="mobileTab === 'edit' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'" @click="mobileTab = 'edit'; mainMode = 'edit'">
          <Edit3 class="w-3.5 h-3.5 transition-transform duration-300" :class="mobileTab === 'edit' ? 'stroke-[2.2]' : ''" />
          <span class="text-[12px] tracking-tight transition-all duration-300" :class="mobileTab === 'edit' ? 'font-semibold' : 'font-medium'">编辑</span>
        </button>

        <!-- Flow Agent AI Tab -->
        <button class="relative z-10 flex items-center justify-center flex-1 h-[34px] gap-1 group active:scale-95 transition-all duration-300 rounded-full bg-transparent" :class="mobileTab === 'ai' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'" @click="mobileTab = 'ai'; mainMode = 'ai'; if(sidePanel === 'none') sidePanel = 'chat'">
          <FlowAgentIcon class="w-3.5 h-3.5 transition-all duration-300" :class="mobileTab === 'ai' ? 'text-blue-600' : ''" />
          <span class="text-[12px] tracking-tight transition-all duration-300" :class="mobileTab === 'ai' ? 'font-semibold' : 'font-medium'">Agent</span>
        </button>

        <!-- Preview Tab -->
        <button class="relative z-10 flex items-center justify-center flex-1 h-[34px] gap-1 group active:scale-95 transition-all duration-300 rounded-full bg-transparent" :class="mobileTab === 'preview' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'" @click="mobileTab = 'preview'">
          <Eye class="w-3.5 h-3.5 transition-transform duration-300" :class="mobileTab === 'preview' ? 'stroke-[2.2]' : ''" />
          <span class="text-[12px] tracking-tight transition-all duration-300" :class="mobileTab === 'preview' ? 'font-semibold' : 'font-medium'">预览</span>
        </button>
      </div>
    </div>

    <!-- Confirm Flow Points Dialog -->
    <ConfirmDialog
      v-model:open="pointConfirmOpen"
      :title="`确认进行${pointConfirmTitle}？`"
      :description="pointConfirmDescription"
      confirm-text="确认使用"
      cancel-text="取消"
      @confirm="handlePointConfirm"
    />

    <!-- Confirm Delete Resume Dialog -->
    <ConfirmDialog
      v-model:open="showDeleteConfirm"
      title="确认删除该简历？"
      description="删除后该简历及全部内容将无法恢复，确认继续吗？"
      confirm-text="确认删除"
      cancel-text="取消"
      @confirm="confirmDelete"
    />

    <ResumeShareDialog
      v-if="resumeStore.currentResume"
      v-model:open="showShareDialog"
      :resume-id="resumeStore.currentResume.id"
      :resume-title="resumeStore.currentResume.title"
    />
  </div>
  <div v-else class="flex h-screen flex-col items-center justify-center bg-zinc-50">
    <div class="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 mb-4"></div>
    <span class="text-sm font-medium text-zinc-500 tracking-wide">加载简历中...</span>
  </div>
</template>

<style scoped>
.slide-form-enter-active,
.slide-form-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-form-enter-from,
.slide-form-leave-to {
  opacity: 0;
  transform: translateX(-20px);
  margin-left: -560px; /* Collapse space smoothly */
}

/* Slide Right Panel */
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.workspace-surface {
  transform-origin: 50% 45%;
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), filter 0.45s ease, opacity 0.45s ease;
}

.ai-launcher::before {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.75) 46%, transparent 68%);
  transform: translateX(-140%);
  transition: transform 0.7s ease;
}
.ai-launcher:hover::before { transform: translateX(140%); }
.ai-launcher-orb::after {
  position: absolute;
  inset: -3px;
  content: "";
  border: 1px solid currentColor;
  border-radius: 999px;
  opacity: 0.16;
  animation: ai-orbit 3s ease-in-out infinite;
}

.ai-workbench-layer {
  background:
    radial-gradient(circle at 50% 8%, rgba(99,102,241,0.10), transparent 38%),
    rgba(24,24,27,0.38);
  backdrop-filter: blur(12px);
}
.ai-workbench::after {
  position: absolute;
  inset: 0;
  z-index: 20;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
  content: "";
  pointer-events: none;
}
.ai-workbench-aurora {
  background:
    radial-gradient(circle at 20% 0%, rgba(124,58,237,0.12), transparent 34%),
    radial-gradient(circle at 60% -20%, rgba(14,165,233,0.11), transparent 38%),
    radial-gradient(circle at 90% 10%, rgba(16,185,129,0.10), transparent 32%);
}
.ai-core::before,
.ai-core::after {
  position: absolute;
  inset: -6px;
  content: "";
  border: 1px solid rgba(99,102,241,0.28);
  border-radius: 18px;
  animation: ai-core-pulse 2.8s ease-out infinite;
}
.ai-core::after { animation-delay: 1.4s; }

.ai-mode-tab {
  display: flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 12px;
  color: #71717a;
  font-size: 13px;
  font-weight: 600;
  transition: color 0.2s ease, background 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
}
.ai-mode-tab:hover { color: #18181b; transform: translateY(-1px); }
.ai-mode-tab--active {
  color: #18181b;
  background: rgba(255,255,255,0.96);
  box-shadow: 0 5px 18px rgba(24,24,27,0.08), inset 0 0 0 1px rgba(228,228,231,0.9);
}
.ai-mode-tab--chat svg { color: #7c3aed; }
.ai-mode-tab--score svg { color: #d97706; }
.ai-mode-tab--jd svg { color: #059669; }

.ai-workbench-enter-active,
.ai-workbench-leave-active { transition: opacity 0.4s ease; }
.ai-workbench-enter-active .ai-workbench,
.ai-workbench-leave-active .ai-workbench { transition: transform 0.52s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease, clip-path 0.52s cubic-bezier(0.16, 1, 0.3, 1); }
.ai-workbench-enter-from,
.ai-workbench-leave-to { opacity: 0; }
.ai-workbench-enter-from .ai-workbench,
.ai-workbench-leave-to .ai-workbench {
  opacity: 0;
  transform: translate(32%, -46%) scale(0.1);
  clip-path: inset(0 0 86% 82% round 999px);
}

.ai-content-enter-active,
.ai-content-leave-active { transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1); }
.ai-content-enter-from { opacity: 0; transform: translateY(12px) scale(0.992); }
.ai-content-leave-to { opacity: 0; transform: translateY(-6px) scale(0.992); }

.apply-success-enter-active,
.apply-success-leave-active { transition: opacity 0.28s ease; }
.apply-success-enter-active > div:last-child { animation: success-pop 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
.apply-success-enter-from,
.apply-success-leave-to { opacity: 0; }
.apply-success-ring { animation: success-ring 1.45s ease-out both; }
.apply-success-ring--delay { animation-delay: 0.18s; }

.export-fade-enter-active,
.export-fade-leave-active {
  transition: opacity 0.18s ease;
}
.export-fade-enter-from,
.export-fade-leave-to {
  opacity: 0;
}

@keyframes ai-orbit {
  0%, 100% { transform: scale(0.92); opacity: 0.1; }
  50% { transform: scale(1.18); opacity: 0.3; }
}
@keyframes ai-core-pulse {
  0% { transform: scale(0.78); opacity: 0; }
  25% { opacity: 0.7; }
  100% { transform: scale(1.4); opacity: 0; }
}
@keyframes success-pop {
  from { opacity: 0; transform: translateY(18px) scale(0.88); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes success-ring {
  from { opacity: 0.75; transform: scale(0.2); }
  to { opacity: 0; transform: scale(2.2); }
}

@media (max-width: 767px) {
  .workspace-surface--ai { transform: scale(0.99); }
  .ai-workbench-enter-from .ai-workbench,
  .ai-workbench-leave-to .ai-workbench {
    transform: translateY(90%) scale(0.96);
    clip-path: inset(88% 3% 0 3% round 28px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-surface,
  .ai-launcher,
  .ai-workbench-enter-active .ai-workbench,
  .ai-workbench-leave-active .ai-workbench { transition-duration: 0.01ms !important; }
  .ai-launcher-orb::after,
  .ai-core::before,
  .ai-core::after,
  .apply-success-ring { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
</style>

<style>
.ai-hero-flight-clone,
.ai-hero-flight-clone * {
  pointer-events: none !important;
  user-select: none !important;
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px) scale(0.95);
}

</style>
