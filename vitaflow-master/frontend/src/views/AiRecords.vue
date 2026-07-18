<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { Activity, FileSearch, History, Languages, LoaderCircle, MessageSquare, RefreshCw, ScrollText, Send, TicketCheck, X } from "lucide-vue-next"
import AppLayout from "@/components/layout/AppLayout.vue"
import Button from "@/components/ui/button/Button.vue"
import FlowPointIcon from "@/components/ui/FlowPointIcon.vue"
import Input from "@/components/ui/input/Input.vue"
import Select from "@/components/ui/select/Select.vue"
import { showGlobalToast } from "@/utils/toast"
import {
  getFlowPointSummaryApi,
  getFlowPointTransactionsApi,
  getMyAiHistoriesApi,
  getMyAiRecordsApi,
  redeemFlowPointsApi,
  type AiRecord,
  type FlowPointSummary,
  type FlowPointTransaction,
} from "@/api/ai"

type TabKey = "records" | "points" | "histories"
type PageData<T> = { items: T[]; total: number; page: number; page_size: number }

const tabs: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: "records", label: "调用记录", icon: Activity },
  { key: "points", label: "消费明细", icon: FlowPointIcon },
  { key: "histories", label: "生成历史", icon: History },
]

const featureOptions = [
  { value: "", label: "全部功能" },
  { value: "generate_resume", label: "AI 简历生成" },
  { value: "import_resume", label: "导入简历" },
  { value: "ai_chat", label: "AI 对话" },
  { value: "resume_score", label: "简历诊断" },
  { value: "jd_optimize", label: "JD 优化" },
  { value: "resume_translate", label: "简历翻译" },
  { value: "section_optimize", label: "AI 润色" },
  { value: "redeem", label: "兑换码充值" },
  { value: "admin_grant_all", label: "全员发放" },
  { value: "admin_grant_all_revoke", label: "全员发放撤回" },
  { value: "admin_adjust", label: "管理员调整" },
  { value: "signup_gift", label: "注册赠送" },
]

const activeTab = ref<TabKey>("records")
const summary = ref<FlowPointSummary | null>(null)
const records = ref<PageData<AiRecord>>({ items: [], total: 0, page: 1, page_size: 10 })
const transactions = ref<PageData<FlowPointTransaction>>({ items: [], total: 0, page: 1, page_size: 10 })
const scoreHistories = ref<PageData<AiRecord>>({ items: [], total: 0, page: 1, page_size: 8 })
const jdHistories = ref<PageData<AiRecord>>({ items: [], total: 0, page: 1, page_size: 8 })
const translationHistories = ref<PageData<AiRecord>>({ items: [], total: 0, page: 1, page_size: 8 })
const loading = ref(false)
const redeeming = ref(false)
const error = ref("")
const redeemCode = ref("")
const redeemMessage = ref("")
const featureType = ref("")
const selectedHistory = ref<AiRecord | null>(null)

const rules = computed(() => summary.value?.rules || [])
const balance = computed(() => summary.value?.balance || 0)

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : ""
}

function totalPages(data: PageData<unknown>) {
  return Math.max(1, Math.ceil(data.total / data.page_size))
}

function pageRangeText(data: PageData<unknown>) {
  if (!data.total) return "共 0 条"
  const start = (data.page - 1) * data.page_size + 1
  const end = Math.min(data.page * data.page_size, data.total)
  return `第 ${start}-${end} 条，共 ${data.total} 条`
}

function resumeDisplayName(item: AiRecord, fallback = "—") {
  if (item.resume_title) return item.resume_title
  if (item.resume_id) return `已删除简历 #${item.resume_id}`
  return fallback
}

function chatModelText(item: { task_type?: string; feature_type?: string; model_name?: string | null }) {
  const type = item.task_type || item.feature_type
  return type === "ai_chat" && item.model_name ? `模型：${item.model_name}` : ""
}

function statusText(status: string) {
  if (status === "success") return "成功"
  if (status === "failed") return "失败"
  if (status === "running") return "进行中"
  return "等待中"
}

