<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { CheckCircle2, RefreshCw, ScanLine, Sparkles, LoaderCircle } from "lucide-vue-next"

const props = defineProps<{ score: any; loading?: boolean; error?: string; streamText?: string; isWide?: boolean }>()
defineEmits<{ refresh: [] }>()

const stages = [
  { label: "读取简历结构", patterns: ["resume_data", "basics", "summary"] },
  { label: "评估内容表达", patterns: ["details", "dimension", "score", "岗位匹配"] },
  { label: "核对岗位竞争力", patterns: ["strengths", "weaknesses", "missing_keywords"] },
  { label: "整理改进建议", patterns: ["suggestions", "comment", "summary"] },
]
const elapsedIndex = ref(0)
let timer: ReturnType<typeof window.setInterval> | null = null

function stopTimer() {
  if (timer) window.clearInterval(timer)
  timer = null
}

function startTimer() {
  stopTimer()
  elapsedIndex.value = 0
  timer = window.setInterval(() => {
    const maxIndex = Math.max(0, stages.length - 2)
    elapsedIndex.value = Math.min(maxIndex, elapsedIndex.value + 1)
    if (elapsedIndex.value >= maxIndex) stopTimer()
  }, 4200)
}

watch(
  () => props.loading,
  (loading) => {
    if (loading) startTimer()
    else stopTimer()
  },
  { immediate: true },
)

onBeforeUnmount(stopTimer)

const activeIndex = computed(() => {
  const text = props.streamText || ""
  let index = elapsedIndex.value
  stages.forEach((stage, stageIndex) => {
    if (stage.patterns.some((pattern) => text.includes(pattern))) index = Math.max(index, stageIndex)
  })
  return Math.min(index, stages.length - 1)
})

const progress = computed(() => {
  const stepProgress = Math.round(((activeIndex.value + 1) / stages.length) * 88)
  const extra = props.streamText ? 8 : 0
  return Math.min(96, Math.max(15, stepProgress + extra))
})

const fieldLabels: Record<string, string> = {
  basics: "基本信息",
  highest_degree: "最高学历",
  location: "所在城市",
  status: "当前状态",
  expected_salary: "期望薪资",
  phone: "电话",
  email: "邮箱",
  github: "代码仓库",
  website: "个人网站",
  education: "教育经历",
  skills: "专业技能",
  work: "实习/工作经历",
  projects: "项目经历",
  awards: "荣誉奖项",
}

function localText(value: any) {
  let result = String(value ?? "")
  Object.entries(fieldLabels)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([key, label]) => {
      result = result.replace(new RegExp(`(?<![A-Za-z0-9_])${key}(?![A-Za-z0-9_])`, "g"), label)
    })
  return result
}

const scorePercent = computed(() => Math.max(0, Math.min(100, Number(props.score?.score || 0))))
const ringStyle = computed(() => ({ background: `conic-gradient(#3b82f6 ${scorePercent.value * 3.6}deg, #f4f4f5 0deg)` }))
const suggestions = computed(() => (props.score?.suggestions || []).filter(Boolean))

function detailPercent(item: any) {
  const max = Number(item?.max_score || 100)
  return Math.max(0, Math.min(100, Math.round((Number(item?.score || 0) / max) * 100)))
}

