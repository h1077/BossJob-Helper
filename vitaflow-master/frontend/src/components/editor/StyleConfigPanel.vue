<script setup lang="ts">
import { RotateCcw, Plus, Minus, Check } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Input from "@/components/ui/input/Input.vue"
import Label from "@/components/ui/label/Label.vue"
import Switch from "@/components/ui/switch/Switch.vue"
import Select from "@/components/ui/select/Select.vue"
import { normalizeTemplateConfig } from "@/stores/resume"
import type { TemplateConfig } from "@/types/resume"
const props = defineProps<{ config: TemplateConfig }>()
const emit = defineEmits<{ change: []; resetDefault: [] }>()
const numberFields = [
  "name_font_size",
  "title_font_size",
  "body_font_size",
  "line_height",
  "page_margin_top",
  "page_margin_bottom",
  "next_page_margin_top",
  "next_page_margin_bottom",
  "page_margin_right",
  "page_margin_left",
  "section_margin_top",
  "section_margin_bottom",
  "section_title_margin_bottom",
]
const fieldLabels: Record<string, string> = {
  name_font_size: "姓名字号",
  title_font_size: "标题字号",
  body_font_size: "正文字号",
  line_height: "正文行高",
  page_margin_top: "首页上边距",
  page_margin_right: "右边距",
  page_margin_bottom: "首页下边距",
  page_margin_left: "左边距",
  next_page_margin_top: "续页上边距",
  next_page_margin_bottom: "续页下边距",
  section_margin_top: "模块上间距",
  section_margin_bottom: "模块下间距",
  section_title_margin_bottom: "模块标题间距",
}
const templates = [
  { value: "classic", label: "经典单栏" },
  { value: "tech", label: "技术蓝线" },
  { value: "modern", label: "现代侧栏" },
  { value: "blue_timeline", label: "蓝色时间轴" },
  { value: "minimal_light", label: "极简明亮" },
  { value: "minimal_mono", label: "极简单色" },
  { value: "modern_clean", label: "现代清新" },
  { value: "elegant_line", label: "优雅线型" },
  { value: "editorial_serif", label: "编辑部衬线" },
  { value: "executive_panel", label: "商务简报" },
  { value: "portfolio_cards", label: "作品集卡片" },
  { value: "compact_matrix", label: "紧凑矩阵" },
]
const fonts = [
  { value: "vf-sans", label: "简洁黑体" },
  { value: "vf-serif", label: "正式宋体" },
  { value: "vf-rounded", label: "温和圆体" },
  { value: "vf-kai", label: "文雅楷体" },
]
const avatarPositions = [
  { value: "left", label: "靠左" },
  { value: "center", label: "居中" },
  { value: "right", label: "靠右" },
] as const
function getConfigValue(field: string) {
  return (props.config as unknown as Record<string, number>)[field]
}
function setConfigValue(field: string, value: string) {
  ;(props.config as unknown as Record<string, number>)[field] = Number(value)
}
function stepConfigValue(field: string, delta: number) {
  const current = Number((props.config as unknown as Record<string, number>)[field]) || 0
  let next = current + delta
  if (field === "line_height") {
    next = Number(next.toFixed(1))
    if (next < 1.0) next = 1.0
    if (next > 3.0) next = 3.0
  } else {
    next = Math.round(next)
    if (next < 0) next = 0
  }
  ;(props.config as unknown as Record<string, number>)[field] = next
  emit("change")
}
function selectFont(value: string) {
  props.config.font_family = value
}
function selectAvatarPosition(value: TemplateConfig["avatar_position"]) {
  props.config.avatar_position = value
  emit("change")
}

const colorFields = [
  { key: "theme_color", label: "主题色" },
  { key: "bg_color", label: "背景颜色" },
  { key: "name_font_color", label: "姓名颜色" },
  { key: "title_font_color", label: "标题颜色" },
  { key: "body_font_color", label: "正文颜色" },
  { key: "icon_color", label: "图标颜色" },
]

function getColorValue(field: string): string {
  return ((props.config as unknown as Record<string, string>)[field] || "#000000").toUpperCase()
}
function setColorValue(field: string, value: string) {
  ;(props.config as unknown as Record<string, string>)[field] = value
  if (field === "icon_color") {
    props.config.header_icon_color = value
  }
  emit("change")
}

