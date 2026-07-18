<script setup lang="ts">
import { PanelLeftClose, Sparkles, Pencil } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Switch from "@/components/ui/switch/Switch.vue"
import BasicInfoForm from "./BasicInfoForm.vue"
import SectionListForm from "./SectionListForm.vue"
import SummaryForm from "./SummaryForm.vue"
import CustomSectionForm from "./CustomSectionForm.vue"
import StyleConfigPanel from "./StyleConfigPanel.vue"
import SectionOptimizeInline from "./SectionOptimizeInline.vue"
import type { ResumeData, TemplateConfig } from "@/types/resume"
import { effectiveFieldLabel } from "@/utils/resumeLocale"

const props = defineProps<{
  data: ResumeData
  config: TemplateConfig
  current: string
  language: string
  showStyle: boolean
  optimizeResult?: any
  optimizePreview?: any
  optimizeLoading?: boolean
  optimizeError?: string
  optimizeStreamText?: string
  isWide?: boolean
}>()
const emit = defineEmits<{ change: []; optimize: []; applyOptimize: []; clearOptimize: [] }>()
function customSection() {
  return props.data.custom_sections.find((item) => item.id === props.current)
}

function currentSectionValue() {
  if ((props.data as any)[props.current] !== undefined) return (props.data as any)[props.current]
  return customSection()
}

function skillsOptions() {
  const layout = props.data.layout as any
  if (!layout.skills_options || typeof layout.skills_options !== "object" || Array.isArray(layout.skills_options)) {
    layout.skills_options = {}
  }
  layout.skills_options.show_keywords = layout.skills_options.show_keywords !== false
  layout.skills_options.description_inline = layout.skills_options.description_inline === true
  return layout.skills_options as { show_keywords: boolean; description_inline: boolean }
}

function setSkillOption(key: "show_keywords" | "description_inline", value: boolean) {
  skillsOptions()[key] = value
  emit("change")
}

function setFieldLabel(sectionKey: string, fieldKey: string, value: string) {
  props.data.layout.field_labels ||= {}
  props.data.layout.field_labels[sectionKey] ||= {}
  props.data.layout.field_labels[sectionKey][fieldKey] = value
  emit("change")
}

function resetFieldLabel(sectionKey: string, fieldKey: string) {
  const fieldLabels = props.data.layout.field_labels
  const sectionLabels = fieldLabels?.[sectionKey]
  if (!sectionLabels) return
  delete sectionLabels[fieldKey]
  if (!Object.keys(sectionLabels).length && fieldLabels) delete fieldLabels[sectionKey]
  emit("change")
}

function isFieldLabelCustomized(sectionKey: string, fieldKey: string) {
  return typeof props.data.layout.field_labels?.[sectionKey]?.[fieldKey] === "string"
}

function hasCustomTechStack() {
  const section = customSection()
  return Boolean(
    section
    && (
      ["open_source", "portfolio"].includes(section.preset_type)
      || section.items?.some((item: any) => Object.prototype.hasOwnProperty.call(item || {}, "tech_stack"))
    )
  )
}
</script>

