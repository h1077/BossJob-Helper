<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { AlertTriangle, ArrowRight, CheckCircle2, Languages, RotateCcw, ShieldCheck } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import AiLoading from "./AiLoading.vue"
import { normalizeResumeLanguage } from "@/utils/resumeLocale"

const props = defineProps<{
  currentLanguage: string
  result?: any
  loading?: boolean
  error?: string
  streamText?: string
}>()

const emit = defineEmits<{
  translate: [targetLanguage: "zh-CN" | "en"]
  apply: [result: any]
  clear: []
}>()

const sourceLanguage = computed(() => normalizeResumeLanguage(props.currentLanguage))
const targetLanguage = ref<"zh-CN" | "en">("en")

watch(
  sourceLanguage,
  (language) => {
    targetLanguage.value = language === "en" ? "zh-CN" : "en"
  },
  { immediate: true },
)

const languageName = (language: string) => language === "en" ? "English" : "简体中文"
const languageOptions: Array<"zh-CN" | "en"> = ["zh-CN", "en"]
const translatedSections = computed(() => Array.isArray(props.result?.translated_sections) ? props.result.translated_sections : [])
const warnings = computed(() => Array.isArray(props.result?.warnings) ? props.result.warnings : [])
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden px-4 pt-4 pb-24 md:px-6 md:py-6">
    <div v-if="loading" class="flex flex-1 flex-col justify-center">
      <AiLoading title="正在翻译整份简历" :stream-text="streamText" />
    </div>

    <section v-else-if="result" class="flex min-h-0 flex-1 flex-col overflow-y-auto thin-scrollbar">
      <div class="rounded-[20px] border border-zinc-200/70 bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
              <Languages class="h-6 w-6" stroke-width="1.5" />
            </span>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">Translation ready</p>
              <h3 class="mt-1 text-base font-semibold text-zinc-950">整份简历翻译完成</h3>
            </div>
          </div>
          <button class="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900" @click="emit('clear')">
            <RotateCcw class="h-3.5 w-3.5" />重新翻译
          </button>
        </div>

        <div class="mt-5 flex items-center justify-center gap-3 rounded-2xl bg-zinc-50 px-4 py-4">
          <span class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm">{{ languageName(result.source_language) }}</span>
          <ArrowRight class="h-4 w-4 text-zinc-400" />
          <span class="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">{{ languageName(result.target_language) }}</span>
        </div>

        <p class="mt-4 text-sm leading-6 text-zinc-600">{{ result.summary || "已完成简历内容、模块标题和展示标签的翻译。" }}</p>

        <div v-if="translatedSections.length" class="mt-4">
          <p class="text-xs font-medium text-zinc-500">已翻译模块</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span v-for="section in translatedSections" :key="section" class="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{{ section }}</span>
          </div>
        </div>

        <div v-if="warnings.length" class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div class="flex gap-2 text-sm font-medium text-amber-900"><AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />需要人工确认</div>
          <ul class="mt-2 space-y-1.5 text-xs leading-5 text-amber-800">
            <li v-for="warning in warnings" :key="warning">• {{ warning }}</li>
          </ul>
        </div>
      </div>

      <div class="mt-auto pt-5">
        <div class="mb-3 flex items-start gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-500">
          <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          应用后会替换当前简历内容并同步切换文档语言；仍可使用编辑器撤销恢复。
        </div>
        <Button class="h-12 w-full rounded-full bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800" @click="emit('apply', result)">
          应用翻译结果
        </Button>
      </div>
    </section>

    <section v-else class="flex min-h-0 flex-1 flex-col">
      <div class="relative py-2">
        <div class="flex items-center gap-3.5">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
            <Languages class="h-7 w-7" :stroke-width="1.5" />
          </span>
          <div>
            <h3 class="text-base font-semibold tracking-tight text-zinc-900">翻译整份简历</h3>
            <p class="mt-1 text-[13px] leading-5 text-zinc-500">AI 会智能识别当前语言，并保持事实、结构、技术名词和格式。</p>
          </div>
        </div>
      </div>

      <div class="mt-5 rounded-[20px] border border-zinc-200/70 bg-white p-5 shadow-sm">
        <p class="text-xs font-medium text-zinc-500">智能识别当前语言</p>
        <div class="mt-3 flex items-center gap-3">
          <span class="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800">{{ languageName(sourceLanguage) }}</span>
          <ArrowRight class="h-4 w-4 text-zinc-400" />
          <span class="text-sm font-medium text-zinc-500">选择目标语言</span>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3">
          <button
            v-for="language in languageOptions"
            :key="language"
            class="h-12 rounded-xl border text-sm font-medium transition"
            :disabled="language === sourceLanguage"
            :class="[
              targetLanguage === language ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400',
              language === sourceLanguage ? 'cursor-not-allowed opacity-35' : '',
            ]"
            @click="targetLanguage = language"
          >
            {{ languageName(language) }}
            <span v-if="language === sourceLanguage" class="ml-1 text-[10px] opacity-70">当前</span>
          </button>
        </div>
      </div>

      <div v-if="error" class="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{{ error }}</div>

      <div class="mt-auto pt-5">
        <Button
          class="h-12 w-full rounded-full bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          :disabled="targetLanguage === sourceLanguage"
          @click="emit('translate', targetLanguage)"
        >
          <Languages class="h-4 w-4" />开始翻译
        </Button>
      </div>
    </section>
  </div>
</template>
