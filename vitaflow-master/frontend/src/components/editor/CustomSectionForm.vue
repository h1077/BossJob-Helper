<script setup lang="ts">
import { computed, ref } from "vue"
import { ArrowDown, ArrowUp, ChevronRight, FileEdit, Plus, Trash2 } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Input from "@/components/ui/input/Input.vue"
import Label from "@/components/ui/label/Label.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import RichTextEditor from "./RichTextEditor.vue"
import RichTextListEditor from "./RichTextListEditor.vue"
import EditableFieldLabel from "./EditableFieldLabel.vue"
import { createPresetItem, modulePresetByType, presetItemSubtitle, presetItemTitle } from "@/utils/resumePresets"
const props = defineProps<{
  section: any
  isWide?: boolean
  displayFieldLabels?: Record<string, string>
  editableDisplayFields?: string[]
  customizedDisplayFields?: string[]
}>()
const emit = defineEmits<{
  change: []
  updateFieldLabel: [fieldKey: string, value: string]
  resetFieldLabel: [fieldKey: string]
}>()

const showDeleteConfirm = ref(false)
const deletingItemIndex = ref<number | null>(null)
const activeItemId = ref<string | null>(props.section.items?.[0]?.id || null)
const preset = computed(() => modulePresetByType(props.section.preset_type))
const activeItem = computed(() => (props.section.items || []).find((item: any) => item.id === activeItemId.value))

function triggerDelete(index: number | string) {
  deletingItemIndex.value = Number(index)
  showDeleteConfirm.value = true
}

function confirmDelete() {
  if (deletingItemIndex.value !== null) {
    props.section.items.splice(deletingItemIndex.value, 1)
    emit("change")
  }
  showDeleteConfirm.value = false
  deletingItemIndex.value = null
}

function addItem() {
  props.section.items ||= []
  const item = createPresetItem(props.section.preset_type)
  props.section.items.push(item)
  activeItemId.value = item.id
  emit("change")
}

function moveItem(index: number, direction: -1 | 1) {
  if (index + direction < 0 || index + direction >= props.section.items.length) return
  const temp = props.section.items[index]
  props.section.items[index] = props.section.items[index + direction]
  props.section.items[index + direction] = temp
  emit("change")
}

function updateField(item: any, key: string, value: unknown) {
  item[key] = value
  emit("change")
}