function statusClass(status: string) {
  if (status === "success") return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (status === "failed") return "bg-red-50 text-red-700 ring-red-200"
  if (status === "running") return "bg-blue-50 text-blue-700 ring-blue-200"
  return "bg-zinc-100 text-zinc-600 ring-zinc-200"
}

function resultPayload(record: AiRecord | null): Record<string, any> {
  if (!record?.output_data) return {}
  const output = record.output_data as Record<string, any>
  const result = output.result
  if (result && typeof result === "object" && !Array.isArray(result) && "result" in result) {
    return result.result && typeof result.result === "object" ? result.result : result
  }
  return result && typeof result === "object" ? result : output
}

function hasReadableResult(record: AiRecord) {
  const payload = resultPayload(record)
  return record.status === "success" && Object.keys(payload).length > 0
}

function cleanText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return ""
}

function toTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim()
        if (item && typeof item === "object") {
          const data = item as Record<string, unknown>
          return cleanText(data.comment || data.summary || data.text || data.content || data.suggestion)
        }
        return ""
      })
      .filter(Boolean)
  }
  const text = cleanText(value)
  return text ? text.split(/\n+/).map((item) => item.replace(/^[-•\d.\s]+/, "").trim()).filter(Boolean) : []
}

function scoreDetails(record: AiRecord) {
  const payload = resultPayload(record)
  const details = Array.isArray(payload.details) ? payload.details : []
  return details.map((item: Record<string, unknown>) => ({
    dimension: cleanText(item.dimension) || "评分维度",
    score: Number(item.score ?? 0),
    maxScore: Number(item.max_score ?? item.maxScore ?? 100),
    comment: cleanText(item.comment),
  }))
}

function resultSummary(record: AiRecord) {
  const payload = resultPayload(record)
  const score = Number(payload.score ?? 0)
  const summaryText = cleanText(payload.summary)
  const suggestions = toTextList(payload.suggestions)
  if (record.task_type === "resume_score") {
    return `${score || 0} 分${summaryText ? ` · ${summaryText}` : ""}`
  }
  if (record.task_type === "jd_optimize") {
    return `${score ? `${score} 分 · ` : ""}${suggestions[0] || "已保存 JD 优化结果"}`
  }
  if (record.task_type === "resume_translate") {
    return summaryText || "已保存简历翻译结果"
  }
  return summaryText || suggestions[0] || "已保存生成结果"
}

function scoreSuggestions(record: AiRecord) {
  const payload = resultPayload(record)
  return toTextList(payload.suggestions)
}

function scoreStrengths(record: AiRecord) {
  const payload = resultPayload(record)
  return toTextList(payload.strengths)
}

function scoreWeaknesses(record: AiRecord) {
  const payload = resultPayload(record)
  return toTextList(payload.weaknesses)
}

function jdSuggestions(record: AiRecord) {
  const payload = resultPayload(record)
  return toTextList(payload.suggestions)
}

function genericResultLines(record: AiRecord) {
  const payload = resultPayload(record)
  return [
    cleanText(payload.summary),
    cleanText(payload.explanation),
    ...toTextList(payload.changes),
    ...toTextList(payload.suggestions),
    ...toTextList(payload.warnings),
  ].filter(Boolean)
}

async function loadSummary() {
  summary.value = await getFlowPointSummaryApi()
}

async function loadRecords(page = records.value.page) {
  records.value = await getMyAiRecordsApi({ page, page_size: records.value.page_size, task_type: featureType.value || undefined })
}

async function loadTransactions(page = transactions.value.page) {
  transactions.value = await getFlowPointTransactionsApi({ page, page_size: transactions.value.page_size, feature_type: featureType.value || undefined })
}

async function loadHistories() {
  const [scoreData, jdData, translationData] = await Promise.all([
    getMyAiHistoriesApi({ task_type: "resume_score", page: scoreHistories.value.page, page_size: scoreHistories.value.page_size }),
    getMyAiHistoriesApi({ task_type: "jd_optimize", page: jdHistories.value.page, page_size: jdHistories.value.page_size }),
    getMyAiHistoriesApi({ task_type: "resume_translate", page: translationHistories.value.page, page_size: translationHistories.value.page_size }),
  ])
  scoreHistories.value = scoreData
  jdHistories.value = jdData
  translationHistories.value = translationData
}

