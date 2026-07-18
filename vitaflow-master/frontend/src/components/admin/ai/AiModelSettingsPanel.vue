<script setup lang="ts">
import { Check, Eye, EyeOff, Plus, Sparkles, Trash2, Zap } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import type { AdminAiConfig } from "@/api/admin"

interface AiConfigForm {
  id: number
  name: string
  provider: string
  base_url: string
  api_key: string
  model: string
  temperature: number
  timeout: number
  max_tokens: string
  supports_multimodal: boolean
  context_messages: number
  is_chat_selectable: boolean
  sort_order: number
  chat_points_per_call: string
  chat_points_per_million_input_tokens: string
  chat_points_per_million_output_tokens: string
  is_active: boolean
}

defineProps<{
  configs: AdminAiConfig[]
  saving: boolean
}>()

const configForm = defineModel<AiConfigForm>("configForm", { required: true })
const showKey = defineModel<boolean>("showKey", { required: true })

defineEmits<{
  reset: [item?: AdminAiConfig]
  activate: [item: AdminAiConfig]
  delete: [item: AdminAiConfig]
  save: []
}>()
</script>

<template>
  <div class="grid items-start gap-5 lg:grid-cols-[1.25fr_1.4fr]">
    <article class="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-semibold text-zinc-900">配置列表</h3>
        <Button variant="outline" size="sm" @click="$emit('reset')"><Plus class="mr-1.5 h-4 w-4" />新增配置</Button>
      </div>
      <div class="mt-4 space-y-3">
        <button
          v-for="item in configs"
          :key="item.id"
          class="group relative w-full rounded-xl border p-4 text-left transition-all"
          :class="item.id === configForm.id ? 'border-zinc-900 bg-zinc-50/80 ring-1 ring-zinc-900 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/40'"
          @click="$emit('reset', item)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-semibold text-zinc-900">{{ item.name }}</p>
              <p class="mt-1.5 truncate text-sm font-medium text-zinc-700">{{ item.model }}</p>
              <p class="mt-1 truncate text-xs text-zinc-400" :title="item.base_url">{{ item.base_url }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <div v-if="!item.is_active" class="flex w-7 shrink-0 items-center justify-center">
                <button class="rounded-full p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 active:scale-95 group-hover:opacity-100" title="删除配置" @click.stop="$emit('delete', item)"><Trash2 class="h-3.5 w-3.5" /></button>
              </div>
              <span v-if="item.is_active" class="flex w-[90px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200/60 bg-emerald-50 py-1 text-xs font-medium text-emerald-700"><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>使用中</span>
              <button v-else class="flex w-[90px] items-center justify-center gap-1 whitespace-nowrap rounded-full border border-zinc-200/60 bg-zinc-100 py-1 text-xs font-medium text-zinc-600 transition-all hover:border-zinc-900 hover:bg-zinc-900 hover:text-white active:scale-95" @click.stop="$emit('activate', item)"><Zap class="h-3 w-3" />设为启用</button>
            </div>
          </div>
          <div class="mt-3.5 flex flex-wrap gap-1.5">
            <span class="inline-flex items-center whitespace-nowrap rounded-md border border-zinc-200/50 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-medium text-zinc-600">排序 {{ item.sort_order ?? 100 }}</span>
            <span class="inline-flex items-center whitespace-nowrap rounded-md border border-zinc-200/50 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{{ item.supports_multimodal ? "多模态" : "仅文本" }}</span>
            <span class="inline-flex items-center whitespace-nowrap rounded-md border border-zinc-200/50 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{{ item.context_messages }}条上下文</span>
            <span class="inline-flex items-center whitespace-nowrap rounded-md border border-zinc-200/50 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{{ item.is_chat_selectable ? "助手可选" : "默认" }}</span>
            <span class="inline-flex items-center whitespace-nowrap rounded-md border border-zinc-200/50 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{{ item.has_api_key ? "配Key" : "无Key" }}</span>
          </div>
        </button>
        <p v-if="!configs.length" class="rounded-xl bg-zinc-50 py-10 text-center text-sm text-zinc-400">暂无模型配置</p>
      </div>
    </article>

    <article class="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 class="text-lg font-semibold text-zinc-900">{{ configForm.id ? "编辑模型配置" : "新增模型配置" }}</h3>
      <div class="mt-5 space-y-4">
        <label class="block space-y-1.5 text-sm font-medium text-zinc-700">配置名称<input v-model="configForm.name" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
        <label class="block space-y-1.5 text-sm font-medium text-zinc-700">API URL<input v-model="configForm.base_url" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="https://api.openai.com/v1" /></label>
        <label class="block space-y-1.5 text-sm font-medium text-zinc-700">模型名称<input v-model="configForm.model" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="gpt-4.1-mini" /></label>
        <label class="block space-y-1.5 text-sm font-medium text-zinc-700">API Key<div class="relative"><input v-model="configForm.api_key" :type="showKey ? 'text' : 'password'" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white pl-3 pr-10 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="新建配置必填，编辑可留空" /><button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-700" @click="showKey = !showKey"><Eye v-if="!showKey" class="h-4 w-4" /><EyeOff v-else class="h-4 w-4" /></button></div></label>
        <div class="grid gap-4 pt-1 sm:grid-cols-2 lg:grid-cols-4">
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">温度<input v-model.number="configForm.temperature" type="number" step="0.1" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">超时秒数<input v-model.number="configForm.timeout" type="number" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">上下文条数<input v-model.number="configForm.context_messages" type="number" min="1" max="40" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
          <label class="space-y-1.5 text-sm font-medium text-zinc-700">排序值<input v-model.number="configForm.sort_order" type="number" min="0" max="9999" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" /></label>
        </div>
        <div class="grid gap-3 pt-2 sm:grid-cols-3">
          <label class="group flex cursor-pointer select-none items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900" title="仅适用于兼容 OpenAI image_url 图片消息格式的多模态模型">
            <div class="relative flex h-5 w-5 items-center justify-center rounded-md border border-zinc-300 bg-white transition-all duration-200 group-hover:border-zinc-400" :class="{ '!border-zinc-900 !bg-zinc-900 shadow-sm': configForm.supports_multimodal }">
              <Check v-if="configForm.supports_multimodal" class="h-3.5 w-3.5 text-white stroke-[3]" />
            </div>
            <input v-model="configForm.supports_multimodal" type="checkbox" class="sr-only" />
            <span class="text-zinc-800 group-hover:text-zinc-900">支持图片输入</span>
          </label>
          <label class="group flex cursor-pointer select-none items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900">
            <div class="relative flex h-5 w-5 items-center justify-center rounded-md border border-zinc-300 bg-white transition-all duration-200 group-hover:border-zinc-400" :class="{ '!border-zinc-900 !bg-zinc-900 shadow-sm': configForm.is_chat_selectable }">
              <Check v-if="configForm.is_chat_selectable" class="h-3.5 w-3.5 text-white stroke-[3]" />
            </div>
            <input v-model="configForm.is_chat_selectable" type="checkbox" class="sr-only" />
            <span class="text-zinc-800 group-hover:text-zinc-900">AI 助手可选</span>
          </label>
          <label class="group flex cursor-pointer select-none items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900">
            <div class="relative flex h-5 w-5 items-center justify-center rounded-md border border-zinc-300 bg-white transition-all duration-200 group-hover:border-zinc-400" :class="{ '!border-zinc-900 !bg-zinc-900 shadow-sm': configForm.is_active }">
              <Check v-if="configForm.is_active" class="h-3.5 w-3.5 text-white stroke-[3]" />
            </div>
            <input v-model="configForm.is_active" type="checkbox" class="sr-only" />
            <span class="text-zinc-800 group-hover:text-zinc-900">设为启用</span>
          </label>
        </div>
        <div class="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm font-semibold text-zinc-800">AI 助手对话价格</p>
          </div>
          <div class="mt-3 grid gap-3 sm:grid-cols-3">
            <label class="space-y-1.5 text-xs font-medium text-zinc-600">每次扣点<input v-model="configForm.chat_points_per_call" type="number" min="0" step="0.01" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="默认" /></label>
            <label class="space-y-1.5 text-xs font-medium text-zinc-600">输入百万 Token<input v-model="configForm.chat_points_per_million_input_tokens" type="number" min="0" step="0.01" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="默认" /></label>
            <label class="space-y-1.5 text-xs font-medium text-zinc-600">输出百万 Token<input v-model="configForm.chat_points_per_million_output_tokens" type="number" min="0" step="0.01" class="block h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" placeholder="默认" /></label>
          </div>
        </div>
        <div class="pt-2">
          <Button class="h-10 w-full rounded-xl" :disabled="saving" @click="$emit('save')"><Sparkles class="mr-1.5 h-4 w-4" />{{ saving ? "保存中..." : configForm.id ? "保存模型配置" : "创建模型配置" }}</Button>
        </div>
      </div>
    </article>
  </div>
</template>