function resetDefaultStyle() {
  const templateId = props.config.template_id || "tech"
  Object.assign(props.config, normalizeTemplateConfig({}, templateId))
  emit("resetDefault")
}
</script>
<template>
  <div class="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">样式设置</h3>
      <Button size="sm" variant="outline" class="h-8 shrink-0 border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900" @click="resetDefaultStyle">
        <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
        恢复默认
      </Button>
    </div>
    <div>
      <Label class="text-xs font-medium text-zinc-700">字体排版</Label>
      <div class="mt-2 grid grid-cols-2 gap-2.5">
        <button
          v-for="item in fonts"
          :key="item.value"
          type="button"
          class="flex flex-col items-start rounded-xl border p-2.5 transition-all duration-200 active:scale-95 text-left w-full select-none"
          :class="config.font_family === item.value ? 'border-zinc-900 bg-zinc-900 text-white shadow-md' : 'border-zinc-200/80 bg-zinc-50/50 text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900 hover:shadow-sm'"
          @click="config.font_family = item.value; $emit('change')"
        >
          <div class="flex w-full items-center justify-between">
            <span class="text-base font-semibold tracking-wide" :style="{ fontFamily: item.value }">Aa 文</span>
            <div
              v-if="config.font_family === item.value"
              class="flex h-4 w-4 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm"
            >
              <Check class="h-2.5 w-2.5 stroke-[3]" />
            </div>
          </div>
          <span class="mt-2 text-xs font-medium opacity-90">{{ item.label }}</span>
        </button>
      </div>
    </div>
    <div>
      <Label>头像位置</Label>
      <div class="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-zinc-100/80 p-1 block w-full">
        <button
          v-for="item in avatarPositions"
          :key="item.value"
          type="button"
          class="flex h-8 items-center justify-center rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap select-none"
          :class="config.avatar_position === item.value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'"
          @click="selectAvatarPosition(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div v-for="item in colorFields" :key="item.key" class="space-y-1.5">
        <Label class="text-xs font-medium text-zinc-700">{{ item.label }}</Label>
        <div class="flex h-9 w-full items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-2.5 transition-colors focus-within:border-zinc-900 focus-within:bg-white">
          <div
            class="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-zinc-200/80 shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            :style="{ backgroundColor: getColorValue(item.key) }"
          >
            <input
              :value="getColorValue(item.key)"
              type="color"
              class="absolute inset-[-10px] h-[40px] w-[40px] cursor-pointer opacity-0"
              @input="setColorValue(item.key, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <input
            :value="getColorValue(item.key)"
            type="text"
            maxlength="7"
            class="w-full bg-transparent text-xs font-mono font-medium text-zinc-700 outline-none uppercase select-all"
            @input="setColorValue(item.key, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div v-for="field in numberFields" :key="field" class="space-y-1.5">
        <Label class="text-xs font-medium text-zinc-700">{{ fieldLabels[field] }}</Label>
        <div class="flex h-9 items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-1 block w-full transition-colors focus-within:border-zinc-900 focus-within:bg-white">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-white hover:text-zinc-900 hover:shadow-sm active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none"
            :disabled="field === 'line_height' ? getConfigValue(field) <= 1.0 : getConfigValue(field) <= 0"
            @click="stepConfigValue(field, field === 'line_height' ? -0.1 : -1)"
          >
            <Minus class="h-3.5 w-3.5" />
          </button>
          <input
            :value="getConfigValue(field)"
            type="number"
            :step="field === 'line_height' ? 0.1 : 1"
            class="w-12 bg-transparent text-center text-xs font-semibold text-zinc-800 outline-none select-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            @input="setConfigValue(field, ($event.target as HTMLInputElement).value); $emit('change')"
          />
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-white hover:text-zinc-900 hover:shadow-sm active:scale-95"
            @click="stepConfigValue(field, field === 'line_height' ? 0.1 : 1)"
          >
            <Plus class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between"><Label>显示头像</Label><Switch v-model="config.show_avatar" @update:model-value="$emit('change')" /></div>
  </div>
</template>