async function loadScoreHistories(page = scoreHistories.value.page) {
  scoreHistories.value = await getMyAiHistoriesApi({ task_type: "resume_score", page, page_size: scoreHistories.value.page_size })
}

async function loadJdHistories(page = jdHistories.value.page) {
  jdHistories.value = await getMyAiHistoriesApi({ task_type: "jd_optimize", page, page_size: jdHistories.value.page_size })
}

async function loadTranslationHistories(page = translationHistories.value.page) {
  translationHistories.value = await getMyAiHistoriesApi({ task_type: "resume_translate", page, page_size: translationHistories.value.page_size })
}

async function runPageLoad(action: () => Promise<void>) {
  loading.value = true
  error.value = ""
  try {
    await action()
  } catch (err: any) {
    error.value = err.message || "数据加载失败"
  } finally {
    loading.value = false
  }
}

function resetPages() {
  records.value.page = 1
  transactions.value.page = 1
  scoreHistories.value.page = 1
  jdHistories.value.page = 1
  translationHistories.value.page = 1
}

async function refresh() {
  loading.value = true
  error.value = ""
  try {
    await loadSummary()
    if (activeTab.value === "records") await loadRecords(1)
    if (activeTab.value === "points") await loadTransactions(1)
    if (activeTab.value === "histories") await loadHistories()
  } catch (err: any) {
    error.value = err.message || "数据加载失败"
  } finally {
    loading.value = false
  }
}

async function switchTab(tab: TabKey) {
  activeTab.value = tab
  await refresh()
}

async function changeRecordsPage(page: number) {
  await runPageLoad(() => loadRecords(page))
}

async function changeTransactionsPage(page: number) {
  await runPageLoad(() => loadTransactions(page))
}

async function changeScoreHistoryPage(page: number) {
  await runPageLoad(() => loadScoreHistories(page))
}

async function changeJdHistoryPage(page: number) {
  await runPageLoad(() => loadJdHistories(page))
}

async function changeTranslationHistoryPage(page: number) {
  await runPageLoad(() => loadTranslationHistories(page))
}

async function changeFeatureFilter() {
  resetPages()
  await refresh()
}

async function redeem() {
  const code = redeemCode.value.trim()
  if (!code || redeeming.value) return
  redeeming.value = true
  redeemMessage.value = ""
  error.value = ""
  try {
    const result = await redeemFlowPointsApi(code)
    showGlobalToast(`兑换成功，获得 ${result.points} Flow Points`, "success")
    redeemCode.value = ""
    await loadSummary()
    await loadTransactions(1)
  } catch (err: any) {
    showGlobalToast(err.message || "兑换失败", "error")
  } finally {
    redeeming.value = false
  }
}

function formatRuleCost(rule: any): string {
  if (rule.feature_type === "ai_chat" || rule.display_name === "AI 对话") {
    return "按模型计费"
  }
  const base = rule.points_per_call || 0
  const inputRate = rule.points_per_million_input_tokens ?? rule.points_per_million_tokens ?? 0
  const outputRate = rule.points_per_million_output_tokens ?? rule.points_per_million_tokens ?? 0
  const parts: string[] = []
  if (base > 0) parts.push(`每次 ${base} 点`)
  if (inputRate > 0) parts.push(`输入 ${inputRate} 点/百万Tokens`)
  if (outputRate > 0) parts.push(`输出 ${outputRate} 点/百万Tokens`)
  if (parts.length) {
    return parts.join(" + ")
  }
  return '按实际使用扣减'
}

onMounted(() => refresh())
</script>

