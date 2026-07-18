<script setup lang="ts">
import { computed } from "vue"
import Label from "@/components/ui/label/Label.vue"
import Input from "@/components/ui/input/Input.vue"
import RichTextEditor from "./RichTextEditor.vue"
import RichTextListEditor from "./RichTextListEditor.vue"
import EditableFieldLabel from "./EditableFieldLabel.vue"

const props = defineProps<{
  item: any
  sectionKey: string
  displayFieldLabels?: Record<string, string>
  editableDisplayFields?: string[]
  customizedDisplayFields?: string[]
}>()
const emit = defineEmits<{
  change: []
  updateFieldLabel: [fieldKey: string, value: string]
  resetFieldLabel: [fieldKey: string]
}>()

const fieldLabels: Record<string, string> = {
  school: "学校", major: "专业", degree: "学历", start_date: "开始时间", end_date: "结束时间",
  name: "名称", keywords: "关键词", company: "公司", position: "职位", role: "角色",
  tech_stack: "技术栈", date: "时间",
}

const fieldOrder: Record<string, number> = {
  school: 1,
  company: 2,
  name: 3,
  major: 4,
  position: 5,
  role: 6,
  degree: 7,
  date: 8,
  start_date: 9,
  end_date: 10,
  tech_stack: 11,
  keywords: 12,
}

const sortedKeys = computed(() => {
  return Object.keys(props.item)
    .filter(k => !['id', 'description', 'highlights'].includes(k))
    .sort((a, b) => (fieldOrder[a] ?? 99) - (fieldOrder[b] ?? 99))
})

const sectionHints: Record<string, { description: string; highlights: string }> = {
  education: { description: "例如：主修课程、GPA、竞赛经历等", highlights: "每行一条学习成果" },
  skills: { description: "例如：熟悉 Spring Boot、MySQL、Redis，有接口设计和性能优化经验", highlights: "每行一条技能亮点" },
  work: { description: "例如：负责的业务、技术栈、协作方式和结果", highlights: "每行一条工作成果" },
  projects: { description: "例如：项目背景、职责范围、核心技术和上线结果", highlights: "每行一条项目亮点" },
  awards: { description: "例如：奖项级别、获奖背景或作品说明", highlights: "每行一条说明" },
}

function splitInputTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  return String(value ?? "").split(/[,，、;；\n\r]+/).map((item) => item.trim()).filter(Boolean)
}

function getFieldValue(item: any, key: string) {
  if (key === "keywords" && Array.isArray(item[key])) return item[key].join(", ")
  return item[key]
}

function setFieldValue(item: any, key: string, value: unknown) {
  item[key] = key === "keywords" ? splitInputTags(value) : value
  emit("change")
}

function displayFieldLabel(key: string) {
  return props.displayFieldLabels?.[key] ?? fieldLabels[key] ?? key
}
</script>
<template>
  <div class="px-5 py-5 sm:px-6 sm:py-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div v-for="key in sortedKeys" :key="key" :class="{ 'sm:col-span-2': ['tech_stack', 'keywords'].includes(key) }">
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center">
            <EditableFieldLabel
              v-if="editableDisplayFields?.includes(key)"
              :model-value="displayFieldLabel(key)"
              :fallback-label="fieldLabels[key] || key"
              :customized="customizedDisplayFields?.includes(key)"
              @update:model-value="emit('updateFieldLabel', key, $event)"
              @reset="emit('resetFieldLabel', key)"
              class="!mb-0"
            />
            <Label v-else class="text-[13px] text-zinc-600 block font-medium m-0">{{ displayFieldLabel(key) }}</Label>
          </div>
          <slot :name="`append-${key}`"></slot>
        </div>
        <Input 
          :model-value="getFieldValue(item, key)" 
          :placeholder="displayFieldLabel(key)"
          @update:model-value="setFieldValue(item, key, $event)"
        />
      </div>
    </div>
    <div class="mt-4">
      <div class="flex items-center justify-between mb-1.5">
        <Label class="text-[13px] text-zinc-600 block font-medium m-0">详细说明</Label>
        <slot name="append-description"></slot>
      </div>
      <RichTextEditor v-model="item.description" :placeholder="sectionHints[sectionKey]?.description || '填写详细说明'" @update:model-value="$emit('change')" />
    </div>
    <div v-if="'highlights' in item" class="mt-4">
      <Label class="text-[13px] text-zinc-600 mb-1.5 block font-medium">亮点</Label>
      <RichTextListEditor :model-value="item.highlights || []" :placeholder="sectionHints[sectionKey]?.highlights || '输入亮点，可使用列表、加粗等格式'" @update:model-value="item.highlights = $event; $emit('change')" />
    </div>
  </div>
</template>
