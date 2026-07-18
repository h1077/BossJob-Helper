<script setup lang="ts">
import { Copy, Download, Eye, EyeOff, Pencil, Plus, Settings2, Ticket, Trash2, Upload, X } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Select from "@/components/ui/select/Select.vue"
import PaginationFooter from "@/components/ui/pagination/PaginationFooter.vue"
import type { AdminRedeemCode, PageData } from "@/api/admin"

interface RedeemForm {
  count: number
  points: number
  price: number
  total_count: number
  ip_once: boolean
  custom_codes: string
  expire_time: string
  note: string
}

interface ImportForm {
  points: number
  price: number
  total_count: number
  ip_once: boolean
  expire_time: string
  note: string
}

interface CodeFilters {
  status: string
  points: string
  keyword: string
}

interface EditCodeForm {
  code: string
  points: number
  price: number
  total_count: number
  ip_once: boolean
  expire_time: string
  status: "active" | "disabled"
  note: string
}

interface BatchPriceForm {
  match_type: "note" | "batch_no"
  keyword: string
  price: number
}

defineProps<{
  codeStatusOptions: Array<{ label: string; value: string }>
  pageSizeOptions: Array<{ label: string; value: number }>
  batchPriceMatchOptions: Array<{ label: string; value: string }>
  exportingCodes: boolean
  generatingCodes: boolean
  importingCodes: boolean
  savingBatchPrice: boolean
  savingCode: boolean
  deletingCode: boolean
}>()

const codes = defineModel<PageData<AdminRedeemCode>>("codes", { required: true })
const codeFilters = defineModel<CodeFilters>("codeFilters", { required: true })
const redeemForm = defineModel<RedeemForm>("redeemForm", { required: true })
const importForm = defineModel<ImportForm>("importForm", { required: true })
const importText = defineModel<string>("importText", { required: true })
const batchPriceForm = defineModel<BatchPriceForm>("batchPriceForm", { required: true })
const editCodeForm = defineModel<EditCodeForm>("editCodeForm", { required: true })
const showGenerateModal = defineModel<boolean>("showGenerateModal", { required: true })
const showImportModal = defineModel<boolean>("showImportModal", { required: true })
const showBatchPriceModal = defineModel<boolean>("showBatchPriceModal", { required: true })
const editingCode = defineModel<AdminRedeemCode | null>("editingCode", { required: true })
const codeToDelete = defineModel<AdminRedeemCode | null>("codeToDelete", { required: true })

