<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import DOMPurify from "dompurify"
import {
  Activity, Bot, Download, FileText, LayoutDashboard, LayoutTemplate, Megaphone, DollarSign,
  ArrowDown, ArrowUp, Briefcase, ChevronsUp, ChevronsDown, Eye, EyeOff, Gift, MessageSquare, Plus, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal, Ticket, Users, Zap, X,
} from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Select from "@/components/ui/select/Select.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import PaginationFooter from "@/components/ui/pagination/PaginationFooter.vue"
import AdminShell from "@/components/admin/AdminShell.vue"
import AdminDashboardPanel from "@/components/admin/AdminDashboardPanel.vue"
import AnnouncementManager from "@/components/admin/AnnouncementManager.vue"
import AiSettingsManager from "@/components/admin/AiSettingsManager.vue"
import PointsAdjustModal from "@/components/admin/PointsAdjustModal.vue"
import RichTextEditor from "@/components/admin/RichTextEditor.vue"
import TemplatePreview from "@/components/templates/TemplatePreview.vue"
import type { EChartsOption } from "echarts"
import {
  getAdminAiTasksApi, getAdminDashboardApi, getAdminExportsApi, getAdminFeedbacksApi, getAdminResumesApi,
  getAdminAiConfigsApi, getAdminFlowPointTransactionsApi, getAdminResumeStarterIndustriesApi, getAdminResumeStartersApi, getAdminSettingsApi, getAdminTemplatesApi, getAdminUsersApi, grantAllUsersFlowPointsApi,
  revokeAllUsersFlowPointsGrantApi, sendAdminFeedbackEmailApi, updateAdminFeedbackApi, updateAdminResumeStarterApi, updateAdminSettingsApi, updateAdminTemplateApi, updateAdminUserFlowPointsApi, updateAdminUserStatusApi,
  createAdminResumeStarterApi, deleteAdminResumeStarterApi,
  type AdminAiConfig, type AdminAiTask, type AdminExport, type AdminFeedback, type AdminFlowPointTransaction, type AdminResume, type AdminResumeStarter, type AdminResumeStarterIndustry, type AdminTemplate, type AdminUser,
  type DashboardData, type PageData,
} from "@/api/admin"
import { showGlobalToast } from "@/utils/toast"

type Section = "dashboard" | "announcements" | "users" | "resumes" | "ai" | "point-transactions" | "ai-models" | "point-rules" | "redeem-codes" | "system-settings" | "feedbacks" | "exports" | "templates" | "industry-templates"

const section = ref<Section>("dashboard")
const loading = ref(false)
const error = ref("")
const keyword = ref("")
const statusFilter = ref("")
const typeFilter = ref("")
const modelFilter = ref("")
const starterIndustryFilter = ref("")
const pageSize = ref(20)
const otherModelFilterValue = "__other__"
type UserSortKey = "username" | "role" | "resume_count" | "flow_points" | "status" | "create_time"
const userSortBy = ref<UserSortKey>("create_time")
const userSortOrder = ref<"asc" | "desc">("desc")
const dashboard = ref<DashboardData | null>(null)
const users = ref<PageData<AdminUser>>({ items: [], total: 0, page: 1, page_size: 20 })
const resumes = ref<PageData<AdminResume>>({ items: [], total: 0, page: 1, page_size: 20 })
const aiTasks = ref<PageData<AdminAiTask>>({ items: [], total: 0, page: 1, page_size: 20 })
const exports = ref<PageData<AdminExport>>({ items: [], total: 0, page: 1, page_size: 20 })
const templates = ref<PageData<AdminTemplate>>({ items: [], total: 0, page: 1, page_size: 20 })
const resumeStarters = ref<PageData<AdminResumeStarter>>({ items: [], total: 0, page: 1, page_size: 20 })
const starterIndustries = ref<AdminResumeStarterIndustry[]>([])
const templateOptions = ref<AdminTemplate[]>([])
const feedbacks = ref<PageData<AdminFeedback>>({ items: [], total: 0, page: 1, page_size: 20 })
const pointTransactions = ref<PageData<AdminFlowPointTransaction>>({ items: [], total: 0, page: 1, page_size: 20 })

function sanitizeFeedbackHtml(content?: string | null) {
  return DOMPurify.sanitize(content || "")
}

const userPointTransactions = ref<PageData<AdminFlowPointTransaction>>({ items: [], total: 0, page: 1, page_size: 10 })
const aiModelConfigs = ref<AdminAiConfig[]>([])
const aiModelOptionsLoaded = ref(false)
const settingsForm = ref({
  signup_gift_points: 0,
  redeem_daily_attempt_limit: 10,
  ai_records_hint: "",
  feedback_notify_email: "",
  user_agreement: "",
})
const savingSettings = ref(false)
const showPointsModal = ref(false)
const pointsModalMode = ref<"single" | "all">("single")
const pointsTargetUser = ref<AdminUser | null>(null)
const showUserPointTransactions = ref(false)
const userPointTransactionsLoading = ref(false)
const userPointTransactionsError = ref("")
const userPointTransactionsTarget = ref<AdminUser | null>(null)

const navItems = [
  { id: "dashboard" as const, label: "数据看板", icon: LayoutDashboard },
  { id: "announcements" as const, label: "公告管理", icon: Megaphone },
  { id: "users" as const, label: "用户管理", icon: Users },
  { id: "resumes" as const, label: "简历管理", icon: FileText },
  { id: "ai" as const, label: "AI 任务", icon: Bot },
  { id: "point-transactions" as const, label: "点数流水", icon: Activity },
  { id: "ai-models" as const, label: "模型配置", icon: SlidersHorizontal },
  { id: "point-rules" as const, label: "点数规则", icon: Zap },
  { id: "redeem-codes" as const, label: "兑换码", icon: Ticket },
  { id: "system-settings" as const, label: "系统设置", icon: Settings },
  { id: "feedbacks" as const, label: "意见反馈", icon: MessageSquare },
  { id: "exports" as const, label: "导出记录", icon: Download },
  { id: "templates" as const, label: "模板设置", icon: LayoutTemplate },
  { id: "industry-templates" as const, label: "岗位预设", icon: Briefcase },
]

const currentTitle = computed(() => navItems.find((item) => item.id === section.value)?.label || "管理后台")
const currentPage = computed(() => {
  if (section.value === "users") return users.value
  if (section.value === "resumes") return resumes.value
  if (section.value === "ai") return aiTasks.value
  if (section.value === "point-transactions") return pointTransactions.value
  if (section.value === "feedbacks") return feedbacks.value
  if (section.value === "exports") return exports.value
  if (section.value === "templates") return templates.value
  if (section.value === "industry-templates") return resumeStarters.value
  return null
})
const totalPages = computed(() => currentPage.value ? Math.max(1, Math.ceil(currentPage.value.total / currentPage.value.page_size)) : 1)
const pageNumbers = computed(() => {
  const current = currentPage.value?.page || 1
  const start = Math.max(1, Math.min(current - 2, totalPages.value - 4))
  const end = Math.min(totalPages.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})
const dailyTotal = (item: DashboardData["daily"][number]) => item.users + item.resumes + item.ai_tasks + item.exports + (item.shares || 0)
const dailyTrendOption = computed<EChartsOption>(() => {
  const items = dashboard.value?.daily || []
  return {
    color: ["#18181b"],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      borderWidth: 0,
      backgroundColor: "#18181b",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: any) => {
        const rows = Array.isArray(params) ? params : [params]
        const index = rows[0]?.dataIndex || 0
        const day = items[index]
        if (!day) return ""
        return [
          `<div style="font-weight:700;margin-bottom:6px;">${day.date}<span style="float:right;color:#34d399;margin-left:18px;">${dailyTotal(day)} 总活动</span></div>`,
          `新增用户：<b>${day.users}</b>`,
          `简历创作：<b>${day.resumes}</b>`,
          `AI 调用：<b>${day.ai_tasks}</b>`,
          `文件导出：<b>${day.exports}</b>`,
          `分享次数：<b>${day.shares || 0}</b>`,
        ].join("<br/>")
      },
    },
    grid: { left: 4, right: 4, top: 20, bottom: 18, containLabel: true },
    xAxis: { type: "category", data: items.map((item) => item.date), axisTick: { show: false }, axisLine: { lineStyle: { color: "#e4e4e7" } }, axisLabel: { color: "#a1a1aa", fontWeight: 500 } },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: "#f4f4f5" } }, axisLabel: { color: "#a1a1aa" }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: "总活动", type: "bar", barMaxWidth: 24, itemStyle: { borderRadius: [8, 8, 0, 0] }, data: items.map(dailyTotal) },
    ],
  }
})
const hourlyActivityOption = computed<EChartsOption>(() => {
  const items = dashboard.value?.hourly_activity || []
  return {
    color: ["#10b981", "#cbd5e1"],
    tooltip: {
      trigger: "axis",
      borderWidth: 0,
      backgroundColor: "#18181b",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: any) => {
        const rows = Array.isArray(params) ? params : [params]
        const index = rows[0]?.dataIndex || 0
        const item = items[index]
        if (!item) return ""
        return [`<b>${item.label}</b>`, `活跃用户：<b>${item.active_users}</b> 人`, `操作次数：<b>${item.actions}</b>`].join("<br/>")
      },
    },
    grid: { left: 4, right: 4, top: 24, bottom: 18, containLabel: true },
    xAxis: { type: "category", data: items.map((item) => item.label), axisTick: { show: false }, axisLine: { lineStyle: { color: "#e4e4e7" } }, axisLabel: { color: "#a1a1aa", interval: 3, formatter: (value: string) => value.slice(0, 2) } },
    yAxis: [
      { type: "value", minInterval: 1, splitLine: { lineStyle: { color: "#f4f4f5" } }, axisLabel: { color: "#a1a1aa" }, axisLine: { show: false }, axisTick: { show: false } },
      { type: "value", minInterval: 1, splitLine: { show: false }, axisLabel: { color: "#a1a1aa" }, axisLine: { show: false }, axisTick: { show: false } },
    ],
    series: [
      {
        name: "活跃用户",
        type: "line",
        smooth: true,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 7,
        data: items.map((item) => item.active_users),
        areaStyle: { color: "rgba(16,185,129,0.08)" },
        lineStyle: { width: 2.5 },
      },
      { name: "操作次数", type: "bar", yAxisIndex: 1, barMaxWidth: 8, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: items.map((item) => item.actions) },
    ],
  }
})
const dashboardCards = computed(() => {
  if (!dashboard.value) return []
  return [
    { label: "用户总数", value: dashboard.value.totals.users, formattedValue: undefined, today: dashboard.value.today.users, formattedToday: undefined, icon: Users },
    { label: "简历总数", value: dashboard.value.totals.resumes, formattedValue: undefined, today: dashboard.value.today.resumes, formattedToday: undefined, icon: FileText },
    { label: "AI 任务", value: dashboard.value.totals.ai_tasks, formattedValue: undefined, today: dashboard.value.today.ai_tasks, formattedToday: undefined, icon: Bot },
    { label: "导出总数", value: dashboard.value.totals.exports, formattedValue: undefined, today: dashboard.value.today.exports, formattedToday: undefined, icon: Download },
    { label: "Token 消耗", value: dashboard.value.tokens?.total || 0, formattedValue: formatTokenNumber(dashboard.value.tokens?.total), today: dashboard.value.tokens?.today || 0, formattedToday: formatTokenNumber(dashboard.value.tokens?.today), icon: Zap },
    { label: "Flow Points 消耗", value: dashboard.value.points?.consumed || 0, formattedValue: undefined, today: dashboard.value.points?.today_consumed || 0, formattedToday: undefined, icon: Activity },
    { label: "总收入", value: dashboard.value.revenue?.redeemed || 0, formattedValue: formatCurrency(dashboard.value.revenue?.redeemed), today: dashboard.value.revenue?.today_redeemed || 0, formattedToday: formatCurrency(dashboard.value.revenue?.today_redeemed), icon: DollarSign },
    { label: "上线天数", value: dashboard.value.totals.operating_days, formattedValue: undefined, today: 0, formattedToday: undefined, icon: Activity },
  ]
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString()
}

function formatCurrency(value?: number) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function formatTokenNumber(value?: number) {
  const num = Number(value || 0)
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + "K"
  }
  return num.toString()
}