<template>
  <AppLayout>
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header class="mb-7">
        <div>
          <p class="mb-1.5 sm:mb-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-zinc-400">AI Usage</p>
          <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Flow Points</h1>
          <p class="mt-1.5 sm:mt-2 text-xs sm:text-sm text-zinc-500">兑换 Flow Points 和 查看流水记录</p>
        </div>
      </header>

      <div v-if="error" class="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>

      <section class="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div class="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div class="flex items-start justify-between gap-4 sm:gap-6 p-5 sm:p-6">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-zinc-500">当前余额</p>
              <p class="mt-3 text-5xl font-semibold tracking-tight text-zinc-950">{{ balance }}</p>
              <div class="ai-records-hint mt-2 text-sm text-zinc-700 break-words whitespace-pre-wrap" v-html="summary?.hint || '1 元约等于 100 Flow Points，具体扣点以后台规则为准。'"></div>
            </div>
            <span class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-md shadow-zinc-200/50 border border-zinc-100 ring-1 ring-blue-600/10 hover:shadow-lg hover:shadow-zinc-200/80 hover:scale-[1.02] transition-all duration-300 group">
              <FlowPointIcon class="relative h-7 w-7 text-blue-600 transform group-hover:rotate-3 transition-transform duration-300" />
            </span>
          </div>
          <div class="border-t border-zinc-100 bg-zinc-50/70 p-4">
            <div class="flex flex-col gap-3 sm:flex-row">
              <input v-model="redeemCode" type="text" class="h-11 w-full sm:flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 shadow-sm" placeholder="输入 Flow Points 兑换码" @keyup.enter="redeem" />
              <Button class="h-11 bg-zinc-900 px-5 text-white hover:bg-zinc-800" :disabled="redeeming || !redeemCode.trim()" @click="redeem">
                <LoaderCircle v-if="redeeming" class="h-4 w-4 animate-spin" />
                <TicketCheck v-else class="h-4 w-4" />
                立即兑换
              </Button>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div class="mb-4 flex items-center gap-2">
            <ScrollText class="h-4 w-4 text-zinc-500" />
            <h2 class="font-semibold text-zinc-900">扣点规则</h2>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <div v-for="rule in rules" :key="rule.feature_type" class="rounded-2xl bg-zinc-50 px-4 py-3">
              <p class="text-sm font-medium text-zinc-900">{{ rule.display_name }}</p>
              <p class="mt-1 text-xs text-zinc-500">{{ formatRuleCost(rule) }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div class="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex w-full sm:w-auto bg-zinc-100 p-1 rounded-full shadow-inner">
            <button v-for="tab in tabs" :key="tab.key" class="flex-1 sm:flex-none inline-flex h-8 sm:h-9 items-center justify-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap" :class="activeTab === tab.key ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'" @click="switchTab(tab.key)">
              <component :is="tab.icon" class="h-3.5 w-3.5" />
              {{ tab.label }}
            </button>
          </div>
          <div v-if="activeTab !== 'histories'" class="w-full sm:w-40 shrink-0">
            <Select v-model="featureType" :options="featureOptions" class="w-full h-9 sm:h-10 rounded-full bg-zinc-50 border-zinc-200 text-xs sm:text-sm" @change="changeFeatureFilter" />
          </div>
        </div>

        <div v-if="loading" class="flex h-72 items-center justify-center text-sm text-zinc-400">
          <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
          正在加载
        </div>

        <div v-else-if="activeTab === 'records'" class="overflow-x-auto">
          <table class="w-full min-w-[780px] text-left text-sm">
            <thead class="bg-zinc-50 text-xs text-zinc-500"><tr><th class="px-5 py-3">功能</th><th class="px-5 py-3">简历</th><th class="px-5 py-3">消费</th><th class="px-5 py-3">状态</th><th class="px-5 py-3">时间</th><th class="px-5 py-3">错误</th></tr></thead>
            <tbody>
              <tr v-for="item in records.items" :key="item.id" class="border-t border-zinc-100">
                <td class="px-5 py-4 whitespace-nowrap"><p class="font-medium text-zinc-900">{{ item.task_label }}</p><p v-if="chatModelText(item)" class="mt-1 text-xs font-normal text-zinc-400">{{ chatModelText(item) }}</p></td>
                <td class="px-5 py-4 text-zinc-500">{{ resumeDisplayName(item) }}</td>
                <td class="px-5 py-4 whitespace-nowrap"><span class="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{{ item.points_used }} 点</span></td>
                <td class="px-5 py-4 whitespace-nowrap"><span class="whitespace-nowrap rounded-full px-2 py-1 text-xs ring-1 ring-inset" :class="statusClass(item.status)">{{ statusText(item.status) }}</span></td>
                <td class="px-5 py-4 text-zinc-500">{{ formatDate(item.create_time) }}</td>
                <td class="max-w-64 truncate px-5 py-4 text-xs text-red-600" :title="item.error_message">{{ item.error_message || '—' }}</td>
              </tr>
              <tr v-if="!records.items.length"><td colspan="6" class="h-56 text-center text-zinc-400">暂无调用记录</td></tr>
            </tbody>
          </table>
          <footer v-if="records.total > records.page_size" class="sticky left-0 flex min-w-[780px] items-center justify-between border-t border-zinc-100 bg-white px-5 py-3 text-sm text-zinc-500">
            <span>{{ pageRangeText(records) }} · 第 {{ records.page }} / {{ totalPages(records) }} 页</span>
            <div class="flex gap-2">
              <Button variant="outline" size="sm" :disabled="loading || records.page <= 1" @click="changeRecordsPage(records.page - 1)">上一页</Button>
              <Button variant="outline" size="sm" :disabled="loading || records.page >= totalPages(records)" @click="changeRecordsPage(records.page + 1)">下一页</Button>
            </div>
          </footer>
        </div>

        <div v-else-if="activeTab === 'points'" class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="bg-zinc-50 text-xs text-zinc-500"><tr><th class="px-5 py-3">功能</th><th class="px-5 py-3">变动</th><th class="px-5 py-3">余额</th><th class="px-5 py-3">说明</th><th class="px-5 py-3">时间</th></tr></thead>
            <tbody>
              <tr v-for="item in transactions.items" :key="item.id" class="border-t border-zinc-100">
                <td class="px-5 py-4 whitespace-nowrap"><p class="font-medium text-zinc-900">{{ featureOptions.find((option) => option.value === item.feature_type)?.label || item.feature_type }}</p><p v-if="chatModelText(item)" class="mt-1 text-xs font-normal text-zinc-400">{{ chatModelText(item) }}</p></td>
                <td class="px-5 py-4 whitespace-nowrap"><span class="font-semibold" :class="item.points_delta >= 0 ? 'text-emerald-700' : 'text-red-600'">{{ item.points_delta > 0 ? '+' : '' }}{{ item.points_delta }}</span></td>
                <td class="px-5 py-4 text-zinc-500">{{ item.balance_after }}</td>
                <td class="px-5 py-4 text-zinc-500">{{ item.description }}</td>
                <td class="px-5 py-4 text-zinc-500">{{ formatDate(item.create_time) }}</td>
              </tr>
              <tr v-if="!transactions.items.length"><td colspan="5" class="h-56 text-center text-zinc-400">暂无扣点流水</td></tr>
            </tbody>
          </table>
          <footer v-if="transactions.total > transactions.page_size" class="sticky left-0 flex min-w-[760px] items-center justify-between border-t border-zinc-100 bg-white px-5 py-3 text-sm text-zinc-500">
            <span>{{ pageRangeText(transactions) }} · 第 {{ transactions.page }} / {{ totalPages(transactions) }} 页</span>
            <div class="flex gap-2">
              <Button variant="outline" size="sm" :disabled="loading || transactions.page <= 1" @click="changeTransactionsPage(transactions.page - 1)">上一页</Button>
              <Button variant="outline" size="sm" :disabled="loading || transactions.page >= totalPages(transactions)" @click="changeTransactionsPage(transactions.page + 1)">下一页</Button>
            </div>
          </footer>
        </div>

        <div v-else class="grid gap-4 p-5 xl:grid-cols-3">
          <section class="rounded-2xl border border-zinc-200">
            <h3 class="border-b border-zinc-100 px-4 py-3 font-semibold text-zinc-900">简历诊断历史</h3>
            <div class="divide-y divide-zinc-100">
              <div v-for="item in scoreHistories.items" :key="item.id" class="px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-zinc-900">{{ resumeDisplayName(item, '未关联简历') }}</p>
                    <p class="mt-1 text-xs text-zinc-500">{{ statusText(item.status) }}</p>
                    <p v-if="hasReadableResult(item)" class="mt-2 line-clamp-2 text-sm text-zinc-600">{{ resultSummary(item) }}</p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-2">
                    <span class="text-xs text-zinc-400">{{ formatDate(item.create_time) }}</span>
                    <Button v-if="hasReadableResult(item)" variant="outline" size="sm" class="h-8 rounded-full px-3 text-xs" @click="selectedHistory = item"><FileSearch class="h-3.5 w-3.5" />查看结果</Button>
                  </div>
                </div>
              </div>
              <div v-if="!scoreHistories.items.length" class="py-16 text-center text-sm text-zinc-400">暂无诊断历史</div>
            </div>
            <footer v-if="scoreHistories.total > scoreHistories.page_size" class="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              <span>{{ pageRangeText(scoreHistories) }}</span>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" :disabled="loading || scoreHistories.page <= 1" @click="changeScoreHistoryPage(scoreHistories.page - 1)">上一页</Button>
                <Button variant="outline" size="sm" :disabled="loading || scoreHistories.page >= totalPages(scoreHistories)" @click="changeScoreHistoryPage(scoreHistories.page + 1)">下一页</Button>
              </div>
            </footer>
          </section>
          <section class="rounded-2xl border border-zinc-200">
            <h3 class="border-b border-zinc-100 px-4 py-3 font-semibold text-zinc-900">JD 优化历史</h3>
            <div class="divide-y divide-zinc-100">
              <div v-for="item in jdHistories.items" :key="item.id" class="px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-zinc-900">{{ resumeDisplayName(item, '未关联简历') }}</p>
                    <p class="mt-1 text-xs text-zinc-500">{{ statusText(item.status) }}</p>
                    <p v-if="hasReadableResult(item)" class="mt-2 line-clamp-2 text-sm text-zinc-600">{{ resultSummary(item) }}</p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-2">
                    <span class="text-xs text-zinc-400">{{ formatDate(item.create_time) }}</span>
                    <Button v-if="hasReadableResult(item)" variant="outline" size="sm" class="h-8 rounded-full px-3 text-xs" @click="selectedHistory = item"><FileSearch class="h-3.5 w-3.5" />查看结果</Button>
                  </div>
                </div>
              </div>
              <div v-if="!jdHistories.items.length" class="py-16 text-center text-sm text-zinc-400">暂无 JD 优化历史</div>
            </div>
            <footer v-if="jdHistories.total > jdHistories.page_size" class="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              <span>{{ pageRangeText(jdHistories) }}</span>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" :disabled="loading || jdHistories.page <= 1" @click="changeJdHistoryPage(jdHistories.page - 1)">上一页</Button>
                <Button variant="outline" size="sm" :disabled="loading || jdHistories.page >= totalPages(jdHistories)" @click="changeJdHistoryPage(jdHistories.page + 1)">下一页</Button>
              </div>
            </footer>
          </section>
          <section class="rounded-2xl border border-zinc-200">
            <h3 class="border-b border-zinc-100 px-4 py-3 font-semibold text-zinc-900">简历翻译历史</h3>
            <div class="divide-y divide-zinc-100">
              <div v-for="item in translationHistories.items" :key="item.id" class="px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-zinc-900">{{ resumeDisplayName(item, '未关联简历') }}</p>
                    <p class="mt-1 text-xs text-zinc-500">{{ statusText(item.status) }}</p>
                    <p v-if="hasReadableResult(item)" class="mt-2 line-clamp-2 text-sm text-zinc-600">{{ resultSummary(item) }}</p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-2">
                    <span class="text-xs text-zinc-400">{{ formatDate(item.create_time) }}</span>
                    <Button v-if="hasReadableResult(item)" variant="outline" size="sm" class="h-8 rounded-full px-3 text-xs" @click="selectedHistory = item"><Languages class="h-3.5 w-3.5" />查看结果</Button>
                  </div>
                </div>
              </div>
              <div v-if="!translationHistories.items.length" class="py-16 text-center text-sm text-zinc-400">暂无翻译历史</div>
            </div>
            <footer v-if="translationHistories.total > translationHistories.page_size" class="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              <span>{{ pageRangeText(translationHistories) }}</span>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" :disabled="loading || translationHistories.page <= 1" @click="changeTranslationHistoryPage(translationHistories.page - 1)">上一页</Button>
                <Button variant="outline" size="sm" :disabled="loading || translationHistories.page >= totalPages(translationHistories)" @click="changeTranslationHistoryPage(translationHistories.page + 1)">下一页</Button>
              </div>
            </footer>
          </section>
        </div>
      </section>

      <div v-if="selectedHistory" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-6 backdrop-blur-sm" @click.self="selectedHistory = null">
        <article class="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <header class="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">AI Result</p>
              <h2 class="mt-1 text-xl font-semibold text-zinc-950">{{ selectedHistory.task_label }}结果</h2>
              <p class="mt-1 text-sm text-zinc-500">{{ resumeDisplayName(selectedHistory, '未关联简历') }} · {{ formatDate(selectedHistory.create_time) }}</p>
            </div>
            <button class="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" @click="selectedHistory = null"><X class="h-5 w-5" /></button>
          </header>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <template v-if="selectedHistory.task_type === 'resume_score'">
              <div class="rounded-2xl bg-zinc-950 p-5 text-white">
                <p class="text-sm text-zinc-300">综合评分</p>
                <p class="mt-2 text-4xl font-semibold">{{ Number(resultPayload(selectedHistory).score || 0) }}<span class="ml-1 text-base text-zinc-400">/100</span></p>
                <p v-if="resultPayload(selectedHistory).summary" class="mt-3 text-sm leading-6 text-zinc-200">{{ resultPayload(selectedHistory).summary }}</p>
              </div>
              <div class="mt-5 grid gap-3 md:grid-cols-2">
                <article v-for="detail in scoreDetails(selectedHistory)" :key="detail.dimension" class="rounded-2xl border border-zinc-200 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <h3 class="font-semibold text-zinc-900">{{ detail.dimension }}</h3>
                    <span class="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{{ detail.score }}/{{ detail.maxScore }}</span>
                  </div>
                  <p class="mt-3 text-sm leading-6 text-zinc-600">{{ detail.comment || '暂无详细评价' }}</p>
                </article>
              </div>
              <div class="mt-5 grid gap-4 md:grid-cols-3">
                <section class="rounded-2xl bg-emerald-50 p-4">
                  <h3 class="font-semibold text-emerald-900">优势</h3>
                  <ul class="mt-3 space-y-2 text-sm text-emerald-800"><li v-for="item in scoreStrengths(selectedHistory)" :key="item">• {{ item }}</li><li v-if="!scoreStrengths(selectedHistory).length" class="text-emerald-700/70">暂无记录</li></ul>
                </section>
                <section class="rounded-2xl bg-amber-50 p-4">
                  <h3 class="font-semibold text-amber-900">待完善</h3>
                  <ul class="mt-3 space-y-2 text-sm text-amber-800"><li v-for="item in scoreWeaknesses(selectedHistory)" :key="item">• {{ item }}</li><li v-if="!scoreWeaknesses(selectedHistory).length" class="text-amber-700/70">暂无记录</li></ul>
                </section>
                <section class="rounded-2xl bg-blue-50 p-4">
                  <h3 class="font-semibold text-blue-900">优化建议</h3>
                  <ul class="mt-3 space-y-2 text-sm text-blue-800"><li v-for="item in scoreSuggestions(selectedHistory)" :key="item">• {{ item }}</li><li v-if="!scoreSuggestions(selectedHistory).length" class="text-blue-700/70">暂无记录</li></ul>
                </section>
              </div>
            </template>

            <template v-else-if="selectedHistory.task_type === 'jd_optimize'">
              <div class="rounded-2xl border border-zinc-200 p-5">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="font-semibold text-zinc-900">JD 匹配结果</h3>
                  <span v-if="Number(resultPayload(selectedHistory).score || 0)" class="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{{ Number(resultPayload(selectedHistory).score || 0) }} 分</span>
                </div>
                <p class="mt-3 text-sm leading-6 text-zinc-600">{{ resultPayload(selectedHistory).summary || '本次 JD 优化结果已保存。' }}</p>
                <ul class="mt-4 space-y-2 text-sm text-zinc-700">
                  <li v-for="item in jdSuggestions(selectedHistory)" :key="item" class="rounded-xl bg-zinc-50 px-3 py-2">• {{ item }}</li>
                  <li v-if="!jdSuggestions(selectedHistory).length" class="rounded-xl bg-zinc-50 px-3 py-2 text-zinc-400">暂无可展示建议</li>
                </ul>
              </div>
            </template>

            <template v-else>
              <div class="rounded-2xl border border-zinc-200 p-5">
                <h3 class="font-semibold text-zinc-900">生成结果</h3>
                <ul class="mt-4 space-y-2 text-sm text-zinc-700">
                  <li v-for="item in genericResultLines(selectedHistory)" :key="item" class="rounded-xl bg-zinc-50 px-3 py-2">• {{ item }}</li>
                  <li v-if="!genericResultLines(selectedHistory).length" class="rounded-xl bg-zinc-50 px-3 py-2 text-zinc-400">结果已保存，但没有可摘要展示的文本。</li>
                </ul>
              </div>
            </template>
          </div>
        </article>
      </div>
    </main>
  </AppLayout>
</template>

<style scoped>
.ai-records-hint :deep(h1), .ai-records-hint :deep(h2), .ai-records-hint :deep(h3), .ai-records-hint :deep(h4) { margin: .5em 0 .25em; color: #18181b; font-weight: 700; line-height: 1.35; }
.ai-records-hint :deep(h1) { font-size: 1.25rem; }
.ai-records-hint :deep(h2) { font-size: 1.1rem; }
.ai-records-hint :deep(h3) { font-size: 1rem; }
.ai-records-hint :deep(p) { margin: .25em 0; }
.ai-records-hint :deep(ul), .ai-records-hint :deep(ol) { margin: .3em 0; padding-left: 1.5rem; }
.ai-records-hint :deep(ul) { list-style: disc; }
.ai-records-hint :deep(ol) { list-style: decimal; }
.ai-records-hint :deep(blockquote) { margin: .4em 0; border-left: 3px solid #d4d4d8; background: #fafafa; padding: .4rem .7rem; color: #52525b; }
.ai-records-hint :deep(s), .ai-records-hint :deep(strike), .ai-records-hint :deep(del), .ai-records-hint :deep(span[style*="line-through"]) { text-decoration: line-through !important; text-decoration-line: line-through !important; }
.ai-records-hint :deep(u) { text-decoration: underline; }
.ai-records-hint :deep(b), .ai-records-hint :deep(strong) { font-weight: bold; }
.ai-records-hint :deep(i), .ai-records-hint :deep(em) { font-style: italic; }
.ai-records-hint :deep(a) { color: #2563eb; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(37, 99, 235, 0.3); text-decoration-thickness: 1.5px; transition: all 0.2s ease; }
.ai-records-hint :deep(a:hover) { color: #1d4ed8; text-decoration-color: #2563eb; }
.ai-records-hint :deep(img) { display: inline-block; max-width: 100%; height: auto; margin: .5rem 0; border-radius: .5rem; }
.ai-records-hint :deep(img[data-size="25"]) { width: 25%; }
.ai-records-hint :deep(img[data-size="50"]) { width: 50%; }
.ai-records-hint :deep(img[data-size="75"]) { width: 75%; }
.ai-records-hint :deep(img[data-size="100"]) { width: 100%; }
</style>