function displayFieldLabel(field: { key: string; label: string }) {
  return props.displayFieldLabels?.[field.key] ?? field.label
}
</script>
<template>
  <div v-if="preset" :class="isWide ? 'flex gap-6 items-start' : 'space-y-4'">
    <div :class="isWide ? 'w-[320px] shrink-0 flex flex-col gap-3 sticky top-4' : 'flex flex-col gap-3'">
      <div v-for="(item, i) in section.items" :key="item.id" class="flex flex-col">
        <div
          class="rounded-[16px] border bg-white p-4 cursor-pointer transition-all flex items-center justify-between group"
          :class="activeItemId === item.id ? 'border-zinc-900 shadow-sm ring-1 ring-zinc-900/10' : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-sm'"
          @click="activeItemId = activeItemId === item.id ? null : item.id"
        >
          <div class="min-w-0 pr-4">
            <div class="text-[14px] font-semibold text-zinc-900 truncate tracking-tight">{{ presetItemTitle(preset, item, `新${preset.title}`) }}</div>
            <div class="text-[12px] text-zinc-500 truncate mt-0.5">{{ presetItemSubtitle(preset, item) }}</div>
          </div>
          <div class="flex items-center gap-1 transition-opacity shrink-0" :class="activeItemId === item.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto'" @click.stop>
            <Button size="icon" variant="ghost" class="h-7 w-7 text-zinc-400 hover:text-zinc-700" :disabled="i === 0" @click="moveItem(Number(i), -1)">
              <ArrowUp class="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" class="h-7 w-7 text-zinc-400 hover:text-zinc-700" :disabled="i === section.items.length - 1" @click="moveItem(Number(i), 1)">
              <ArrowDown class="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" class="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50" @click="triggerDelete(i)">
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </div>
          <div v-if="activeItemId !== item.id" class="sm:group-hover:hidden text-zinc-400">
            <ChevronRight class="h-4 w-4" />
          </div>
        </div>
      </div>

      <Button size="sm" variant="outline" class="w-full mt-1 border-dashed border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-900 hover:bg-zinc-50 bg-transparent h-10 transition-colors" @click="addItem">
        <Plus class="h-4 w-4 mr-1.5" />添加新条目
      </Button>
    </div>

    <div v-if="isWide" class="w-2/3 flex-1">
      <div v-if="activeItem" class="rounded-[20px] border border-zinc-200/80 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div class="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h3 class="text-sm font-semibold text-zinc-800 tracking-tight">编辑: {{ presetItemTitle(preset, activeItem, `新${preset.title}`) }}</h3>
        </div>
        <div class="px-5 py-5 sm:px-6 sm:py-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div v-for="field in preset.fields.filter((field) => field.type !== 'rich' && field.type !== 'list')" :key="field.key" :class="{ 'sm:col-span-2': field.span === 2 }">
              <EditableFieldLabel
                v-if="editableDisplayFields?.includes(field.key)"
                :model-value="displayFieldLabel(field)"
                :fallback-label="field.label"
                :customized="customizedDisplayFields?.includes(field.key)"
                @update:model-value="emit('updateFieldLabel', field.key, $event)"
                @reset="emit('resetFieldLabel', field.key)"
              />
              <Label v-else class="text-[13px] text-zinc-600 mb-1.5 block font-medium">{{ displayFieldLabel(field) }}</Label>
              <Input
                :model-value="activeItem[field.key]"
                :placeholder="field.placeholder || displayFieldLabel(field)"
                @update:model-value="updateField(activeItem, field.key, $event)"
              />
            </div>
          </div>
          <div v-for="field in preset.fields.filter((field) => field.type === 'rich')" :key="field.key" class="mt-4">
            <Label class="text-[13px] text-zinc-600 mb-1.5 block font-medium">{{ field.label }}</Label>
            <RichTextEditor
              :model-value="activeItem[field.key]"
              :placeholder="field.placeholder || '填写详细说明'"
              @update:model-value="updateField(activeItem, field.key, $event)"
            />
          </div>
          <div v-for="field in preset.fields.filter((field) => field.type === 'list')" :key="field.key" class="mt-4">
            <Label class="text-[13px] text-zinc-600 mb-1.5 block font-medium">{{ field.label }}</Label>
            <RichTextListEditor
              :model-value="activeItem[field.key] || []"
              :placeholder="field.placeholder || '每行一条亮点，可使用加粗等格式'"
              @update:model-value="updateField(activeItem, field.key, $event)"
            />
          </div>
        </div>
      </div>
      <div v-else class="flex flex-col items-center justify-center py-24 text-zinc-400 border border-dashed rounded-[20px] border-zinc-200 bg-zinc-50/50">
        <div class="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-100 mb-4">
          <FileEdit class="w-7 h-7 text-zinc-300" />
        </div>
        <span class="text-[15px] font-medium text-zinc-500">在左侧选择一个条目进行编辑</span>
      </div>
    </div>

    <div v-if="!isWide && activeItem" class="rounded-[20px] border border-zinc-200/80 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      <div class="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
        <h3 class="text-sm font-semibold text-zinc-800 tracking-tight">编辑: {{ presetItemTitle(preset, activeItem, `新${preset.title}`) }}</h3>
      </div>
      <div class="px-5 py-5">
        <div class="grid grid-cols-1 gap-4">
          <div v-for="field in preset.fields.filter((field) => field.type !== 'rich' && field.type !== 'list')" :key="field.key">
            <EditableFieldLabel
              v-if="editableDisplayFields?.includes(field.key)"
              :model-value="displayFieldLabel(field)"
              :fallback-label="field.label"
              :customized="customizedDisplayFields?.includes(field.key)"
              @update:model-value="emit('updateFieldLabel', field.key, $event)"
              @reset="emit('resetFieldLabel', field.key)"
            />
            <Label v-else class="text-[13px] text-zinc-600 mb-1.5 block font-medium">{{ displayFieldLabel(field) }}</Label>
            <Input
              :model-value="activeItem[field.key]"
              :placeholder="field.placeholder || displayFieldLabel(field)"
              @update:model-value="updateField(activeItem, field.key, $event)"
            />
          </div>
        </div>
        <div v-for="field in preset.fields.filter((field) => field.type === 'rich')" :key="field.key" class="mt-4">
          <Label class="text-[13px] text-zinc-600 mb-1.5 block font-medium">{{ field.label }}</Label>
          <RichTextEditor
            :model-value="activeItem[field.key]"
            :placeholder="field.placeholder || '填写详细说明'"
            @update:model-value="updateField(activeItem, field.key, $event)"
          />
        </div>
        <div v-for="field in preset.fields.filter((field) => field.type === 'list')" :key="field.key" class="mt-4">
          <Label class="text-[13px] text-zinc-600 mb-1.5 block font-medium">{{ field.label }}</Label>
          <RichTextListEditor
            :model-value="activeItem[field.key] || []"
            :placeholder="field.placeholder || '每行一条亮点，可使用加粗等格式'"
            @update:model-value="updateField(activeItem, field.key, $event)"
          />
        </div>
      </div>
    </div>
  </div>

  <div v-else class="space-y-3">
    <Button size="sm" variant="outline" @click="section.items.push({ id: `item_${Date.now()}`, title: '', content: '' }); $emit('change')"><Plus class="h-4 w-4" />新增内容</Button>
    <div v-for="(item, i) in section.items" :key="item.id" class="rounded-lg border border-gray-200 p-4">
      <div class="mb-3 flex justify-between"><Label>标题</Label><Button size="icon" variant="ghost" @click="triggerDelete(i)"><Trash2 class="h-4 w-4" /></Button></div>
      <Input v-model="item.title" @update:model-value="$emit('change')" />
      <div class="mt-3"><Label>内容</Label><RichTextEditor v-model="item.content" placeholder="填写正文，可使用列表、加粗等格式" @update:model-value="$emit('change')" /></div>
    </div>
  </div>

  <ConfirmDialog 
    v-model:open="showDeleteConfirm" 
    title="确认删除该内容吗？" 
    description="删除后将无法恢复。" 
    @confirm="confirmDelete" 
  />
</template>