defineEmits<{
  load: [page?: number]
  resetFilters: []
  exportCodes: []
  generateCodes: []
  importCodes: []
  toggleCode: [item: AdminRedeemCode]
  openEditCode: [item: AdminRedeemCode]
  saveCode: []
  saveBatchPrice: []
  confirmDeleteCode: []
  copyCode: [code: string]
}>()
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:flex-wrap">
      <div class="grid shrink-0 gap-2 sm:grid-cols-[140px_150px_220px_auto] sm:items-end">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-500">状态</label>
          <Select v-model="codeFilters.status" :options="codeStatusOptions" class="h-10 w-full rounded-xl" @change="$emit('load', 1)" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-500">点数</label>
          <input v-model="codeFilters.points" type="number" min="1" inputmode="numeric" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="全部点数" @keyup.enter="$emit('load', 1)" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-zinc-500">兑换码</label>
          <input v-model="codeFilters.keyword" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="输入兑换码搜索" @keyup.enter="$emit('load', 1)" />
        </div>
        <div class="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" class="h-10 shrink-0 whitespace-nowrap" @click="$emit('load', 1)">筛选</Button>
          <Button variant="outline" size="sm" class="h-10 shrink-0 whitespace-nowrap" @click="$emit('resetFilters')">重置</Button>
        </div>
      </div>
      <div class="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        <Button variant="outline" size="sm" class="h-10 w-full sm:w-auto" :disabled="exportingCodes" @click="$emit('exportCodes')"><Download class="mr-2 h-4 w-4" />{{ exportingCodes ? "导出中" : "导出 TXT" }}</Button>
        <Button variant="outline" size="sm" class="h-10 w-full sm:w-auto" @click="showBatchPriceModal = true"><Settings2 class="mr-2 h-4 w-4" />按备注调价</Button>
        <Button variant="outline" size="sm" class="h-10 w-full sm:w-auto" @click="showImportModal = true"><Upload class="mr-2 h-4 w-4" />导入 TXT</Button>
        <Button size="sm" class="h-10 w-full sm:w-auto" @click="showGenerateModal = true"><Plus class="mr-2 h-4 w-4" />生成兑换码</Button>
      </div>
    </div>

    <article class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[860px] text-left text-sm">
          <thead><tr class="border-b bg-zinc-50 text-xs text-zinc-500"><th class="px-5 py-3">兑换码</th><th class="px-5 py-3">点数</th><th class="px-5 py-3">价格</th><th class="px-5 py-3">兑换人数</th><th class="px-5 py-3">状态</th><th class="px-5 py-3">操作</th></tr></thead>
          <tbody>
            <tr v-for="item in codes.items" :key="item.id" class="border-b border-zinc-100 last:border-0">
              <td class="px-5 py-4">
                <div class="flex items-center gap-2"><code class="rounded bg-zinc-100 px-2 py-1 text-xs">{{ item.code }}</code><button class="text-zinc-400 hover:text-zinc-900" title="复制兑换码" @click="$emit('copyCode', item.code)"><Copy class="h-4 w-4" /></button></div>
                <p class="mt-1 text-xs text-zinc-400">{{ item.note || "无备注" }}</p>
                <p class="mt-0.5 text-[11px] text-zinc-400">批次 {{ item.batch_no }}</p>
              </td>
              <td class="px-5 py-4 font-medium">{{ item.points }}</td>
              <td class="px-5 py-4 font-medium">¥{{ Number(item.price || 0).toFixed(2) }}</td>
              <td class="px-5 py-4">
                <div class="font-medium text-zinc-800">{{ item.used_count }} / {{ item.total_count }}</div>
                <p class="mt-1 text-xs text-zinc-400">每人限 1 次<span v-if="item.ip_once"> · 每 IP 限 1 次</span></p>
              </td>
              <td class="px-5 py-4">
                <span v-if="item.used_count >= item.total_count" class="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500">已用完</span>
                <span v-else-if="item.expire_time && new Date(item.expire_time).getTime() < Date.now()" class="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500">已过期</span>
                <span v-else class="rounded-full px-2 py-1 text-xs" :class="item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">{{ item.status === "active" ? "可用" : "已下架" }}</span>
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center gap-1.5 whitespace-nowrap">
                  <button class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 active:scale-95" @click="$emit('openEditCode', item)"><Pencil class="h-3.5 w-3.5 text-zinc-500" />编辑</button>
                  <button v-if="item.used_count < item.total_count && (!item.expire_time || new Date(item.expire_time).getTime() > Date.now())" class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 active:scale-95" @click="$emit('toggleCode', item)"><EyeOff v-if="item.status === 'active'" class="h-3.5 w-3.5 text-zinc-500" /><Eye v-else class="h-3.5 w-3.5 text-zinc-500" />{{ item.status === "active" ? "下架" : "上架" }}</button>
                  <button class="group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-300 disabled:shadow-none disabled:active:scale-100" :class="item.used_count > 0 ? '' : 'border-zinc-200 bg-white text-zinc-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600'" :title="item.used_count > 0 ? '已有兑换记录，只能下架' : '删除兑换码'" :disabled="item.used_count > 0" @click="codeToDelete = item"><Trash2 class="h-3.5 w-3.5" :class="item.used_count > 0 ? 'text-zinc-300' : 'text-zinc-500 group-hover:text-red-600'" />删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationFooter
        v-if="codes.total > 0"
        :page="codes.page"
        :total="codes.total"
        :page-size="codes.page_size"
        :page-size-options="pageSizeOptions"
        @update:page="codes.page = $event; $emit('load', $event)"
        @update:page-size="codes.page_size = $event"
        @change="$emit('load', $event)"
      />
    </article>

    <div v-if="showGenerateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm transition-all duration-200">
      <div class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="font-semibold text-zinc-900">生成兑换码</h3>
          <button class="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600" @click="showGenerateModal = false"><X class="h-5 w-5" /></button>
        </div>
        <div class="grid gap-4">
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">自定义兑换码<textarea v-model="redeemForm.custom_codes" rows="3" class="block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="可选，每行一个。填写后将按这里的兑换码创建，忽略生成数量。"></textarea></label>
          <div class="grid gap-4 sm:grid-cols-4">
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">生成数量<input v-model.number="redeemForm.count" type="number" min="1" max="500" :disabled="Boolean(redeemForm.custom_codes.trim())" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">每个码点数<input v-model.number="redeemForm.points" type="number" min="0.01" step="0.01" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">每次兑换价格<input v-model.number="redeemForm.price" type="number" min="0" step="0.01" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">可兑换人数<input v-model.number="redeemForm.total_count" type="number" min="1" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">过期时间<input v-model="redeemForm.expire_time" type="datetime-local" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">备注<input v-model="redeemForm.note" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="例如：内测用户赠送" /></label>
          </div>
          <label class="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-700 transition-colors hover:bg-zinc-50">
            <div><span class="font-medium text-zinc-900">同一 IP 只能兑换一次</span></div>
            <input v-model="redeemForm.ip_once" type="checkbox" class="h-4 w-4 cursor-pointer rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
          </label>
          <Button class="mt-2 h-11 w-full rounded-xl" :disabled="generatingCodes" @click="$emit('generateCodes')"><Ticket class="mr-2 h-4 w-4" />{{ generatingCodes ? "生成中..." : "立即生成兑换码" }}</Button>
        </div>
      </div>
    </div>

    <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm transition-all duration-200">
      <div class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-zinc-900">导入兑换码</h3>
            <p class="mt-1 text-xs text-zinc-400">TXT 内容每行一个兑换码，重复的码会自动跳过；每个用户对同一个码只能兑换一次。</p>
          </div>
          <button class="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600" @click="showImportModal = false"><X class="h-5 w-5" /></button>
        </div>
        <div class="grid gap-4">
          <textarea v-model="importText" rows="8" class="block w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="FLOW-XXXX-XXXX&#10;FLOW-YYYY-YYYY"></textarea>
          <div class="grid gap-4 sm:grid-cols-4">
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">每个码点数<input v-model.number="importForm.points" type="number" min="0.01" step="0.01" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">每次兑换价格<input v-model.number="importForm.price" type="number" min="0" step="0.01" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">可兑换人数<input v-model.number="importForm.total_count" type="number" min="1" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">过期时间<input v-model="importForm.expire_time" type="datetime-local" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
          </div>
          <label class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm text-zinc-700"><input v-model="importForm.ip_once" type="checkbox" class="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" /><span><span class="font-medium text-zinc-900">同一 IP 只能兑换一次</span><span class="mt-0.5 block text-xs text-zinc-500">导入的每个兑换码都会启用该限制。</span></span></label>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">备注<input v-model="importForm.note" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="例如：线下活动导入" /></label>
          <Button class="mt-2 h-11 rounded-xl" :disabled="importingCodes" @click="$emit('importCodes')"><Upload class="mr-2 h-4 w-4" />{{ importingCodes ? "导入中" : "确认导入" }}</Button>
        </div>
      </div>
    </div>

    <div v-if="showBatchPriceModal" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm transition-all duration-200">
      <div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 class="font-semibold text-zinc-900">批量设置价格</h3>
            <p class="mt-1 text-xs text-zinc-500">可按备注或批次 ID 精确匹配兑换码，已兑换记录也会同步用于首页收入统计。</p>
          </div>
          <button class="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600" @click="showBatchPriceModal = false"><X class="h-5 w-5" /></button>
        </div>
        <div class="grid gap-4">
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">匹配方式<Select v-model="batchPriceForm.match_type" :options="batchPriceMatchOptions" class="h-11 w-full rounded-xl" /></label>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">{{ batchPriceForm.match_type === "batch_no" ? "批次 ID" : "备注" }}<input v-model="batchPriceForm.keyword" maxlength="2000" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" :placeholder="batchPriceForm.match_type === 'batch_no' ? '例如：FP20260629120000' : '例如：线下活动导入'" /></label>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">统一价格<input v-model.number="batchPriceForm.price" type="number" min="0" step="0.01" class="block h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
          <div class="flex justify-end gap-3 pt-1">
            <Button variant="outline" class="h-10 px-5" @click="showBatchPriceModal = false">取消</Button>
            <Button class="h-10 px-5" :disabled="savingBatchPrice" @click="$emit('saveBatchPrice')">{{ savingBatchPrice ? "保存中..." : "保存价格" }}</Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="editingCode" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
      <div class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 class="font-semibold text-zinc-900">编辑兑换码</h3>
            <p class="mt-1 text-xs text-zinc-500">{{ editingCode.used_count > 0 ? "已有兑换记录，码值不可修改；新点数仅对后续兑换生效，价格会同步收入统计。" : "修改后立即生效。" }}</p>
          </div>
          <button class="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" @click="editingCode = null"><X class="h-5 w-5" /></button>
        </div>
        <div class="grid gap-4">
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">兑换码<input v-model="editCodeForm.code" :disabled="editingCode.used_count > 0" maxlength="64" class="block h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400" /></label>
          <div class="grid gap-4 sm:grid-cols-4">
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">兑换点数<input v-model.number="editCodeForm.points" type="number" min="0.01" step="0.01" class="block h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">兑换价格<input v-model.number="editCodeForm.price" type="number" min="0" step="0.01" class="block h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">可兑换人数<input v-model.number="editCodeForm.total_count" type="number" :min="Math.max(1, editingCode.used_count)" class="block h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
            <label class="space-y-1.5 text-sm font-medium text-zinc-700">状态<Select v-model="editCodeForm.status" :options="[{ label: '可用', value: 'active' }, { label: '已下架', value: 'disabled' }]" class="h-11 w-full rounded-xl" /></label>
          </div>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">过期时间<input v-model="editCodeForm.expire_time" type="datetime-local" class="block h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">备注<input v-model="editCodeForm.note" maxlength="2000" class="block h-11 w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="可选" /></label>
          <label class="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            <span><span class="font-medium text-zinc-900">同一 IP 只能兑换一次</span><span class="mt-0.5 block text-xs text-zinc-500">开启后，该兑换码会校验兑换 IP。</span></span>
            <input v-model="editCodeForm.ip_once" type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
          </label>
          <div class="flex justify-end gap-3 pt-1">
            <Button variant="outline" class="h-10 px-5" @click="editingCode = null">取消</Button>
            <Button class="h-10 px-5" :disabled="savingCode" @click="$emit('saveCode')">{{ savingCode ? "保存中..." : "保存修改" }}</Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="codeToDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
      <div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-start gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 class="h-5 w-5" /></div>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-zinc-900">删除兑换码</h3>
            <p class="mt-2 text-sm leading-6 text-zinc-600">确定删除 <code class="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-900">{{ codeToDelete.code }}</code> 吗？删除后无法恢复。</p>
          </div>
          <button class="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" @click="codeToDelete = null"><X class="h-5 w-5" /></button>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <Button variant="outline" class="h-10 px-5" @click="codeToDelete = null">取消</Button>
          <Button class="h-10 border-red-600 bg-red-600 px-5 text-white hover:bg-red-700" :disabled="deletingCode" @click="$emit('confirmDeleteCode')">{{ deletingCode ? "删除中..." : "确认删除" }}</Button>
        </div>
      </div>
    </div>
  </div>
</template>