function staggerDelay(index: string | number, step = 65, base = 0) {
  return `${base + Number(index) * step}ms`
}
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto overflow-x-hidden thin-scrollbar relative px-4 py-4 pb-18 md:px-6 md:py-6 md:pb-6">
    <div class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px]"></div>
    <div v-if="loading" class="diagnosis-loading flex flex-col min-h-full justify-center">
      <div class="relative w-full max-w-md mx-auto">
        <div class="relative z-10 flex flex-col">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 md:gap-4">
              <span class="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[14px] md:rounded-[16px] bg-white text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
                <ScanLine class="h-5 w-5 md:h-6 md:w-6" stroke-width="1.5" />
              </span>
              <div>
                <div class="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600/80">Resume Analysis</div>
                <h3 class="mt-0.5 md:mt-1 text-[18px] md:text-[20px] font-semibold tracking-tight text-zinc-900">正在进行 简历诊断</h3>
              </div>
            </div>
            <div class="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-zinc-50 border border-zinc-100 shadow-sm text-xs md:text-sm font-semibold text-zinc-700">
              {{ progress }}%
            </div>
          </div>

          <div class="mt-6 md:mt-10 flex-1 space-y-2.5 md:space-y-3.5">
            <div v-for="(item, index) in stages" :key="item.label" class="analysis-step flex items-center gap-3 md:gap-4 rounded-[16px] md:rounded-[20px] px-4 py-4 md:px-5 md:py-5 transition-colors duration-500" :class="index <= activeIndex ? 'bg-zinc-50 ring-1 ring-zinc-100 shadow-sm' : 'bg-transparent'">
              <span class="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full text-[10px] md:text-[11px] font-semibold transition-all duration-500" :class="index < activeIndex ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : index === activeIndex ? 'bg-zinc-900 text-white shadow-md shadow-zinc-900/20' : 'bg-white text-zinc-400 ring-1 ring-zinc-200'">
                <CheckCircle2 v-if="index < activeIndex" class="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="text-sm md:text-[15px] font-medium transition-colors duration-500" :class="index <= activeIndex ? 'text-zinc-900' : 'text-zinc-400'">{{ item.label }}</span>
              <span v-if="index === activeIndex" class="ml-auto flex gap-1.5">
                <i v-for="dot in 3" :key="dot" class="analysis-dot h-1.5 w-1.5 rounded-full bg-zinc-900" :style="{ animationDelay: `${dot * 150}ms` }"></i>
              </span>
              <span v-else-if="index < activeIndex" class="ml-auto text-blue-500">
                <CheckCircle2 class="h-4 w-4 md:h-5 md:w-5" />
              </span>
            </div>
          </div>
          
          <div class="mt-6 md:mt-8 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/50">
            <div class="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out" :style="{ width: `${progress}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="error" class="flex min-h-full items-center justify-center p-4 md:p-8 text-center">
      <div>
        <div class="text-[15px] font-medium text-red-800">诊断未能完成</div>
        <p class="mt-3 text-[14px] text-red-600/80">{{ error }}</p>
        <button class="mt-6 rounded-full bg-red-100 px-6 py-2.5 text-[14px] font-medium text-red-700 transition active:scale-95 hover:bg-red-200" @click="$emit('refresh')">重新诊断</button>
      </div>
    </div>

    <div v-else-if="score" class="flex min-h-full gap-4 md:gap-5" :class="isWide ? 'flex-row items-start' : 'flex-col'">
      <!-- Apple style Light Mode Widget for Score -->
      <aside class="score-hero relative overflow-hidden rounded-[24px] md:rounded-[28px] bg-white p-5 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-zinc-200/50 shrink-0 transition-all duration-300" :class="isWide ? 'w-1/3 sticky top-0' : 'w-full'">
        <div class="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-500/5 blur-[80px]"></div>
        <div class="relative z-10 flex items-center justify-between">
          <span class="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600/80">Resume Health</span>
          <div class="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-[12px] md:rounded-[14px] bg-white text-zinc-700 shadow-[0_4px_12px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
            <ScanLine class="h-4 w-4 md:h-5 md:w-5" stroke-width="1.5" />
          </div>
        </div>
        <div class="relative z-10 mx-auto mt-5 md:mt-10 flex h-[140px] w-[140px] md:h-[220px] md:w-[220px] items-center justify-center rounded-full p-[8px] md:p-[12px]" :style="ringStyle">
          <div class="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] ring-1 ring-zinc-100">
            <div class="score-number text-[52px] md:text-[72px] font-semibold tracking-[-0.04em] leading-none text-zinc-900">{{ score.score }}</div>
            <div class="mt-1.5 md:mt-2 rounded-full bg-zinc-100 px-3.5 py-1 md:px-4 md:py-1.5 text-xs md:text-[13px] font-medium tracking-wide text-zinc-600">{{ score.level }}</div>
          </div>
        </div>
        <p class="relative z-10 mt-5 md:mt-8 text-sm md:text-[15px] leading-relaxed text-zinc-500 text-center break-words">{{ localText(score.summary) }}</p>
        <button class="relative z-10 mt-5 md:mt-8 flex w-full items-center justify-center gap-2 md:gap-2.5 rounded-full bg-zinc-900 px-4 py-2.5 md:px-5 md:py-3.5 text-sm md:text-[15px] font-medium text-white transition-all active:scale-[0.98] hover:bg-zinc-800 shadow-sm" @click="$emit('refresh')">
          <RefreshCw class="h-3.5 w-3.5 md:h-4 md:w-4" stroke-width="2" />重新扫描
        </button>
      </aside>

      <section class="min-w-0 space-y-3.5 md:space-y-5 transition-all duration-300" :class="isWide ? 'w-2/3 flex-1' : 'w-full'">
        <div class="grid gap-3.5 md:gap-4 sm:grid-cols-2">
          <!-- Glassmorphism refined cards -->
          <article v-for="(item, index) in score.details" :key="item.dimension" class="diagnosis-card rounded-[20px] md:rounded-[24px] bg-white p-4 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-zinc-200/50 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] hover:-translate-y-0.5" :style="{ animationDelay: staggerDelay(index) }">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-[15px] md:text-[16px] font-semibold tracking-tight text-zinc-900">{{ item.dimension }}</h3>
              <span class="text-sm md:text-[15px] font-semibold tabular-nums text-blue-600">{{ item.score }}<span class="text-zinc-300">/</span><span class="text-zinc-400">{{ item.max_score }}</span></span>
            </div>
            <div class="mt-3 md:mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div class="dimension-progress h-full rounded-full bg-gradient-to-r from-blue-400 to-teal-500" :style="{ width: `${detailPercent(item)}%`, animationDelay: staggerDelay(index, 65, 160) }"></div>
            </div>
            <p class="mt-3 md:mt-4 text-xs md:text-[13px] leading-relaxed text-zinc-500 break-words">{{ localText(item.comment) }}</p>
          </article>
        </div>

        <div v-if="suggestions.length" class="rounded-[20px] md:rounded-[24px] bg-white p-4.5 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-zinc-200/50">
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-[12px] md:rounded-[14px] bg-blue-50 text-blue-600 ring-1 ring-blue-100/50">
              <Sparkles class="h-4.5 w-4.5 md:h-5 md:w-5" stroke-width="1.5" />
            </span>
            <div>
              <h3 class="text-[16px] md:text-[17px] font-semibold tracking-tight text-zinc-900">优先改进建议</h3>
              <p class="mt-0.5 md:mt-1 text-xs md:text-[13px] text-zinc-400">按照对竞争力的影响程度排序</p>
            </div>
          </div>
          <div class="mt-4 md:mt-6 grid gap-2.5 md:gap-3 sm:grid-cols-2">
            <div v-for="(item, index) in suggestions" :key="item" class="suggestion-row flex gap-3 rounded-[16px] md:rounded-[20px] bg-zinc-50 p-3 md:p-4 transition-colors hover:bg-zinc-100/80" :style="{ animationDelay: staggerDelay(index, 55, 220) }">
              <span class="flex h-6 w-6 md:h-7 md:w-7 shrink-0 items-center justify-center rounded-full bg-white text-[11px] md:text-[12px] font-semibold text-blue-600 shadow-sm ring-1 ring-zinc-200/50">{{ Number(index) + 1 }}</span>
              <p class="pt-0.5 text-xs md:text-[14px] leading-relaxed text-zinc-600 break-words">{{ localText(item) }}</p>
            </div>
          </div>
        </div>

        <div v-if="score.strengths?.length" class="rounded-[20px] md:rounded-[24px] bg-blue-50/50 p-4.5 md:p-6 ring-1 ring-blue-100/50">
          <div class="flex items-center gap-2 text-sm md:text-[15px] font-semibold tracking-tight text-blue-800">
            <CheckCircle2 class="h-4.5 w-4.5 md:h-5 md:w-5" stroke-width="2" />
            值得保留的优势
          </div>
          <div class="mt-3 md:mt-4 flex flex-wrap gap-2 md:gap-2.5">
            <span v-for="item in score.strengths" :key="item" class="rounded-full bg-white px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-[13px] font-medium text-blue-700 shadow-sm ring-1 ring-blue-100/50">
              {{ localText(item) }}
            </span>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="flex min-h-full items-center justify-center p-4 md:p-8 text-center">
      <div class="max-w-md">
        <div class="mx-auto flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-[16px] md:rounded-[18px] bg-white text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
          <ScanLine class="relative z-10 h-6 w-6 md:h-7 md:w-7" stroke-width="1.5" />
        </div>
        <h3 class="mt-4 md:mt-6 text-[20px] md:text-[22px] font-semibold tracking-tight text-zinc-900">简历诊断</h3>
        <p class="mt-2 md:mt-3 text-sm md:text-[15px] leading-relaxed text-zinc-500">从内容完整度、表达质量、岗位匹配和 ATS 友好度等维度，发现简历中的可优化问题。</p>
        <button class="mt-6 md:mt-8 rounded-full bg-zinc-900 px-6 py-2.5 md:px-8 md:py-3.5 text-sm md:text-[15px] font-medium text-white shadow-md transition-all active:scale-[0.98] hover:bg-zinc-800 hover:shadow-lg" @click="$emit('refresh')">开始诊断</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-step { animation: analysis-step 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) both; }
