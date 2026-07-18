<script setup lang="ts">
import { computed, ref } from "vue"
import AiChangeReviewModal from "@/components/ai/AiChangeReviewModal.vue"
import AiLoading from "@/components/ai/AiLoading.vue"
import Button from "@/components/ui/button/Button.vue"
import { diffSection, normalizeAiAdviceList } from "@/utils/aiDiff"

const props = defineProps<{
  result?: any
  sectionKey: string
  sectionTitle: string
  currentValue?: any
  preview?: any
  loading?: boolean
  error?: string
  streamText?: string
}>()

const emit = defineEmits<{ apply: []; retry: []; clear: [] }>()
const reviewOpen = ref(false)

function asArray(value: unknown) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function adviceList() {
  const items = [...asArray(props.result?.changes), ...asArray(props.result?.suggestions)]
  return normalizeAiAdviceList(items)
}

const diffItems = computed(() => (props.preview ? diffSection(props.sectionKey, props.currentValue, props.preview, props.sectionTitle) : []))
const diffSections = computed(() => (diffItems.value.length ? [{ key: props.sectionKey, title: props.sectionTitle, changes: diffItems.value }] : []))
const changeCount = computed(() => diffItems.value.length)
const noChangeMessage = computed(() => {
  const advice = adviceList()
  if (advice.length) return advice.slice(0, 2)
  return [
    "这个模块当前表达已经比较完整，AI 没有发现值得直接写入的实质改动。",
    "系统没有强行制造修改；如果你想换一种风格，可以补充目标岗位或希望突出的方向后重新润色。",
  ]
})

function applyReview() {
  reviewOpen.value = false
  emit("apply")
}
</script>

<template>
  <div class="mb-5">
    <AiLoading v-if="loading" title="正在润色当前模块" description="AI 正在基于当前模块内容生成可直接写入的优化版本。" :stream-text="streamText" />

    <div v-else-if="error" class="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>

    <div v-else-if="result" class="rounded-xl border p-4" :class="changeCount ? 'border-blue-100 bg-blue-50/70' : 'border-zinc-200 bg-white'">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="font-semibold text-zinc-900">{{ changeCount ? `${sectionTitle}润色结果` : `${sectionTitle}暂无可采纳变化` }}</h3>
          <p class="mt-1 text-xs leading-5 text-zinc-500">
            {{ changeCount ? '已生成当前模块的优化方案，打开变更审阅后可查看完整变化。' : '这部分已经比较稳了，AI 没有发现需要直接写入的实质改动。' }}
          </p>
        </div>
        <span v-if="changeCount" class="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-600">{{ changeCount }} 项变化</span>
        <span v-else class="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">无需修改</span>
      </div>

      <ul v-if="changeCount && adviceList().length" class="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
        <li v-for="item in adviceList().slice(0, 3)" :key="item">{{ item }}</li>
      </ul>
      <ul v-else-if="!changeCount" class="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
        <li v-for="item in noChangeMessage" :key="item" class="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-zinc-100">{{ item }}</li>
      </ul>

      <div class="mt-4 flex flex-wrap gap-2">
        <Button v-if="changeCount" size="sm" @click="reviewOpen = true">查看变更并采纳</Button>
        <Button size="sm" variant="outline" @click="$emit('retry')">重新润色</Button>
        <Button size="sm" variant="ghost" @click="$emit('clear')">取消</Button>
      </div>

      <AiChangeReviewModal
        v-if="changeCount"
        :open="reviewOpen"
        :title="`${sectionTitle}变更审阅`"
        subtitle="这里展示本次润色会写入当前模块的完整变化，确认后再采纳。"
        :sections="diffSections"
        :suggestions="adviceList()"
        apply-label="采纳到当前模块"
        empty-text="没有检测到可写入的模块变化，请重新润色。"
        @close="reviewOpen = false"
        @apply="applyReview"
      />
    </div>
  </div>
</template>