function tokenUsage(item: AdminAiTask) {
  const usage = item.input_data?.token_usage
  const total = Number(usage?.total_tokens ?? item.tokens_used ?? 0)
  const input = Number(usage?.input_tokens || item.input_data?.request_input_tokens || 0)
  const output = Number(usage?.output_tokens ?? Math.max(total - input, 0))
  return { total, input, output }
}

function modelDisplay(item: { model_name?: string | null; model_config_name?: string | null; model_raw_name?: string | null }) {
  const display = item.model_name || item.model_config_name || item.model_raw_name || ""
  const raw = item.model_raw_name && item.model_raw_name !== display ? item.model_raw_name : ""
  return { display, raw }
}

async function ensureAiModelOptions() {
  if (aiModelOptionsLoaded.value) return
  aiModelConfigs.value = await getAdminAiConfigsApi()
  aiModelOptionsLoaded.value = true
}

function statusText(value: string) {
  return ({ active: "正常", disabled: "已停用", success: "成功", failed: "失败", pending: "处理中" } as Record<string, string>)[value] || value
}

function taskTypeText(value: string) {
  return ({
    generate_resume: "AI 智能生成",
    import_resume: "导入简历",
    resume_score: "简历诊断",
    jd_optimize: "JD 优化",
    resume_translate: "简历翻译",
    section_optimize: "模块润色",
    ai_chat: "AI 助手对话",
  } as Record<string, string>)[value] || value
}

function feedbackStatusText(value: string) {
  return ({ open: "待处理", processing: "处理中", resolved: "已解决", closed: "已关闭" } as Record<string, string>)[value] || value
}

function sectionText(value?: string) {
  return ({ basics: "基本信息", summary: "个人简介", education: "教育经历", skills: "专业技能", work: "工作经历", projects: "项目经历", awards: "荣誉奖项" } as Record<string, string>)[value || ""] || "自定义模块"
}

