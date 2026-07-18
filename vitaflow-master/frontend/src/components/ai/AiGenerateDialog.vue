<script setup lang="ts">
import { ref, watch } from "vue"
import Button from "@/components/ui/button/Button.vue"
import AiLoading from "./AiLoading.vue"
import { showGlobalToast } from "@/utils/toast"

const props = defineProps<{
  loading?: boolean
  streamText?: string
  initialTargetPosition?: string
  initialPersonalInfo?: string
  initialStyle?: string
}>()
const emit = defineEmits<{ generate: [payload: any] }>()
const form = ref({
  target_position: "",
  personal_info: "",
  style: "技术型",
  language: "zh-CN",
})

watch(
  () => [props.initialTargetPosition, props.initialPersonalInfo, props.initialStyle],
  ([targetPosition, personalInfo, style]) => {
    form.value.target_position = String(targetPosition || "")
    form.value.personal_info = String(personalInfo || "")
    form.value.style = String(style || "技术型")
  },
  { immediate: true },
)

function submit() {
  if (!form.value.target_position.trim()) {
    showGlobalToast("请输入目标职位", "error")
    return
  }
  if (!form.value.personal_info.trim()) {
    showGlobalToast("请输入个人基础信息", "error")
    return
  }
  emit("generate", {
    target_position: form.value.target_position,
    basics: { title: form.value.target_position },
    education: form.value.personal_info,
    skills: [],
    projects: form.value.personal_info,
    work: form.value.personal_info,
    awards: form.value.personal_info,
    style: form.value.style,
    language: form.value.language,
    personal_info: form.value.personal_info,
  })
}
</script>
<template>
  <div class="flex flex-col h-full">
    <div v-if="loading" class="flex flex-col h-full justify-center">
      <AiLoading title="正在建立个人档案" description="AI 正在提取你的个人信息，并按岗位生成结构化简历。" :stream-text="streamText" />
    </div>
    <div v-else class="flex flex-col gap-5 h-full">
      <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-medium text-zinc-700 shrink-0">目标职位</label>
        <input v-model="form.target_position" placeholder="例如：Java 后端开发工程师、产品经理..." class="h-12 w-full rounded-[16px] bg-zinc-50/80 px-4 text-[15px] font-medium text-zinc-800 placeholder:text-zinc-400 border-0 ring-1 ring-zinc-200/50 transition-all focus:bg-white focus:ring-blue-500/30 focus:shadow-[0_8px_30px_rgba(16,185,129,0.06)] outline-none" />
      </div>
      <div class="flex flex-col gap-1.5 flex-1 min-h-0">
        <label class="text-[13px] font-medium text-zinc-700 shrink-0">个人信息</label>
        <div class="flex-1 min-h-[300px] relative rounded-[20px] bg-zinc-50/80 ring-1 ring-zinc-200/50 transition-all focus-within:bg-white focus-within:ring-blue-500/30 focus-within:shadow-[0_8px_30px_rgba(16,185,129,0.06)] overflow-hidden">
          <textarea v-model="form.personal_info" placeholder="把姓名、学历、技能、项目、经历、奖项等信息写在这里" class="absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-5 text-[15px] leading-relaxed text-zinc-800 placeholder:text-zinc-400 outline-none thin-scrollbar" style="box-shadow: none;" />
        </div>
      </div>
      <div class="flex flex-col gap-4 pt-1">
        <div class="flex items-center justify-between">
          <label class="text-[13px] font-medium text-zinc-700">简历语言</label>
          <div class="flex rounded-full bg-zinc-100 p-1">
            <button
              class="rounded-full px-3 py-1.5 text-xs font-medium transition"
              :class="form.language === 'zh-CN' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'"
              @click="form.language = 'zh-CN'"
            >
              中文
            </button>
            <button
              class="rounded-full px-3 py-1.5 text-xs font-medium transition"
              :class="form.language === 'en' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'"
              @click="form.language = 'en'"
            >
              English
            </button>
          </div>
        </div>
        <Button class="h-14 w-full rounded-full bg-zinc-900 text-[16px] font-medium text-white shadow-md transition-all active:scale-[0.98] hover:bg-zinc-800 hover:shadow-lg" @click="submit">
          生成并创建简历
        </Button>
      </div>
    </div>
  </div>
</template>
