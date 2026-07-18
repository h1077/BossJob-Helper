<script setup lang="ts">
import { ref, computed } from "vue"
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, FileEdit, ArrowUp, ArrowDown } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import SectionFields from "./SectionFields.vue"

const props = defineProps<{
  sectionKey: string
  items: any[]
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

const activeItemId = ref<string | null>(null)

function toggleItem(id: string) {
  if (activeItemId.value === id) {
    activeItemId.value = null
  } else {
    activeItemId.value = id
  }
}

function moveItem(index: number, direction: -1 | 1) {
  if (index + direction < 0 || index + direction >= props.items.length) return
  const temp = props.items[index]
  props.items[index] = props.items[index + direction]
  props.items[index + direction] = temp
  emit("change")
}

const showDeleteConfirm = ref(false)
const deletingItemIndex = ref<number | null>(null)

function deleteItem(index: number) {
  deletingItemIndex.value = index
  showDeleteConfirm.value = true
}

function confirmDeleteItem() {
  if (deletingItemIndex.value !== null) {
    const deletedId = props.items[deletingItemIndex.value]?.id
    props.items.splice(deletingItemIndex.value, 1)
    if (activeItemId.value === deletedId) {
      activeItemId.value = ""
    }
    emit("change")
  }
  showDeleteConfirm.value = false
  deletingItemIndex.value = null
}

function addItem() {
  const id = `${props.sectionKey}_${Date.now()}`
  const base: any = { id, description: "" }
  if (props.sectionKey === "education") Object.assign(base, { school: "", major: "", degree: "", start_date: "", end_date: "" })
  if (props.sectionKey === "skills") Object.assign(base, { name: "", keywords: [], description: "" })
  if (props.sectionKey === "work") Object.assign(base, { company: "", position: "", start_date: "", end_date: "", highlights: [] })
  if (props.sectionKey === "projects") Object.assign(base, { name: "", role: "", start_date: "", end_date: "", tech_stack: "", highlights: [] })
  if (props.sectionKey === "awards") Object.assign(base, { name: "", date: "" })
  props.items.push(base)
  activeItemId.value = id
  emit("change")
}

function getItemTitle(item: any) {
  if (props.sectionKey === 'education') return item.school || '新教育经历'
  if (props.sectionKey === 'skills') return item.name || '新专业技能'
  if (props.sectionKey === 'work') return item.company || '新工作经历'
  if (props.sectionKey === 'projects') return item.name || '新项目经历'
  if (props.sectionKey === 'awards') return item.name || '新荣誉奖项'
  return '新条目'
}

function getItemSubtitle(item: any) {
  if (props.sectionKey === 'education') return [item.major, item.degree, item.start_date && item.end_date ? `${item.start_date}-${item.end_date}` : ''].filter(Boolean).join(' | ') || '完善信息'
  if (props.sectionKey === 'skills') return (item.keywords || []).join(', ') || '添加技能关键词'
  if (props.sectionKey === 'work') return [item.position, item.start_date && item.end_date ? `${item.start_date}-${item.end_date}` : ''].filter(Boolean).join(' | ') || '完善信息'
  if (props.sectionKey === 'projects') return [item.role, item.start_date && item.end_date ? `${item.start_date}-${item.end_date}` : ''].filter(Boolean).join(' | ') || '完善信息'
  if (props.sectionKey === 'awards') return item.date || '完善信息'
  return ''
}

const activeItem = computed(() => props.items.find(i => i.id === activeItemId.value))
</script>

<template>
  <div :class="isWide ? 'flex gap-6 items-start' : 'space-y-4'">
    
    <!-- List Column -->
    <div :class="isWide ? 'w-[320px] shrink-0 flex flex-col gap-3 sticky top-4' : 'flex flex-col gap-3'">
      <div v-for="(item, index) in items" :key="item.id" class="flex flex-col">
        
        <!-- Summary Card -->
        <div 
          class="rounded-[16px] border bg-white p-4 cursor-pointer transition-all flex items-center justify-between group"
          :class="activeItemId === item.id ? 'border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-sm'"
          @click="toggleItem(item.id)"
        >
          <div class="min-w-0 pr-4">
            <div class="text-[14px] font-semibold text-zinc-900 truncate tracking-tight">{{ getItemTitle(item) }}</div>
            <div class="text-[12px] text-zinc-500 truncate mt-0.5">{{ getItemSubtitle(item) }}</div>
          </div>
          
          <div class="flex items-center gap-1 transition-opacity shrink-0" :class="activeItemId === item.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto'" @click.stop>
            <Button size="icon" variant="ghost" class="h-7 w-7 text-zinc-400 hover:text-zinc-700" :disabled="index === 0" @click="moveItem(index, -1)">
              <ArrowUp class="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" class="h-7 w-7 text-zinc-400 hover:text-zinc-700" :disabled="index === items.length - 1" @click="moveItem(index, 1)">
              <ArrowDown class="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" class="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50" @click="deleteItem(index)">
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </div>
          
          <!-- State indicator for narrow mode -->
          <div v-if="!isWide && activeItemId !== item.id" class="sm:group-hover:hidden text-zinc-400">
            <ChevronRight class="h-4 w-4" />
          </div>
        </div>

        <!-- Inline Form (Narrow Mode) -->
        <div v-if="!isWide && activeItemId === item.id" class="mt-2 rounded-[16px] border border-zinc-200/80 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <SectionFields
            :item="item"
            :section-key="sectionKey"
            :display-field-labels="displayFieldLabels"
            :editable-display-fields="editableDisplayFields"
            :customized-display-fields="customizedDisplayFields"
            @change="$emit('change')"
            @update-field-label="(key, value) => emit('updateFieldLabel', key, value)"
            @reset-field-label="(key) => emit('resetFieldLabel', key)"
          >
            <template v-for="(_, name) in $slots" #[name]="slotProps">
              <slot :name="name" v-bind="slotProps"></slot>
            </template>
          </SectionFields>
        </div>
      </div>

      <Button size="sm" variant="outline" class="w-full mt-1 border-dashed border-zinc-300 text-zinc-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 bg-transparent h-10 transition-colors" @click="addItem">
        <Plus class="h-4 w-4 mr-1.5" />添加新条目
      </Button>
    </div>

    <!-- Wide Mode Detail Column -->
    <div v-if="isWide" class="w-2/3 flex-1">
      <div v-if="activeItem" class="rounded-[20px] border border-zinc-200/80 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div class="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h3 class="text-sm font-semibold text-zinc-800 tracking-tight">编辑: {{ getItemTitle(activeItem) }}</h3>
        </div>
        <SectionFields
          :item="activeItem"
          :section-key="sectionKey"
          :display-field-labels="displayFieldLabels"
          :editable-display-fields="editableDisplayFields"
          :customized-display-fields="customizedDisplayFields"
          @change="$emit('change')"
          @update-field-label="(key, value) => emit('updateFieldLabel', key, value)"
          @reset-field-label="(key) => emit('resetFieldLabel', key)"
        >
          <template v-for="(_, name) in $slots" #[name]="slotProps">
            <slot :name="name" v-bind="slotProps"></slot>
          </template>
        </SectionFields>
      </div>
      <div v-else class="flex flex-col items-center justify-center py-24 text-zinc-400 border border-dashed rounded-[20px] border-zinc-200 bg-zinc-50/50">
         <div class="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-100 mb-4">
           <FileEdit class="w-7 h-7 text-zinc-300" />
         </div>
         <span class="text-[15px] font-medium text-zinc-500">在左侧选择一个条目进行编辑</span>
         <span class="text-[13px] text-zinc-400 mt-1">或点击下方按钮添加新条目</span>
      </div>
  </div>
  </div>

  <ConfirmDialog 
    v-model:open="showDeleteConfirm" 
    title="确认删除该条目吗？" 
    description="删除后将无法恢复。" 
    @confirm="confirmDeleteItem" 
  />
</template>