function statusClass(value: string) {
  if (["active", "success"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
  if (["disabled", "failed"].includes(value)) return "bg-red-50 text-red-700 ring-red-600/20"
  return "bg-amber-50 text-amber-700 ring-amber-600/20"
}

function toggleUserSort(key: UserSortKey) {
  if (userSortBy.value === key) {
    userSortOrder.value = userSortOrder.value === "asc" ? "desc" : "asc"
  } else {
    userSortBy.value = key
    userSortOrder.value = ["username", "role", "status"].includes(key) ? "asc" : "desc"
  }
  load(1)
}

async function ensureTemplateOptions() {
  if (templateOptions.value.length) return
  const data = await getAdminTemplatesApi({ page: 1, page_size: 100 })
  templateOptions.value = data.items
}

async function load(page = 1) {
  loading.value = true
  error.value = ""
  try {
    if (["ai", "point-transactions"].includes(section.value)) await ensureAiModelOptions()
    if (section.value === "dashboard") dashboard.value = await getAdminDashboardApi()
    if (section.value === "users") users.value = await getAdminUsersApi({ page, page_size: pageSize.value, keyword: keyword.value, status: statusFilter.value || undefined, sort_by: userSortBy.value, sort_order: userSortOrder.value })
    if (section.value === "resumes") {
      await ensureTemplateOptions()
      resumes.value = await getAdminResumesApi({ page, page_size: pageSize.value, keyword: keyword.value })
    }
    if (section.value === "ai") aiTasks.value = await getAdminAiTasksApi({ page, page_size: pageSize.value, status: statusFilter.value || undefined, task_type: typeFilter.value || undefined, model: modelFilter.value || undefined })
    if (section.value === "point-transactions") pointTransactions.value = await getAdminFlowPointTransactionsApi({ page, page_size: pageSize.value, keyword: keyword.value, direction: statusFilter.value || undefined, feature_type: typeFilter.value || undefined, model: modelFilter.value || undefined })
    if (section.value === "system-settings") {
      const data = await getAdminSettingsApi()
      settingsForm.value = {
        signup_gift_points: Number(data.signup_gift_points || 0),
        redeem_daily_attempt_limit: Number(data.redeem_daily_attempt_limit || 10),
        ai_records_hint: data.ai_records_hint || "",
        feedback_notify_email: data.feedback_notify_email || "",
        user_agreement: data.user_agreement || "",
      }
    }
    if (section.value === "feedbacks") feedbacks.value = await getAdminFeedbacksApi({ page, page_size: pageSize.value, status: statusFilter.value || undefined })
    if (section.value === "exports") exports.value = await getAdminExportsApi({ page, page_size: pageSize.value, status: statusFilter.value || undefined })
    if (section.value === "templates") templates.value = await getAdminTemplatesApi({ page, page_size: pageSize.value })
    if (section.value === "industry-templates") {
      if (!starterIndustries.value.length) {
        starterIndustries.value = await getAdminResumeStarterIndustriesApi()
      }
      resumeStarters.value = await getAdminResumeStartersApi({
        page,
        page_size: pageSize.value,
        keyword: keyword.value,
        industry_id: starterIndustryFilter.value || undefined,
      })
      await ensureTemplateOptions()
    }
  } catch (err: any) {
    error.value = err.message || "数据加载失败"
  } finally {
    loading.value = false
  }
}

function switchSection(value: Section) {
  section.value = value
  keyword.value = ""
  statusFilter.value = ""
  typeFilter.value = ""
  modelFilter.value = ""
  starterIndustryFilter.value = ""
  pageSize.value = 20
  load()
}

function handleShellSection(value: string) {
  switchSection(value as Section)
}

const showConfirm = ref(false)
const confirmTarget = ref<AdminUser | null>(null)
const confirmNextStatus = ref<"active" | "disabled">("active")
const showRevokeGrantConfirm = ref(false)
const revokeGrantTarget = ref<AdminFlowPointTransaction | null>(null)

const showFeedbackReply = ref(false)
const feedbackReplySaving = ref(false)
const feedbackEmailSending = ref(false)
const feedbackReplyTarget = ref<AdminFeedback | null>(null)
const feedbackReplyForm = ref({
  status: "processing" as AdminFeedback["status"],
  admin_note: "",
  admin_reply: "",
})

function openFeedbackReply(item: AdminFeedback) {
  feedbackReplyTarget.value = item
  feedbackReplyForm.value = {
    status: item.status === "open" ? "processing" : item.status,
    admin_note: item.admin_note || "",
    admin_reply: item.admin_reply || "",
  }
  showFeedbackReply.value = true
}

function closeFeedbackReply() {
  showFeedbackReply.value = false
  feedbackReplyTarget.value = null
}

function requestToggleUser(user: AdminUser) {
  confirmNextStatus.value = user.status === "active" ? "disabled" : "active"
  confirmTarget.value = user
  showConfirm.value = true
}

async function loadUserPointTransactions(page = 1) {
  const user = userPointTransactionsTarget.value
  if (!user) return
  userPointTransactionsLoading.value = true
  userPointTransactionsError.value = ""
  try {
    userPointTransactions.value = await getAdminFlowPointTransactionsApi({
      page,
      page_size: userPointTransactions.value.page_size,
      user_id: user.id,
    })
  } catch (err: any) {
    userPointTransactionsError.value = err.message || "点数流水加载失败"
  } finally {
    userPointTransactionsLoading.value = false
  }
}

function openUserPointTransactions(user: AdminUser) {
  userPointTransactionsTarget.value = user
  userPointTransactions.value = { items: [], total: 0, page: 1, page_size: userPointTransactions.value.page_size }
  showUserPointTransactions.value = true
  loadUserPointTransactions(1)
}

function closeUserPointTransactions() {
  showUserPointTransactions.value = false
  userPointTransactionsTarget.value = null
  userPointTransactionsError.value = ""
}

async function executeToggleUser() {
  const user = confirmTarget.value
  const next = confirmNextStatus.value
  if (!user) return
  try {
    await updateAdminUserStatusApi(user.id, next)
    user.status = next
    showGlobalToast(next === "active" ? "解禁成功" : "禁用成功")
  } catch (err: any) {
    showGlobalToast(err.message || "操作失败", "error")
  } finally {
    showConfirm.value = false
    confirmTarget.value = null
  }
}

function requestRevokeGrant(item: AdminFlowPointTransaction) {
  if (!item.grant_batch_no) return
  revokeGrantTarget.value = item
  showRevokeGrantConfirm.value = true
}

async function executeRevokeGrant() {
  const target = revokeGrantTarget.value
  const batchNo = target?.grant_batch_no
  if (!batchNo) return
  try {
    const result = await revokeAllUsersFlowPointsGrantApi(batchNo, {
      description: `撤回误发放批次 ${batchNo}`,
    }) as any
    showGlobalToast(`已分 ${result?.batches ?? 0} 批撤回 ${result?.count ?? 0} 个用户的发放`)
    await load(currentPage.value?.page || 1)
  } catch (err: any) {
    showGlobalToast(err.message || "撤回发放失败", "error")
  } finally {
    showRevokeGrantConfirm.value = false
    revokeGrantTarget.value = null
  }
}

async function updateTemplateDisplay(item: AdminTemplate, data: { sort_order?: number; is_visible?: boolean }) {
  try {
    if (data.sort_order !== undefined) item.sort_order = data.sort_order
    if (data.is_visible !== undefined) item.is_visible = data.is_visible
    templates.value.items.sort((a, b) => a.sort_order - b.sort_order || a.template_id.localeCompare(b.template_id))
    await updateAdminTemplateApi(item.template_id, data)
    showGlobalToast("模板展示设置已更新")
  } catch (err: any) {
    showGlobalToast(err.message || "模板设置更新失败", "error")
    await load(templates.value.page)
  }
}

function changeTemplateOrderInput(item: AdminTemplate, value: Event) {
  const target = value.target as HTMLInputElement
  const nextOrder = Number(target.value)
  if (!Number.isFinite(nextOrder)) {
    target.value = String(item.sort_order)
    return
  }
  if (nextOrder === item.sort_order) return
  updateTemplateDisplay(item, { sort_order: nextOrder })
}

const starterTemplateOptions = computed(() =>
  templateOptions.value.map((item) => ({
    label: `${item.name} · ${item.category}`,
    value: item.template_id,
  })),
)
const starterIndustryOptions = computed(() =>
  starterIndustries.value.map((item) => ({
    label: item.name,
    value: item.id,
    meta: item.id,
  })),
)
const starterIndustryFilterOptions = computed(() => [
  { label: "全部行业", value: "" },
  ...starterIndustryOptions.value,
])
const defaultStarterContent = () => ({
  modules_text: "summary|个人简介\nskills|专业技能\nwork|工作经历\nprojects|项目经历",
  summary: "",
  level_variants_text: "{}",
  skills_text: "岗位核心能力 | 关键词1, 关键词2 | 描述这项能力如何支撑岗位目标",
  work_position: "",
  work_description: "",
  work_highlights_text: "",
  project_name: "",
  project_role: "",
  project_tech_stack: "",
  project_description: "",
  project_highlights_text: "",
})
const showStarterEditor = ref(false)
const starterSaving = ref(false)
const starterEditorMode = ref<"create" | "edit">("create")
const starterTarget = ref<AdminResumeStarter | null>(null)
const starterForm = ref({
  starter_id: "",
  industry_id: "",
  industry_name: "",
  industry_description: "",
  role_title: "",
  role_subtitle: "",
  default_template_id: "tech",
  keywords_text: "",
  focus_text: "",
  sort_order: 1000,
  is_visible: true,
  ...defaultStarterContent(),
})
const showStarterDeleteConfirm = ref(false)
const starterDeleteTarget = ref<AdminResumeStarter | null>(null)

function templateNameById(templateId?: string) {
  if (!templateId) return "未设置"
  return templateOptions.value.find((item) => item.template_id === templateId)?.name || templateId
}

function starterModuleSummary(item: AdminResumeStarter) {
  const modules = Array.isArray(item.content?.modules) ? item.content.modules : []
  if (!modules.length) return "未配置"
  const titles = modules.map((module: any) => module.title || module.key).filter(Boolean)
  if (titles.length <= 2) return titles.join("、")
  return `${titles.slice(0, 2).join("、")} 等 ${titles.length} 个`
}

function starterKeywordSummary(item: AdminResumeStarter) {
  if (!item.keywords.length) return "—"
  const words = item.keywords.slice(0, 4).join(" / ")
  return item.keywords.length > 4 ? `${words} +${item.keywords.length - 4}` : words
}



async function ensureStarterIndustries() {
  if (starterIndustries.value.length) return
  starterIndustries.value = await getAdminResumeStarterIndustriesApi()
}

function splitText(value: string) {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean)
}

function joinText(value?: string[]) {
  return (value || []).join("\n")
}

function modulesToText(content: Record<string, any>) {
  const modules = Array.isArray(content?.modules) ? content.modules : []
  if (!modules.length) return defaultStarterContent().modules_text
  return modules.map((item: any) => `${item.key || ""}|${item.title || ""}`.trim()).filter(Boolean).join("\n")
}

function parseModules(value: string) {
  return value.split("\n").map((line) => {
    const [key, title] = line.split("|").map((item) => item.trim())
    if (!key) return null
    return { key, title: title || key }
  }).filter(Boolean) as Array<{ key: string; title: string }>
}

function skillsToText(content: Record<string, any>) {
  const skills = Array.isArray(content?.skills) ? content.skills : []
  return skills.map((item: any) => `${item.name || ""} | ${(item.keywords || []).join(", ")} | ${item.description || ""}`).join("\n")
}

function parseSkills(value: string) {
  return value.split("\n").map((line) => {
    const [name, keywords, description] = line.split("|").map((item) => item.trim())
    if (!name) return null
    return {
      name,
      keywords: splitText(keywords || ""),
      description: description || "",
    }
  }).filter(Boolean)
}

function levelVariantsToText(content: Record<string, any>) {
  const variants = content?.level_variants
  if (!variants || typeof variants !== "object") return "{}"
  return JSON.stringify(variants, null, 2)
}

function parseLevelVariants(value: string) {
  const text = value.trim()
  if (!text || text === "{}") return {}
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("经验阶段配置必须是 JSON 对象")
  }
  return parsed
}

function starterContentFromForm() {
  return {
    modules: parseModules(starterForm.value.modules_text),
    summary: starterForm.value.summary.trim(),
    level_variants: parseLevelVariants(starterForm.value.level_variants_text),
    skills: parseSkills(starterForm.value.skills_text),
    work: {
      position: starterForm.value.work_position.trim(),
      description: starterForm.value.work_description.trim(),
      highlights: splitText(starterForm.value.work_highlights_text),
    },
    project: {
      name: starterForm.value.project_name.trim(),
      role: starterForm.value.project_role.trim(),
      tech_stack: starterForm.value.project_tech_stack.trim(),
      description: starterForm.value.project_description.trim(),
      highlights: splitText(starterForm.value.project_highlights_text),
    },
  }
}

function starterPayload() {
  return {
    starter_id: starterForm.value.starter_id.trim(),
    industry_id: starterForm.value.industry_id.trim(),
    industry_name: starterForm.value.industry_name.trim(),
    industry_description: starterForm.value.industry_description.trim(),
    role_title: starterForm.value.role_title.trim(),
    role_subtitle: starterForm.value.role_subtitle.trim(),
    default_template_id: starterForm.value.default_template_id,
    keywords: splitText(starterForm.value.keywords_text),
    focus: splitText(starterForm.value.focus_text),
    content: starterContentFromForm(),
    sort_order: Number(starterForm.value.sort_order || 1000),
    is_visible: starterForm.value.is_visible,
  }
}

function applyIndustryToStarterForm(industryId: string) {
  const item = starterIndustries.value.find((industry) => industry.id === industryId)
  if (!item) return
  starterForm.value.industry_name = item.name
  starterForm.value.industry_description = item.description || ""
}

function resetStarterForm() {
  const firstIndustry = starterIndustries.value[0]
  starterForm.value = {
    starter_id: "",
    industry_id: firstIndustry?.id || "custom",
    industry_name: firstIndustry?.name || "自定义行业",
    industry_description: firstIndustry?.description || "",
    role_title: "",
    role_subtitle: "",
    default_template_id: "tech",
    keywords_text: "",
    focus_text: "",
    sort_order: (resumeStarters.value.total || 0) + 100,
    is_visible: true,
    ...defaultStarterContent(),
  }
}

