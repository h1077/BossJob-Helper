<script setup lang="ts">
import { computed, ref } from "vue"
import AiLoading from "./AiLoading.vue"
import AiChangeReviewModal from "./AiChangeReviewModal.vue"
import Button from "@/components/ui/button/Button.vue"
import { buildSelectedResumeData, diffResume, normalizeAiAdviceList } from "@/utils/aiDiff"

const props = defineProps<{ result: any; loading?: boolean; error?: string; currentData?: any }>()
const emit = defineEmits<{ apply: [optimizedData: any] }>()
const reviewOpen = ref(false)

function asArray(value: any) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

const optimizedData = computed(() => {
  const data = props.result?.optimized_resume_data
  if (data?.resume_data && typeof data.resume_data === "object") return data.resume_data
  return data && typeof data === "object" ? data : null
})

const diffSections = computed(() => diffResume(props.currentData, optimizedData.value))

const adviceList = computed(() => normalizeAiAdviceList([props.result?.summary, ...asArray(props.result?.changes), ...asArray(props.result?.suggestions)]))

const changeCount = computed(() => diffSections.value.reduce((total, section) => total + section.changes.length, 0))

function applyReview(selectedIds: string[]) {
  reviewOpen.value = false
  emit("apply", buildSelectedResumeData(props.currentData, optimizedData.value, selectedIds, diffSections.value))
}
</script>

<template>
  <div>
    <AiLoading v-if="loading" title="正在优化" description="AI 正在匹配岗位关键词，并生成可写入简历的优化内容。" />
    <div v-else class="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div class="h-1 bg-gradient-to-r from-blue-400 via-teal-400 to-cyan-400"></div>
      <div class="p-4 md:p-5">
      <div v-if="error" class="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">{{ error }}</div>
      <template v-else-if="result">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">Actionable changes</div>
            <h3 class="mt-1 text-sm md:text-base font-semibold text-zinc-900">{{ changeCount ? '已生成 JD 优化方案' : '暂无可采纳的 JD 优化变化' }}</h3>
            <p class="mt-1 text-xs md:text-sm leading-relaxed text-zinc-500">
              {{ changeCount ? `已识别 ${diffSections.length} 个模块、${changeCount} 项内容变化，打开变更审阅后可查看完整新增、修改和删除内容。` : 'AI 没有生成与当前简历不同的可写入版本，可调整 JD 后重新生成。' }}
            </p>
          </div>
          <span v-if="changeCount" class="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 md:px-3 md:py-1.5 text-[11px] md:text-xs font-semibold text-blue-700">{{ changeCount }} 项变化</span>
        </div>

        <div v-if="changeCount && adviceList.length" class="mt-3 md:mt-4 grid gap-2">
          <div v-for="(item, index) in adviceList.slice(0, 3)" :key="item" class="flex gap-2.5 md:gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 md:px-3.5 md:py-3"><span class="flex h-5 w-5 md:h-6 md:w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] md:text-[11px] font-semibold text-blue-600 shadow-sm">{{ index + 1 }}</span><p class="text-xs md:text-sm leading-relaxed text-zinc-600">{{ item }}</p></div>
        </div>

        <div v-if="changeCount" class="mt-3 md:mt-4 flex flex-wrap gap-2">
          <Button class="h-10 md:h-11 w-full rounded-xl bg-zinc-950 text-xs md:text-sm text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-700" @click="reviewOpen = true">查看优化建议</Button>
        </div>
      </template>
      <div v-else class="text-xs md:text-sm text-zinc-500">优化结果会显示在这里。</div>
      </div>
    </div>

    <AiChangeReviewModal
      v-if="changeCount"
      :open="reviewOpen"
      title="JD 优化变更审阅"
      subtitle="这里展示本次优化会写入简历的完整变化，确认后再采纳。"
      :sections="diffSections"
      :suggestions="adviceList"
      apply-label="采纳 JD 优化结果"
      empty-text="没有检测到可写入的简历变化，请重新生成 JD 优化。"
      @close="reviewOpen = false"
      @apply="applyReview"
    />
  </div>
</template>