.analysis-dot { animation: analysis-dot 1.2s ease-in-out infinite; }
.score-number { animation: score-resolve 1s cubic-bezier(0.25, 0.1, 0.25, 1) both; }
.diagnosis-card,
.suggestion-row { animation: card-rise 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) both; }
.dimension-progress { transform-origin: left; animation: progress-grow 1s cubic-bezier(0.25, 0.1, 0.25, 1) both; }

@keyframes analysis-step { 
  from { opacity: 0; transform: translateY(10px) scale(0.98); } 
  to { opacity: 1; transform: translateY(0) scale(1); } 
}
@keyframes analysis-dot { 
  0%, 70%, 100% { opacity: 0.2; transform: scale(0.8); } 
  35% { opacity: 1; transform: scale(1.2); } 
}
@keyframes score-resolve { 
  from { opacity: 0; filter: blur(15px); transform: scale(0.8); } 
  to { opacity: 1; filter: blur(0); transform: scale(1); } 
}
@keyframes card-rise { 
  from { opacity: 0; transform: translateY(16px); } 
  to { opacity: 1; transform: translateY(0); } 
}
@keyframes progress-grow { 
  from { transform: scaleX(0); } 
  to { transform: scaleX(1); } 
}
@media (prefers-reduced-motion: reduce) { 
  .analysis-step, .analysis-dot, .score-number, .diagnosis-card, .suggestion-row, .dimension-progress { 
    animation: none !important; 
  } 
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