function openStarterCreator() {
  starterEditorMode.value = "create"
  starterTarget.value = null
  resetStarterForm()
  showStarterEditor.value = true
  ensureTemplateOptions().catch(() => null)
  ensureStarterIndustries().then(resetStarterForm).catch(resetStarterForm)
}

function openStarterEditor(item: AdminResumeStarter) {
  const content = item.content || {}
  const work = content.work || {}
  const project = content.project || {}
  starterEditorMode.value = "edit"
  starterTarget.value = item
  starterForm.value = {
    starter_id: item.starter_id,
    industry_id: item.industry_id,
    industry_name: item.industry_name,
    industry_description: item.industry_description || "",
    role_title: item.role_title,
    role_subtitle: item.role_subtitle || "",
    default_template_id: item.default_template_id || "tech",
    keywords_text: joinText(item.keywords),
    focus_text: joinText(item.focus),
    sort_order: item.sort_order || 1000,
    is_visible: item.is_visible,
    modules_text: modulesToText(content),
    summary: content.summary || "",
    level_variants_text: levelVariantsToText(content),
    skills_text: skillsToText(content) || defaultStarterContent().skills_text,
    work_position: work.position || "",
    work_description: work.description || "",
    work_highlights_text: joinText(work.highlights),
    project_name: project.name || "",
    project_role: project.role || "",
    project_tech_stack: project.tech_stack || "",
    project_description: project.description || "",
    project_highlights_text: joinText(project.highlights),
  }
  showStarterEditor.value = true
  ensureTemplateOptions().catch(() => null)
  ensureStarterIndustries().catch(() => null)
}

function closeStarterEditor() {
  showStarterEditor.value = false
  starterTarget.value = null
}

async function saveStarter() {
  if (starterSaving.value) return
  starterSaving.value = true
  try {
    const payload = starterPayload()
    const updated = starterEditorMode.value === "create"
      ? await createAdminResumeStarterApi(payload)
      : await updateAdminResumeStarterApi(starterTarget.value?.starter_id || payload.starter_id, payload)
    if (starterEditorMode.value === "create") {
      resumeStarters.value.items.unshift(updated)
      resumeStarters.value.total += 1
    } else if (starterTarget.value) {
      Object.assign(starterTarget.value, updated)
    }
    closeStarterEditor()
    showGlobalToast(starterEditorMode.value === "create" ? "岗位预设已创建" : "岗位预设已保存")
  } catch (err: any) {
    showGlobalToast(err.message || "保存岗位预设失败", "error")
  } finally {
    starterSaving.value = false
  }
}

function requestDeleteStarter(item: AdminResumeStarter) {
  starterDeleteTarget.value = item
  showStarterDeleteConfirm.value = true
}

async function executeDeleteStarter() {
  const item = starterDeleteTarget.value
  if (!item) return
  try {
    await deleteAdminResumeStarterApi(item.starter_id)
    resumeStarters.value.items = resumeStarters.value.items.filter((row) => row.starter_id !== item.starter_id)
    resumeStarters.value.total = Math.max(0, resumeStarters.value.total - 1)
    showGlobalToast("岗位预设已删除")
  } catch (err: any) {
    showGlobalToast(err.message || "删除岗位预设失败", "error")
  } finally {
    showStarterDeleteConfirm.value = false
    starterDeleteTarget.value = null
  }
}

function adjustUserPoints(user: AdminUser) {
  pointsTargetUser.value = user
  pointsModalMode.value = "single"
  showPointsModal.value = true
}

function grantAllPoints() {
  pointsModalMode.value = "all"
  showPointsModal.value = true
}

async function executePointsAdjust(points: number, description: string) {
  showPointsModal.value = false
  if (pointsModalMode.value === "all") {
    try {
      const result = await grantAllUsersFlowPointsApi({ points, description }) as any
      showGlobalToast(`已分 ${result?.batches ?? 0} 批向 ${result?.count ?? 0} 个用户发放 ${points} 点`)
      if (section.value === "users") await load(currentPage.value?.page || 1)
    } catch (err: any) {
      showGlobalToast(err.message || "全员发放失败", "error")
    }
  } else if (pointsTargetUser.value) {
    const user = pointsTargetUser.value
    try {
      const updated = await updateAdminUserFlowPointsApi(user.id, { points_delta: points, description }) as any
      user.flow_points = Number(updated?.flow_points ?? user.flow_points + points)
      showGlobalToast("充值调整成功")
    } catch (err: any) {
      showGlobalToast(err.message || "Flow Points 调整失败", "error")
    }
  }
}

async function saveSettings() {
  savingSettings.value = true
  error.value = ""
  try {
    const data = await updateAdminSettingsApi({
      signup_gift_points: Number(settingsForm.value.signup_gift_points || 0),
      redeem_daily_attempt_limit: Number(settingsForm.value.redeem_daily_attempt_limit || 0),
      ai_records_hint: settingsForm.value.ai_records_hint || "",
      feedback_notify_email: settingsForm.value.feedback_notify_email || "",
      user_agreement: settingsForm.value.user_agreement || "",
    })
    settingsForm.value = {
      signup_gift_points: Number(data.signup_gift_points || 0),
      redeem_daily_attempt_limit: Number(data.redeem_daily_attempt_limit || 10),
      ai_records_hint: data.ai_records_hint || "",
      feedback_notify_email: data.feedback_notify_email || "",
      user_agreement: data.user_agreement || "",
    }
    showGlobalToast("系统设置已保存")
  } catch (err: any) {
    showGlobalToast(err.message || "系统设置保存失败", "error")
  } finally {
    savingSettings.value = false
  }
}

async function saveFeedbackReply() {
  const item = feedbackReplyTarget.value
  if (!item || feedbackReplySaving.value) return
  feedbackReplySaving.value = true
  try {
    const updated = await updateAdminFeedbackApi(item.id, {
      status: feedbackReplyForm.value.status,
      admin_note: feedbackReplyForm.value.admin_note,
      admin_reply: feedbackReplyForm.value.admin_reply,
    }) as any
    item.status = updated?.status || feedbackReplyForm.value.status
    item.admin_note = updated?.admin_note ?? feedbackReplyForm.value.admin_note
    item.admin_reply = updated?.admin_reply ?? feedbackReplyForm.value.admin_reply
    item.reply_time = updated?.reply_time ?? item.reply_time
    closeFeedbackReply()
    showGlobalToast("回复已保存")
  } catch (err: any) {
    showGlobalToast(err.message || "回复保存失败", "error")
  } finally {
    feedbackReplySaving.value = false
  }
}

async function sendFeedbackResultEmail() {
  const item = feedbackReplyTarget.value
  const reply = feedbackReplyForm.value.admin_reply.trim()
  if (!item || feedbackEmailSending.value || !reply) return
  feedbackEmailSending.value = true
  try {
    const updated = await sendAdminFeedbackEmailApi(item.id, {
      status: feedbackReplyForm.value.status,
      admin_note: feedbackReplyForm.value.admin_note,
      admin_reply: reply,
    }) as any
    item.status = updated?.status || feedbackReplyForm.value.status
    item.admin_note = updated?.admin_note ?? feedbackReplyForm.value.admin_note
    item.admin_reply = updated?.admin_reply ?? reply
    item.reply_time = updated?.reply_time ?? item.reply_time
    showGlobalToast("处理结果邮件已发送")
  } catch (err: any) {
    showGlobalToast(err.message || "处理结果邮件发送失败", "error")
  } finally {
    feedbackEmailSending.value = false
  }
}

const statusOptions = computed(() => {
  if (section.value === 'users') {
    return [
      { label: '全部状态', value: '' },
      { label: '正常', value: 'active' },
      { label: '已停用', value: 'disabled' },
    ]
  }
  if (section.value === 'feedbacks') {
    return [
      { label: '全部状态', value: '' },
      { label: '待处理', value: 'open' },
      { label: '处理中', value: 'processing' },
      { label: '已解决', value: 'resolved' },
      { label: '已关闭', value: 'closed' },
    ]
  }
  if (section.value === 'point-transactions') {
    return [
      { label: '全部方向', value: '' },
      { label: '扣减', value: 'consume' },
      { label: '充值发放', value: 'recharge' },
    ]
  }
  return [
    { label: '全部状态', value: '' },
    { label: '成功', value: 'success' },
    { label: '失败', value: 'failed' },
    { label: '处理中', value: 'pending' },
  ]
})

const feedbackEditStatusOptions = [
  { label: '待处理', value: 'open' },
  { label: '处理中', value: 'processing' },
  { label: '已解决', value: 'resolved' },
  { label: '已关闭', value: 'closed' },
]

const modelFilterOptions = computed(() => {
  const seen = new Set<string>()
  const options = [{ label: '全部模型', value: '' }]
  for (const item of aiModelConfigs.value) {
    const model = String(item.model || '').trim()
    if (!model || seen.has(model)) continue
    seen.add(model)
    const label = item.name && item.name !== model ? `${item.name}` : model
    options.push({ label, value: model })
  }
  options.push({ label: '其他模型', value: otherModelFilterValue })
  return options
})

const aiTypeOptions = [
  { label: '全部 AI 功能', value: '' },
  { label: 'AI 智能生成', value: 'generate_resume' },
  { label: '导入简历', value: 'import_resume' },
  { label: '简历诊断', value: 'resume_score' },
  { label: 'JD 优化', value: 'jd_optimize' },
  { label: '简历翻译', value: 'resume_translate' },
  { label: '模块润色', value: 'section_optimize' },
  { label: 'AI 助手对话', value: 'ai_chat' },
]