<template>
  <section class="h-full shrink-0 flex flex-col border-r border-zinc-200/60 bg-white/95 backdrop-blur-sm shadow-[10px_0_15px_-3px_rgba(0,0,0,0.02)]">
    <!-- Scrollable Content -->
    <div class="flex-1 flex flex-col min-h-0 overflow-y-auto thin-scrollbar">
      <!-- Section Header (Scrolls with content) -->
      <div class="flex items-center justify-between border-b border-zinc-100/80 bg-white/80 px-3 py-2 md:px-5 md:py-4 shrink-0 z-10">
        <div class="flex-1 min-w-0 mr-2 md:mr-4">
          <div class="group relative inline-flex items-center -ml-1 md:-ml-2 max-w-full">
            <div class="inline-grid items-center max-w-full">
              <span class="col-start-1 row-start-1 invisible whitespace-nowrap pl-1 md:pl-2 pr-8 md:pr-11 py-0.5 md:py-1 text-[15px] sm:text-[18px] font-semibold tracking-tight overflow-hidden">{{ data.layout.section_titles[current] || current }}</span>
              <input 
                :value="data.layout.section_titles[current] || current"
                @input="data.layout.section_titles[current] = ($event.target as HTMLInputElement).value; $emit('change')"
                size="1"
                class="peer col-start-1 row-start-1 w-full min-w-0 border border-transparent bg-transparent pl-1 md:pl-2 pr-6 md:pr-8 py-0.5 md:py-1 text-[15px] sm:text-[18px] font-semibold tracking-tight text-zinc-900 shadow-none hover:border-zinc-200 hover:bg-zinc-50 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all outline-none rounded-md"
              />
            </div>
            <Pencil class="absolute right-2 h-3.5 w-3.5 text-zinc-400 pointer-events-none opacity-40 transition-opacity group-hover:opacity-100 peer-focus:opacity-0" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button v-if="current !== 'basics'" size="sm" variant="outline" class="h-7 md:h-8 text-xs md:text-sm border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm transition-all" :disabled="optimizeLoading" @click="$emit('optimize')">
            <Sparkles class="h-3.5 w-3.5 mr-1 md:mr-1.5 text-zinc-500" /> AI 润色
          </Button>
        </div>
      </div>
      
      <!-- Form Content -->
      <div class="p-2.5 md:p-5 pb-20 md:pb-5 flex-1 shrink-0">
      <SectionOptimizeInline
        v-if="current !== 'basics' && (optimizeLoading || optimizeError || optimizeResult)"
        :section-key="current"
        :section-title="data.layout.section_titles[current] || current"
        :current-value="currentSectionValue()"
        :result="optimizeResult"
        :preview="optimizePreview"
        :loading="optimizeLoading"
        :error="optimizeError"
        :stream-text="optimizeStreamText"
        @apply="$emit('applyOptimize')"
        @retry="$emit('optimize')"
        @clear="$emit('clearOptimize')"
      />
      <StyleConfigPanel v-if="showStyle" :config="config" class="mb-4" @change="$emit('change')" />
      <BasicInfoForm v-if="current === 'basics'" :basics="data.basics" @change="$emit('change')" />
      <SummaryForm v-else-if="current === 'summary'" :summary="data.summary" @change="$emit('change')" />
      <div v-else-if="current === 'skills'">
        <SectionListForm section-key="skills" :items="data.skills" :is-wide="isWide" @change="$emit('change')">
          <template #append-keywords>
            <div class="flex items-center gap-1.5">
              <label class="text-[12px] text-zinc-400 font-normal cursor-pointer select-none" @click="setSkillOption('show_keywords', !skillsOptions().show_keywords)">显示</label>
              <Switch class="scale-[0.75] origin-right" :model-value="skillsOptions().show_keywords" @update:model-value="setSkillOption('show_keywords', $event)" />
            </div>
          </template>
          <template #append-description>
            <div class="flex items-center gap-1.5">
              <label class="text-[12px] text-zinc-400 font-normal cursor-pointer select-none" @click="setSkillOption('description_inline', !!skillsOptions().description_inline)">换行</label>
              <Switch class="scale-[0.75] origin-right" :model-value="!skillsOptions().description_inline" @update:model-value="setSkillOption('description_inline', !$event)" />
            </div>
          </template>
        </SectionListForm>
      </div>
      <SectionListForm
        v-else-if="current === 'projects'"
        section-key="projects"
        :items="data.projects"
        :is-wide="isWide"
        :display-field-labels="{ tech_stack: effectiveFieldLabel(data, 'projects', 'tech_stack', language) }"
        :editable-display-fields="['tech_stack']"
        :customized-display-fields="isFieldLabelCustomized('projects', 'tech_stack') ? ['tech_stack'] : []"
        @change="$emit('change')"
        @update-field-label="(key, value) => setFieldLabel('projects', key, value)"
        @reset-field-label="(key) => resetFieldLabel('projects', key)"
      />
      <SectionListForm v-else-if="['education','work','awards'].includes(current)" :section-key="current" :items="(data as any)[current]" :is-wide="isWide" @change="$emit('change')" />
      <CustomSectionForm
        v-else-if="customSection()"
        :section="customSection()"
        :is-wide="isWide"
        :display-field-labels="hasCustomTechStack() ? { tech_stack: effectiveFieldLabel(data, current, 'tech_stack', language, true) } : {}"
        :editable-display-fields="hasCustomTechStack() ? ['tech_stack'] : []"
        :customized-display-fields="isFieldLabelCustomized(current, 'tech_stack') ? ['tech_stack'] : []"
        @change="$emit('change')"
        @update-field-label="(key, value) => setFieldLabel(current, key, value)"
        @reset-field-label="(key) => resetFieldLabel(current, key)"
      />
      </div>
    </div>
  </section>
</template>
