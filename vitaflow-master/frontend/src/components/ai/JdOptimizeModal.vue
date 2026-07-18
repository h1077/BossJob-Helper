<script setup lang="ts">
import { computed } from "vue"
import { ArrowRight, CheckCircle2, FileSearch, ScanSearch, Sparkles } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import OptimizeResultDialog from "./OptimizeResultDialog.vue"
import AiLoading from "./AiLoading.vue"

const props = defineProps<{ modelValue: string; result?: any; loading?: boolean; error?: string; streamText?: string; currentData?: any; isWide?: boolean }>()
const emit = defineEmits<{ "update:modelValue": [value: string]; optimize: [jd: string]; apply: [optimizedData: any]; clear: [] }>()

function flattenKeywords(value: any): string[] {
  if (Array.isArray(value)) return value.flatMap(flattenKeywords)
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenKeywords)
  return String(value || "").split(/[,，、;；/|]+/).map((item) => item.trim()).filter(Boolean)
}

const extractedKeywords = computed(() => {
  const fromResult = flattenKeywords(props.result?.job_keywords)
  if (fromResult.length) return [...new Set(fromResult)].slice(0, 12)
  const stopWords = new Set(["负责", "相关", "工作", "岗位", "要求", "具备", "以及", "能够", "优先", "经验"])
  const tokens = props.modelValue.split(/[\s,，、;；:：()（）\[\]【】]+/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 18 && !stopWords.has(item))
  return [...new Set(tokens)].slice(0, 10)
})

const matchScore = computed(() => Math.max(0, Math.min(100, Number(props.result?.score || 0))))
const targetPosition = computed(() => props.currentData?.basics?.title || "当前目标岗位")
</script>