const pointFeatureOptions = [
  { label: '全部功能', value: '' },
  { label: 'AI 智能生成', value: 'generate_resume' },
  { label: '导入简历', value: 'import_resume' },
  { label: 'AI 润色', value: 'section_optimize' },
  { label: 'AI 助手', value: 'ai_chat' },
  { label: '智能诊断', value: 'resume_score' },
  { label: 'JD 优化', value: 'jd_optimize' },
  { label: '简历翻译', value: 'resume_translate' },
  { label: '兑换码充值', value: 'redeem' },
  { label: '管理员调整', value: 'admin_adjust' },
  { label: '全员发放', value: 'admin_grant_all' },
  { label: '全员发放撤回', value: 'admin_grant_all_revoke' },
  { label: '注册赠送', value: 'signup_gift' },
]

const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 },
  { label: '100 条/页', value: 100 },
]

onMounted(() => load())
</script>

<template>
  <AdminShell
    :nav-items="navItems"
    :section="section"
    :title="currentTitle"
    :loading="loading"
    :error="error"
    @switch-section="handleShellSection"
    @refresh="load(currentPage?.page || 1)"
  >
        <AdminDashboardPanel
          v-if="section === 'dashboard' && dashboard"
          :dashboard="dashboard"
          :cards="dashboardCards"
          :daily-trend-option="dailyTrendOption"
          :hourly-activity-option="hourlyActivityOption"
        />

        <AnnouncementManager v-else-if="section === 'announcements'" />
        <AiSettingsManager v-else-if="section === 'ai-models'" mode="model" />
        <AiSettingsManager v-else-if="section === 'point-rules'" mode="rules" />
        <AiSettingsManager v-else-if="section === 'redeem-codes'" mode="codes" />

        <template v-else-if="section === 'system-settings'">
          <div class="space-y-6 max-w-5xl">
            <!-- 基础配置：双栏网格，高度统一，紧凑优雅 -->
            <section class="grid gap-5 md:grid-cols-3">
              <article class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex items-start gap-3.5">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white"><Gift class="h-5 w-5" /></span>
                    <div>
                      <h2 class="font-semibold text-zinc-900 text-base">注册赠送</h2>
                      <p class="mt-1 text-xs text-zinc-500 leading-relaxed">新用户完成注册后自动发放 Flow Points，设置为 0 则不赠送。</p>
                    </div>
                  </div>
                </div>
                <div class="mt-6">
                  <label class="block text-xs font-medium text-zinc-700 mb-2.5">新用户赠送点数</label>
                  <input v-model.number="settingsForm.signup_gift_points" type="number" min="0" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                </div>
              </article>
              
              <article class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex items-start gap-3.5">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><MessageSquare class="h-5 w-5" /></span>
                    <div>
                      <h2 class="font-semibold text-zinc-900 text-base">反馈通知邮箱</h2>
                      <p class="mt-1 text-xs text-zinc-500 leading-relaxed">用户提交意见反馈后会发送提醒邮件，留空则不发送。</p>
                    </div>
                  </div>
                </div>
                <div class="mt-6">
                  <label class="block text-xs font-medium text-zinc-700 mb-2.5">接收邮箱</label>
                  <input v-model.trim="settingsForm.feedback_notify_email" type="email" placeholder="admin@example.com" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                </div>
              </article>

              <article class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex items-start gap-3.5">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><ShieldCheck class="h-5 w-5" /></span>
                    <div>
                      <h2 class="font-semibold text-zinc-900 text-base">兑换安全</h2>
                      <p class="mt-1 text-xs text-zinc-500 leading-relaxed">限制每个用户每天尝试兑换码的次数，降低撞码和误操作风险。</p>
                    </div>
                  </div>
                </div>
                <div class="mt-6">
                  <label class="block text-xs font-medium text-zinc-700 mb-2.5">每日尝试次数</label>
                  <input v-model.number="settingsForm.redeem_daily_attempt_limit" type="number" min="0" max="1000" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                </div>
              </article>
            </section>

            <!-- 提示文案设置：全宽单栏，释放富文本工具栏展示空间 -->
            <article class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div class="border-b border-zinc-100 pb-4 mb-5">
                <h2 class="font-semibold text-zinc-900 text-base">AI 记录页提示</h2>
                <p class="mt-1 text-xs text-zinc-500">展示在用户 AI 记录页余额下方，可用于说明点数兑换比例、计费规则或活动信息。</p>
              </div>
              <div class="min-h-[220px]">
                <RichTextEditor v-model="settingsForm.ai_records_hint" compact placeholder="例如：1 元约等于 100 Flow Points，具体扣点以后台规则为准。" />
              </div>
            </article>

            <article class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div class="border-b border-zinc-100 pb-4 mb-5">
                <h2 class="font-semibold text-zinc-900 text-base">用户协议与隐私政策</h2>
                <p class="mt-1 text-xs text-zinc-500">在用户注册与登录时展示并要求勾选，支持编辑富文本条款内容。</p>
              </div>
              <div class="min-h-[220px]">
                <RichTextEditor v-model="settingsForm.user_agreement" placeholder="请输入用户协议与隐私政策内容..." />
              </div>
            </article>

            <!-- 独立的操作底部栏 -->
            <div class="flex items-center justify-end pt-2">
              <Button :disabled="savingSettings" @click="saveSettings" class="px-6 py-2.5 shadow-md hover:shadow-lg transition-all"><Settings class="h-4 w-4 mr-2" />{{ savingSettings ? "保存中..." : "保存全部设置" }}</Button>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="['users', 'resumes', 'ai', 'point-transactions', 'feedbacks', 'exports', 'industry-templates'].includes(section)" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div v-if="['users', 'resumes', 'point-transactions', 'industry-templates'].includes(section)" class="relative w-full sm:w-72">
              <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input v-model="keyword" class="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" :placeholder="section === 'point-transactions' ? '搜索用户、邮箱或说明' : section === 'industry-templates' ? '搜索行业、岗位或 ID' : '搜索用户名、邮箱或标题'" @keyup.enter="load(1)" />
            </div>
            <div v-if="section === 'industry-templates'" class="w-full sm:w-44">
              <Select v-model="starterIndustryFilter" :options="starterIndustryFilterOptions" placeholder="全部行业" class="h-10 w-full rounded-lg" @change="load(1)" />
            </div>
            <div v-if="['users', 'ai', 'point-transactions', 'feedbacks', 'exports'].includes(section)" class="w-full sm:w-32">
              <Select v-model="statusFilter" :options="statusOptions" placeholder="全部状态" class="h-10 w-full rounded-lg" @change="load(1)" />
            </div>
            <div v-if="['ai', 'point-transactions'].includes(section)" class="w-full sm:w-40">
              <Select v-model="typeFilter" :options="section === 'point-transactions' ? pointFeatureOptions : aiTypeOptions" placeholder="全部功能" class="h-10 w-full rounded-lg" @change="load(1)" />
            </div>
            <div v-if="['ai', 'point-transactions'].includes(section)" class="w-full sm:w-44">
              <Select v-model="modelFilter" :options="modelFilterOptions" placeholder="全部模型" class="h-10 w-full rounded-lg" @change="load(1)" />
            </div>
            <Button v-if="['users', 'resumes', 'point-transactions', 'industry-templates'].includes(section)" class="w-full sm:w-auto" @click="load(1)">查询</Button>
            <Button v-if="section === 'users'" variant="outline" class="w-full sm:w-auto" @click="grantAllPoints"><Gift class="h-4 w-4" />全员发放</Button>
            <Button v-if="section === 'industry-templates'" variant="outline" class="w-full sm:w-auto" @click="openStarterCreator"><Plus class="h-4 w-4" />新增岗位预设</Button>
          </div>

          <div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div v-if="loading" class="flex h-64 items-center justify-center text-sm text-zinc-400"><RefreshCw class="mr-2 h-4 w-4 animate-spin" />正在加载</div>
            <div v-else class="overflow-x-auto">
              <table v-if="section === 'users'" class="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr class="border-b bg-zinc-50 text-xs text-zinc-500">
                    <th class="px-5 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-zinc-900" @click="toggleUserSort('username')">用户<component :is="userSortBy === 'username' && userSortOrder === 'asc' ? ArrowUp : ArrowDown" class="h-3.5 w-3.5" :class="userSortBy === 'username' ? 'text-zinc-900' : 'text-zinc-300'" /></button></th>
                    <th class="px-5 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-zinc-900" @click="toggleUserSort('role')">角色<component :is="userSortBy === 'role' && userSortOrder === 'asc' ? ArrowUp : ArrowDown" class="h-3.5 w-3.5" :class="userSortBy === 'role' ? 'text-zinc-900' : 'text-zinc-300'" /></button></th>
                    <th class="px-5 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-zinc-900" @click="toggleUserSort('resume_count')">简历<component :is="userSortBy === 'resume_count' && userSortOrder === 'asc' ? ArrowUp : ArrowDown" class="h-3.5 w-3.5" :class="userSortBy === 'resume_count' ? 'text-zinc-900' : 'text-zinc-300'" /></button></th>
                    <th class="px-5 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-zinc-900" @click="toggleUserSort('flow_points')">Flow Points<component :is="userSortBy === 'flow_points' && userSortOrder === 'asc' ? ArrowUp : ArrowDown" class="h-3.5 w-3.5" :class="userSortBy === 'flow_points' ? 'text-zinc-900' : 'text-zinc-300'" /></button></th>
                    <th class="px-5 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-zinc-900" @click="toggleUserSort('status')">状态<component :is="userSortBy === 'status' && userSortOrder === 'asc' ? ArrowUp : ArrowDown" class="h-3.5 w-3.5" :class="userSortBy === 'status' ? 'text-zinc-900' : 'text-zinc-300'" /></button></th>
                    <th class="px-5 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-zinc-900" @click="toggleUserSort('create_time')">注册时间<component :is="userSortBy === 'create_time' && userSortOrder === 'asc' ? ArrowUp : ArrowDown" class="h-3.5 w-3.5" :class="userSortBy === 'create_time' ? 'text-zinc-900' : 'text-zinc-300'" /></button></th>
                    <th class="px-5 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in users.items" :key="item.id" class="border-b border-zinc-100 last:border-0">
                    <td class="px-5 py-4"><p class="font-medium text-zinc-900">{{ item.username }}</p><p class="mt-0.5 text-xs text-zinc-400">{{ item.email }}</p></td>
                    <td class="px-5 py-4">{{ item.role === 'admin' ? '管理员' : '用户' }}</td>
                    <td class="px-5 py-4">{{ item.resume_count }}</td>
                    <td class="px-5 py-4"><button class="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-900 hover:text-white" @click="adjustUserPoints(item)">{{ item.flow_points || 0 }}</button></td>
                    <td class="px-5 py-4"><span class="rounded-full px-2 py-1 text-xs ring-1 ring-inset" :class="statusClass(item.status)">{{ statusText(item.status) }}</span></td>
                    <td class="px-5 py-4 text-zinc-500">{{ formatDate(item.create_time) }}</td>
                    <td class="px-5 py-4 text-right">
                      <div class="flex justify-end gap-2 whitespace-nowrap text-xs font-medium">
                        <button class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 active:scale-95" @click="openUserPointTransactions(item)">流水</button>
                        <button v-if="item.role !== 'admin'" class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all active:scale-95" :class="item.status === 'active' ? 'hover:border-red-200 hover:bg-red-50 hover:text-red-600' : 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'" @click="requestToggleUser(item)">{{ item.status === 'active' ? '停用' : '恢复' }}</button>
                        <span v-else class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-400">受保护</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table v-if="section === 'resumes'" class="w-full min-w-[800px] text-left text-sm"><thead><tr class="border-b bg-zinc-50 text-xs text-zinc-500"><th class="px-5 py-3">简历</th><th class="px-5 py-3">所属用户</th><th class="px-5 py-3">模板</th><th class="px-5 py-3">语言</th><th class="px-5 py-3">更新时间</th></tr></thead><tbody><tr v-for="item in resumes.items" :key="item.id" class="border-b border-zinc-100 last:border-0"><td class="px-5 py-4"><p class="font-medium">{{ item.title }}</p><p class="text-xs text-zinc-400">#{{ item.id }}</p></td><td class="px-5 py-4"><p>{{ item.username }}</p><p class="text-xs text-zinc-400">{{ item.email }}</p></td><td class="px-5 py-4"><p class="font-medium text-zinc-900">{{ templateNameById(item.template_id) }}</p><p class="mt-0.5 text-xs text-zinc-400">{{ item.template_id }}</p></td><td class="px-5 py-4">{{ {'zh-CN': '简体中文', 'en': '英文'}[item.language] || item.language }}</td><td class="px-5 py-4 text-zinc-500">{{ formatDate(item.update_time) }}</td></tr></tbody></table>

              <table v-if="section === 'ai'" class="w-full min-w-[1200px] text-left text-sm"><thead><tr class="border-b bg-zinc-50 text-xs whitespace-nowrap text-zinc-500"><th class="px-5 py-3">AI 功能</th><th class="px-5 py-3">具体模块</th><th class="px-5 py-3">模型</th><th class="px-5 py-3">用户</th><th class="px-5 py-3">扣点 / Token</th><th class="px-5 py-3">简历 ID</th><th class="px-5 py-3">状态</th><th class="px-5 py-3">时间</th><th class="px-5 py-3">错误</th></tr></thead><tbody><tr v-for="item in aiTasks.items" :key="item.id" class="border-b border-zinc-100 last:border-0"><td class="px-5 py-4 font-medium whitespace-nowrap">{{ taskTypeText(item.task_type) }}</td><td class="px-5 py-4 text-zinc-500 whitespace-nowrap">{{ item.task_type === 'section_optimize' ? sectionText(item.input_data?.section_type) : '—' }}</td><td class="px-5 py-4 whitespace-nowrap"><p class="font-medium text-zinc-800">{{ modelDisplay(item).display || '—' }}</p><p v-if="modelDisplay(item).raw" class="mt-0.5 text-[11px] text-zinc-400">{{ modelDisplay(item).raw }}</p></td><td class="px-5 py-4 whitespace-nowrap">{{ item.username }}</td><td class="px-5 py-4 whitespace-nowrap"><span class="whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{{ item.points_used || 0 }} 点</span><p v-if="tokenUsage(item).total" class="mt-1 whitespace-nowrap text-[11px] text-zinc-500">{{ formatTokenNumber(tokenUsage(item).total) }} tokens</p><p v-if="tokenUsage(item).total" class="mt-0.5 whitespace-nowrap text-[11px] text-zinc-400">入 {{ formatTokenNumber(tokenUsage(item).input) }} · 出 {{ formatTokenNumber(tokenUsage(item).output) }}</p></td><td class="px-5 py-4 text-zinc-500">{{ item.resume_id || '—' }}</td><td class="px-5 py-4 whitespace-nowrap"><span class="whitespace-nowrap rounded-full px-2 py-1 text-xs ring-1 ring-inset" :class="statusClass(item.status)">{{ statusText(item.status) }}</span></td><td class="px-5 py-4 text-zinc-500 whitespace-nowrap">{{ formatDate(item.create_time) }}</td><td class="max-w-sm truncate px-5 py-4 text-xs text-red-600" :title="item.error_message">{{ item.error_message || '—' }}</td></tr></tbody></table>

              <table v-if="section === 'point-transactions'" class="w-full min-w-[1240px] text-left text-sm">
                <thead>
                  <tr class="border-b bg-zinc-50 text-xs text-zinc-500">
                    <th class="px-5 py-3">用户</th>
                    <th class="px-5 py-3">类型</th>
                    <th class="px-5 py-3">模型</th>
                    <th class="px-5 py-3">变动</th>
                    <th class="px-5 py-3">余额</th>
                    <th class="px-5 py-3">Token</th>
                    <th class="px-5 py-3">说明</th>
                    <th class="px-5 py-3">时间</th>
                    <th class="px-5 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in pointTransactions.items" :key="item.id" class="border-b border-zinc-100 last:border-0">
                    <td class="px-5 py-4"><p class="font-medium text-zinc-900">{{ item.username }}</p><p class="mt-0.5 text-xs text-zinc-400">{{ item.email }}</p></td>
                    <td class="px-5 py-4 whitespace-nowrap"><span class="whitespace-nowrap rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">{{ item.feature_name }}</span></td>
                    <td class="px-5 py-4 whitespace-nowrap"><p class="font-medium text-zinc-800">{{ modelDisplay(item).display || '—' }}</p><p v-if="modelDisplay(item).raw" class="mt-0.5 text-[11px] text-zinc-400">{{ modelDisplay(item).raw }}</p></td>
                    <td class="px-5 py-4 whitespace-nowrap"><span class="font-semibold" :class="item.points_delta > 0 ? 'text-emerald-700' : 'text-red-600'">{{ item.points_delta > 0 ? '+' : '' }}{{ item.points_delta }}</span></td>
                    <td class="px-5 py-4 text-zinc-700">{{ item.balance_after }}</td>
                    <td class="px-5 py-4 text-zinc-500">{{ item.tokens_used ? formatTokenNumber(item.tokens_used) : '—' }}</td>
                    <td class="max-w-md truncate px-5 py-4 text-zinc-600" :title="item.description">{{ item.description || '—' }}</td>
                    <td class="px-5 py-4 text-zinc-500 whitespace-nowrap">{{ formatDate(item.create_time) }}</td>
                    <td class="px-5 py-4 text-right whitespace-nowrap">
                      <button v-if="item.can_revoke" class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95" @click="requestRevokeGrant(item)">撤回批次</button>
                      <span v-else class="text-xs text-zinc-300">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table v-if="section === 'feedbacks'" class="w-full min-w-[980px] text-left text-sm"><thead><tr class="border-b bg-zinc-50 text-xs text-zinc-500"><th class="px-5 py-3">所属模块</th><th class="px-5 py-3">用户</th><th class="px-5 py-3">联系方式</th><th class="px-5 py-3">状态</th><th class="px-5 py-3">时间</th><th class="px-5 py-3 text-right">操作</th></tr></thead><tbody><tr v-for="item in feedbacks.items" :key="item.id" class="border-b border-zinc-100 last:border-0"><td class="px-5 py-4"><p class="font-medium text-zinc-900">{{ item.category || '意见反馈' }}</p></td><td class="px-5 py-4"><p>{{ item.username }}</p><p class="mt-0.5 text-xs text-zinc-400">{{ item.email }}</p></td><td class="px-5 py-4 text-zinc-500">{{ item.contact || '—' }}</td><td class="px-5 py-4"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full px-2 py-1 text-xs ring-1 ring-inset" :class="statusClass(item.status === 'resolved' ? 'success' : item.status === 'closed' ? 'disabled' : 'pending')">{{ feedbackStatusText(item.status) }}</span><span v-if="item.admin_reply" class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已回复</span></div></td><td class="px-5 py-4 text-zinc-500">{{ formatDate(item.create_time) }}</td><td class="px-5 py-4 text-right"><button class="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 active:scale-95" @click="openFeedbackReply(item)">处理</button></td></tr></tbody></table>

              <table v-if="section === 'exports'" class="w-full min-w-[800px] text-left text-sm"><thead><tr class="border-b bg-zinc-50 text-xs text-zinc-500"><th class="px-5 py-3">文件</th><th class="px-5 py-3">用户</th><th class="px-5 py-3">格式</th><th class="px-5 py-3">简历 ID</th><th class="px-5 py-3">状态</th><th class="px-5 py-3">时间</th></tr></thead><tbody><tr v-for="item in exports.items" :key="item.id" class="border-b border-zinc-100 last:border-0"><td class="max-w-64 truncate px-5 py-4 font-medium" :title="item.file_name">{{ item.file_name }}</td><td class="px-5 py-4">{{ item.username }}</td><td class="px-5 py-4 uppercase">{{ item.file_type }}</td><td class="px-5 py-4">{{ item.resume_id }}</td><td class="px-5 py-4"><span class="rounded-full px-2 py-1 text-xs ring-1 ring-inset" :class="statusClass(item.status)">{{ statusText(item.status) }}</span></td><td class="px-5 py-4 text-zinc-500">{{ formatDate(item.create_time) }}</td></tr></tbody></table>

              <div v-if="section === 'templates'" class="grid gap-5 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <article v-for="item in templates.items" :key="item.template_id" class="group relative flex flex-col rounded-xl bg-white p-4 border border-zinc-200/60 shadow-sm transition hover:border-zinc-300">
                  <div class="flex items-center justify-between gap-2">
                    <h2 class="text-sm font-medium text-zinc-800 truncate">{{ item.name }}</h2>
                    <span class="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 shrink-0">{{ item.usage_count }} 人</span>
                  </div>

                  <!-- Pure Preview Area -->
                  <div class="mt-3 relative w-full h-36 overflow-hidden rounded-lg bg-zinc-50/50 border border-zinc-100/80 pointer-events-none">
                    <div class="absolute inset-x-0 top-0 w-full">
                      <TemplatePreview :html="item.preview_html" />
                    </div>
                    <div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none"></div>
                  </div>

                  <!-- Pure Controls (No divider line, no bulky boxes) -->
                  <div class="mt-3 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs text-zinc-400 whitespace-nowrap">序号</span>
                      <input
                        :value="item.sort_order"
                        type="number"
                        class="h-7 w-12 rounded bg-zinc-50 px-2 text-xs font-medium text-zinc-700 outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300 transition-all text-center"
                        @change="changeTemplateOrderInput(item, $event)"
                      />
                    </div>

                    <button
                      class="inline-flex h-7 items-center justify-center gap-1 rounded px-2.5 text-xs font-medium transition whitespace-nowrap"
                      :class="item.is_visible ? 'text-zinc-500 hover:bg-zinc-100/80' : 'bg-zinc-900 text-white hover:bg-zinc-800'"
                      @click="updateTemplateDisplay(item, { is_visible: !item.is_visible })"
                    >
                      <EyeOff v-if="item.is_visible" class="h-3.5 w-3.5" />
                      <Eye v-else class="h-3.5 w-3.5" />
                      <span>{{ item.is_visible ? '隐藏' : '已展示' }}</span>
                    </button>
                  </div>
                </article>
              </div>

              <table v-if="section === 'industry-templates'" class="w-full min-w-[900px] table-fixed text-left text-sm">
                <colgroup>
                  <col class="w-[26%]" />
                  <col class="w-[22%]" />
                  <col class="w-[34%]" />
                  <col class="w-[8%]" />
                  <col class="w-[10%]" />
                </colgroup>
                <thead>
                  <tr class="border-b bg-zinc-50/70 text-xs font-medium text-zinc-500">
                    <th class="px-5 py-3">岗位</th>
                    <th class="px-4 py-3">配置</th>
                    <th class="px-4 py-3">内容摘要</th>
                    <th class="px-3 py-3">排序</th>
                    <th class="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in resumeStarters.items" :key="item.starter_id" class="border-b border-zinc-100 transition hover:bg-zinc-50/70 last:border-0">
                    <td class="min-w-0 px-5 py-3">
                      <p class="truncate font-medium text-zinc-900" :title="item.role_title">{{ item.role_title }}</p>
                      <p class="mt-0.5 truncate text-xs text-zinc-400" :title="item.role_subtitle || item.starter_id">{{ item.role_subtitle || item.starter_id }}</p>
                    </td>
                    <td class="min-w-0 px-4 py-3">
                      <p class="truncate text-zinc-700" :title="item.industry_name">{{ item.industry_name }}</p>
                      <p class="mt-0.5 truncate text-xs text-zinc-400" :title="`${item.template_name || item.default_template_id} · ${item.default_template_id}`">{{ item.template_name || item.default_template_id }} · {{ item.default_template_id }}</p>
                    </td>
                    <td class="min-w-0 px-4 py-3 text-zinc-600">
                      <p class="truncate" :title="starterModuleSummary(item)">{{ starterModuleSummary(item) }}</p>
                      <p class="mt-0.5 truncate text-xs text-zinc-400" :title="item.keywords.join(' / ')">{{ starterKeywordSummary(item) }}</p>
                    </td>
                    <td class="px-3 py-3 text-zinc-400">{{ item.sort_order }}</td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex justify-end gap-2 whitespace-nowrap text-xs font-medium">
                        <button class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 active:scale-95" @click="openStarterEditor(item)">编辑</button>
                        <button class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95" @click="requestDeleteStarter(item)">删除</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div v-if="currentPage && !currentPage.items.length" class="flex h-56 items-center justify-center text-sm text-zinc-400">暂无数据</div>
            </div>

            <PaginationFooter
              v-if="currentPage && currentPage.total"
              :page="currentPage.page"
              :total="currentPage.total"
              :page-size="pageSize"
              :page-size-options="pageSizeOptions"
              @update:page="load($event)"
              @update:page-size="pageSize = $event"
              @change="load"
            />
          </div>
        </template>
    <ConfirmDialog
      v-model:open="showConfirm"
      :title="confirmNextStatus === 'disabled' ? '确认停用用户？' : '确认恢复用户？'"
      :description="`你确定要${confirmNextStatus === 'disabled' ? '停用' : '恢复'}用户 “${confirmTarget?.username}” 吗？${confirmNextStatus === 'disabled' ? '停用后该用户将无法登录。' : ''}`"
      :destructive="confirmNextStatus === 'disabled'"
      @confirm="executeToggleUser"
    />

    <ConfirmDialog
      v-model:open="showRevokeGrantConfirm"
      title="确认撤回全员发放？"
      :description="`将撤回批次 ${revokeGrantTarget?.grant_batch_no || ''} 的全员发放。若用户余额不足，将扣到 0，并保留完整撤回流水。`"
      destructive
      @confirm="executeRevokeGrant"
    />

    <PointsAdjustModal
      :open="showPointsModal"
      :mode="pointsModalMode"
      :username="pointsTargetUser?.username"
      @close="showPointsModal = false"
      @confirm="executePointsAdjust"
    />

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        enter-to-class="opacity-100 translate-y-0 sm:scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 sm:scale-100"
        leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      >
        <div v-if="showUserPointTransactions" class="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm" @click.self="closeUserPointTransactions">
          <div class="flex max-h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div class="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
              <div class="min-w-0">
                <h3 class="text-base font-semibold text-zinc-900">点数流水</h3>
                <p class="mt-1 truncate text-xs text-zinc-400">
                  {{ userPointTransactionsTarget?.username }} · {{ userPointTransactionsTarget?.email }} · 当前 {{ formatNumber(userPointTransactionsTarget?.flow_points || 0) }} 点
                </p>
              </div>
              <button class="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" @click="closeUserPointTransactions">
                <X class="h-5 w-5" />
              </button>
            </div>

            <div v-if="userPointTransactionsError" class="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ userPointTransactionsError }}</div>
            <div class="min-h-0 flex-1 overflow-auto">
              <div v-if="userPointTransactionsLoading" class="flex h-56 items-center justify-center text-sm text-zinc-400"><RefreshCw class="mr-2 h-4 w-4 animate-spin" />正在加载流水</div>
              <table v-else class="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr class="border-b bg-zinc-50 text-xs text-zinc-500">
                    <th class="px-5 py-3">类型</th>
                    <th class="px-5 py-3">模型</th>
                    <th class="px-5 py-3">变动</th>
                    <th class="px-5 py-3">余额</th>
                    <th class="px-5 py-3">Token</th>
                    <th class="px-5 py-3">说明</th>
                    <th class="px-5 py-3">时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in userPointTransactions.items" :key="item.id" class="border-b border-zinc-100 last:border-0">
                    <td class="px-5 py-4 whitespace-nowrap"><span class="whitespace-nowrap rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">{{ item.feature_name }}</span></td>
                    <td class="px-5 py-4 whitespace-nowrap"><p class="font-medium text-zinc-800">{{ modelDisplay(item).display || '—' }}</p><p v-if="modelDisplay(item).raw" class="mt-0.5 text-[11px] text-zinc-400">{{ modelDisplay(item).raw }}</p></td>
                    <td class="px-5 py-4 whitespace-nowrap"><span class="font-semibold" :class="item.points_delta > 0 ? 'text-emerald-700' : 'text-red-600'">{{ item.points_delta > 0 ? '+' : '' }}{{ item.points_delta }}</span></td>
                    <td class="px-5 py-4 text-zinc-700">{{ item.balance_after }}</td>
                    <td class="px-5 py-4 text-zinc-500">{{ item.tokens_used ? formatTokenNumber(item.tokens_used) : '—' }}</td>
                    <td class="max-w-md truncate px-5 py-4 text-zinc-600" :title="item.description">{{ item.description || '—' }}</td>
                    <td class="px-5 py-4 text-zinc-500 whitespace-nowrap">{{ formatDate(item.create_time) }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="!userPointTransactionsLoading && !userPointTransactions.items.length" class="flex h-48 items-center justify-center text-sm text-zinc-400">暂无点数流水</div>
            </div>

            <PaginationFooter
              :page="userPointTransactions.page"
              :total="userPointTransactions.total"
              :page-size="userPointTransactions.page_size"
              :page-size-options="pageSizeOptions"
              @update:page="userPointTransactions.page = $event"
              @update:page-size="userPointTransactions.page_size = $event"
              @change="loadUserPointTransactions"
            />
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        enter-to-class="opacity-100 translate-y-0 sm:scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 sm:scale-100"
        leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      >
        <div v-if="showStarterEditor" class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm" @click.self="closeStarterEditor">
          <div class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div class="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
              <div>
                <h3 class="text-base font-semibold text-zinc-900">{{ starterEditorMode === "create" ? "新增岗位预设" : "编辑岗位预设" }}</h3>
                <p class="mt-1 text-xs text-zinc-400">{{ starterForm.role_title || "配置岗位内容、默认模板和生成模块" }}</p>
              </div>
              <button class="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" @click="closeStarterEditor">
                <X class="h-5 w-5" />
              </button>
            </div>

            <div class="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[340px_minmax(0,1fr)]">
              <aside class="space-y-4 border-b border-zinc-100 bg-zinc-50/60 p-5 lg:border-b-0 lg:border-r">
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">岗位预设 ID</label>
                  <input v-model.trim="starterForm.starter_id" :disabled="starterEditorMode === 'edit'" placeholder="留空自动生成" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-zinc-600">岗位名称</label>
                    <input v-model.trim="starterForm.role_title" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                  </div>
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-zinc-600">排序</label>
                    <input v-model.number="starterForm.sort_order" type="number" min="0" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">岗位副标题</label>
                  <input v-model.trim="starterForm.role_subtitle" placeholder="例如：Web / 小程序 / 中后台" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">行业分组</label>
                  <Select v-model="starterForm.industry_id" :options="starterIndustryOptions" class="h-10 w-full rounded-xl bg-white" @change="applyIndustryToStarterForm" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-zinc-600">行业 ID</label>
                    <input v-model.trim="starterForm.industry_id" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                  </div>
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-zinc-600">行业名称</label>
                    <input v-model.trim="starterForm.industry_name" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">默认简历模板</label>
                  <Select v-model="starterForm.default_template_id" :options="starterTemplateOptions" class="h-10 w-full rounded-xl bg-white" />
                </div>
                <label class="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                  <input v-model="starterForm.is_visible" type="checkbox" class="h-4 w-4 rounded border-zinc-300" />
                  前台可见
                </label>
              </aside>

              <div class="space-y-5 p-5">
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">行业描述</label>
                  <textarea v-model="starterForm.industry_description" rows="2" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                </div>
                <div class="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-zinc-600">岗位关键词</label>
                    <textarea v-model="starterForm.keywords_text" rows="4" placeholder="一行一个，或用逗号分隔" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                  </div>
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-zinc-600">起稿关注点</label>
                    <textarea v-model="starterForm.focus_text" rows="4" placeholder="突出什么、避免什么、如何表达" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">生成模块</label>
                  <textarea v-model="starterForm.modules_text" rows="3" placeholder="summary|个人简介" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 font-mono text-xs leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">个人简介初稿</label>
                  <textarea v-model="starterForm.summary" rows="3" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">经验阶段配置 JSON</label>
                  <textarea
                    v-model="starterForm.level_variants_text"
                    rows="8"
                    placeholder='{"fresh":{"summary":"...","work_title":"实习/实践经历"},"senior":{"summary_suffix":"...","work_title":"核心工作经历"}}'
                    class="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3.5 py-3 font-mono text-xs leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  ></textarea>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">专业技能</label>
                  <textarea v-model="starterForm.skills_text" rows="5" placeholder="能力名称 | 关键词1, 关键词2 | 能力描述" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                </div>
                <div class="grid gap-4 lg:grid-cols-2">
                  <div class="space-y-3">
                    <label class="block text-xs font-medium text-zinc-600">工作经历样例</label>
                    <input v-model.trim="starterForm.work_position" placeholder="职位名称" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                    <textarea v-model="starterForm.work_description" rows="3" placeholder="工作描述" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                    <textarea v-model="starterForm.work_highlights_text" rows="4" placeholder="工作亮点，一行一个" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                  </div>
                  <div class="space-y-3">
                    <label class="block text-xs font-medium text-zinc-600">项目经历样例</label>
                    <input v-model.trim="starterForm.project_name" placeholder="项目名称" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                    <div class="grid grid-cols-2 gap-3">
                      <input v-model.trim="starterForm.project_role" placeholder="项目角色" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                      <input v-model.trim="starterForm.project_tech_stack" placeholder="技术/工具/方法" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                    </div>
                    <textarea v-model="starterForm.project_description" rows="3" placeholder="项目描述" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                    <textarea v-model="starterForm.project_highlights_text" rows="4" placeholder="项目亮点，一行一个" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
              <button class="h-10 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50" @click="closeStarterEditor">取消</button>
              <button class="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60" :disabled="starterSaving" @click="saveStarter">
                <RefreshCw v-if="starterSaving" class="h-4 w-4 animate-spin" />
                保存
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      v-model:open="showStarterDeleteConfirm"
      title="确认删除岗位预设？"
      :description="`删除后「${starterDeleteTarget?.role_title || ''}」不会再出现在前台岗位起稿里。`"
      destructive
      @confirm="executeDeleteStarter"
    />

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        enter-to-class="opacity-100 translate-y-0 sm:scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 sm:scale-100"
        leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      >
        <div v-if="showFeedbackReply" class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm" @click.self="closeFeedbackReply">
          <div class="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl transform transition-all">
            <div class="px-6 py-4 flex items-center justify-between border-b border-zinc-100">
              <div>
                <h3 class="font-semibold text-zinc-900 text-base">处理反馈</h3>
                <p class="mt-0.5 text-xs text-zinc-400">{{ feedbackReplyTarget?.username }} · {{ feedbackReplyTarget?.email }} · {{ feedbackReplyTarget?.category || '意见反馈' }}</p>
              </div>
              <button @click="closeFeedbackReply" class="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors">
                <X class="w-5 h-5" />
              </button>
            </div>

            <div class="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px]">
              <div class="border-b border-zinc-100 p-6 lg:border-b-0 lg:border-r">
                <div class="mb-4 flex flex-wrap items-center gap-2">
                  <span class="rounded-full px-2 py-1 text-xs ring-1 ring-inset" :class="statusClass(feedbackReplyTarget?.status === 'resolved' ? 'success' : feedbackReplyTarget?.status === 'closed' ? 'disabled' : 'pending')">{{ feedbackStatusText(feedbackReplyTarget?.status || '') }}</span>
                  <span v-if="feedbackReplyTarget?.admin_reply" class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已回复</span>
                  <span class="text-xs text-zinc-400">{{ feedbackReplyTarget?.create_time ? formatDate(feedbackReplyTarget.create_time) : '' }}</span>
                </div>
                <h4 class="mb-3 text-sm font-semibold text-zinc-900">反馈内容</h4>
                <div class="prose prose-sm max-w-none prose-zinc text-zinc-700 [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-xl" v-html="sanitizeFeedbackHtml(feedbackReplyTarget?.content)"></div>
              </div>

              <div class="space-y-4 bg-zinc-50/40 p-6">
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">处理状态</label>
                  <Select v-model="feedbackReplyForm.status" :options="feedbackEditStatusOptions" class="h-10 w-full rounded-lg bg-white" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">用户可见回复</label>
                  <textarea v-model="feedbackReplyForm.admin_reply" rows="6" placeholder="写给用户看的处理结果或说明" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                  <p v-if="feedbackReplyTarget?.reply_time" class="mt-1.5 text-[11px] text-zinc-400">上次回复：{{ formatDate(feedbackReplyTarget.reply_time) }}</p>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-zinc-600">内部处理备注</label>
                  <textarea v-model="feedbackReplyForm.admin_note" rows="4" placeholder="仅管理员后台可见，可留空" class="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"></textarea>
                </div>
              </div>
            </div>

            <div class="px-4 sm:px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex flex-wrap justify-end gap-2">
              <button @click="closeFeedbackReply" class="h-10 px-4 sm:px-5 rounded-xl font-medium text-sm border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0">取消</button>
              <button @click="sendFeedbackResultEmail" :disabled="feedbackEmailSending || feedbackReplySaving || !feedbackReplyForm.admin_reply.trim()" class="inline-flex h-10 items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 sm:px-5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0">
                <RefreshCw v-if="feedbackEmailSending" class="h-4 w-4 animate-spin shrink-0" />
                保存并发邮件
              </button>
              <button @click="saveFeedbackReply" :disabled="feedbackReplySaving || feedbackEmailSending" class="inline-flex h-10 items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-zinc-900 px-5 sm:px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0">
                <RefreshCw v-if="feedbackReplySaving" class="h-4 w-4 animate-spin shrink-0" />
                保存处理
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AdminShell>
</template>