<template>
  <div class="flex h-full min-h-0 flex-col px-4 py-4 md:px-6 md:py-6 relative overflow-x-hidden">
    <section v-if="!loading && !result" class="flex flex-col flex-1 min-h-0 transition-all duration-300 relative gap-2">
      <div class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px]"></div>
      <div class="relative shrink-0 py-2">
        <div class="relative flex items-center gap-3 md:gap-3.5">
          <span class="flex h-11 w-11 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-2xl md:rounded-[18px] bg-white text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
            <FileSearch class="relative z-10 h-5 w-5 md:h-7 md:w-7" :stroke-width="1.5" />
          </span>
          <div>
            <div class="text-[15px] md:text-[16px] font-semibold tracking-tight text-zinc-900">粘贴目标岗位 JD</div>
            <div class="mt-1 text-xs md:text-[13px] text-zinc-500">粘贴目标岗位 JD，AI 将自动提取核心要求并生成优化建议</div>
          </div>
        </div>
        <div class="relative mt-3 md:mt-5 flex items-center gap-2 md:gap-2.5 text-[11px] md:text-[12px] font-medium text-zinc-400">
          <span class="text-blue-600">01 分析JD</span>
          <ArrowRight class="h-3.5 w-3.5" />
          <span>02 匹配简历</span>
          <ArrowRight class="h-3.5 w-3.5" />
          <span>03 优化表达</span>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col relative z-10">
        <div class="flex-1 py-1 md:py-2 flex flex-col min-h-0">
          <label class="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 shrink-0">Job description</label>
          <div class="mt-2 md:mt-4 flex-1 flex flex-col min-h-[100px] relative transition-all duration-500 rounded-2xl bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white focus-within:shadow-[0_20px_60px_rgba(16,185,129,0.12)] focus-within:-translate-y-1 group">
            <textarea :value="modelValue" placeholder="粘贴完整岗位 JD，AI 将自动提取核心要求，并与你的简历进行匹配分析。" class="peer flex-1 w-full resize-none rounded-2xl border-0 bg-transparent p-3.5 md:p-5 text-sm md:text-[15px] leading-relaxed text-zinc-800 placeholder:text-zinc-300/80 focus:ring-0 outline-none thin-scrollbar min-h-0" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"></textarea>
            
            <!-- Magic Animated Glow Line at Bottom -->
            <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[2px] bg-gradient-to-r from-transparent via-blue-400/80 to-transparent opacity-0 blur-[1px] transition-all duration-700 pointer-events-none peer-focus:opacity-100 peer-focus:w-[80%]"></div>
          </div>
          <div v-if="extractedKeywords.length" class="mt-4 md:mt-6 shrink-0 hidden sm:block">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-medium text-zinc-500">已识别核心关键词</span>
              <span class="text-[12px] text-zinc-400">{{ extractedKeywords.length }}</span>
            </div>
            <div class="mt-3 flex overflow-hidden gap-2 pb-1 w-full" style="mask-image: linear-gradient(to right, black 0%, black calc(100% - 60px), transparent 100%); -webkit-mask-image: linear-gradient(to right, black 0%, black calc(100% - 60px), transparent 100%);">
              <span v-for="(keyword, index) in extractedKeywords" :key="keyword" class="keyword-chip shrink-0 rounded-full bg-blue-50/80 px-3.5 py-1.5 text-[13px] font-medium text-blue-700 ring-1 ring-blue-100/50" :style="{ animationDelay: `${index * 45}ms` }">{{ keyword }}</span>
            </div>
          </div>
        </div>

        <div class="shrink-0 py-2 pb-18 md:py-4 md:pb-4 pt-4 sm:pt-4">
          <Button class="h-11 md:h-14 w-full rounded-full bg-zinc-900 text-sm md:text-[16px] font-medium text-white shadow-md transition-all active:scale-[0.98] hover:bg-zinc-800 hover:shadow-lg disabled:opacity-50 disabled:active:scale-100" :disabled="!modelValue.trim() || loading" @click="emit('optimize', modelValue)">
            <span class="mr-1.5 md:mr-2 flex h-6 w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
              <ScanSearch class="h-3.5 w-3.5 md:h-4 md:w-4" stroke-width="2" />
            </span>
            {{ loading ? '正在建立匹配方案...' : result ? '重新生成匹配方案' : '开始 JD 匹配' }}
          </Button>
        </div>
      </div>
    </section>

    <section v-else class="flex flex-col shrink-0 py-2 transition-all duration-300 w-full overflow-y-auto thin-scrollbar relative z-10 h-full">
      <template v-if="loading">
        <div class="flex-1 flex flex-col justify-center py-4">
          <div class="w-full max-w-md mx-auto">
            <AiLoading title="AI 正在针对 JD 深度优化" :stream-text="streamText" />
          </div>
        </div>
      </template>

      <template v-else-if="result">
        <div class="mb-3 md:mb-5 flex flex-col gap-3 md:gap-4">
          <div class="relative overflow-hidden rounded-[16px] md:rounded-[20px] bg-white p-4 md:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 flex items-center justify-between">
            <div class="flex items-center gap-3 md:gap-4">
              <span class="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[14px] md:rounded-[16px] bg-white text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
                <FileSearch class="h-5 w-5 md:h-6 md:w-6" :stroke-width="1.5" />
              </span>
              <div>
                <div class="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600/80">Match Score</div>
                <div class="mt-0.5 md:mt-1 flex items-baseline">
                  <span class="text-[32px] md:text-[42px] font-semibold leading-none tracking-tight text-zinc-900">{{ matchScore }}</span>
                  <span class="ml-1 text-sm md:text-[16px] font-medium text-zinc-400">%</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3 md:gap-5 shrink-0">
              <div class="hidden sm:block w-32 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div class="match-progress h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0_0_12px_rgba(59,130,246,0.4)]" :style="{ width: `${matchScore}%` }"></div>
              </div>
              <button class="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 md:px-3.5 md:py-1.5 text-xs md:text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition hover:bg-zinc-50 hover:text-zinc-900" @click="emit('clear')">
                修改 JD
              </button>
            </div>
          </div>

        </div>
        <div class="flex-1 min-h-0">
          <OptimizeResultDialog :result="result" :loading="false" :error="error" :current-data="currentData" @apply="emit('apply', $event)" />
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.keyword-chip { animation: keyword-arrive 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) both; }
.matching-orbit { left: 50%; top: 50%; transform: translate(-50%, -50%); }
.matching-orbit--one { height: 260px; width: 260px; animation: orbit-spin 12s linear infinite; }
.matching-orbit--two { height: 380px; width: 380px; animation: orbit-spin 18s linear infinite reverse; }
.floating-keyword:nth-of-type(1) { left: 4%; top: 12%; }
.floating-keyword:nth-of-type(2) { right: 4%; top: 16%; }
.floating-keyword:nth-of-type(3) { left: 8%; bottom: 12%; }
.floating-keyword:nth-of-type(4) { right: 8%; bottom: 14%; }
.floating-keyword:nth-of-type(5) { left: 25%; top: 8%; }
.floating-keyword:nth-of-type(6) { right: 20%; bottom: 6%; }
.floating-keyword { animation: keyword-float 3s ease-in-out infinite; animation-delay: calc(var(--i) * -0.4s); }
.match-progress { transform-origin: left; animation: match-grow 1.2s cubic-bezier(0.25, 0.1, 0.25, 1) both; }

@keyframes keyword-arrive { 
  from { opacity: 0; transform: translateY(10px) scale(0.95); } 
  to { opacity: 1; transform: translateY(0) scale(1); } 
}
@keyframes orbit-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes keyword-float { 50% { transform: translateY(-8px); background-color: rgba(255,255,255,0.15); } }
@keyframes match-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { 
  .keyword-chip, .matching-orbit, .floating-keyword, .match-progress { animation: none !important; } 
}
.icon-morph-anim {
  animation: icon-morph 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.1s;
}
@keyframes icon-morph {
  0% { transform: scale(0.5) rotate(-15deg); opacity: 0; filter: blur(4px); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
}
</style>
