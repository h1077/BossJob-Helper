<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from "vue"

defineOptions({
  inheritAttrs: false
})
import { useScroll } from "@vueuse/core"
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, Trash2, LayoutList, ChevronDown, ChevronLeft, ChevronRight, Sparkles, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Input from "@/components/ui/input/Input.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import type { ResumeData } from "@/types/resume"
import { modulePresetGroups } from "@/utils/resumePresets"

const isMobile = ref(false)
const isTouchDevice = ref(false)
const mobileExpanded = ref(false)
const showSortModal = ref(false)
const showAddModuleModal = ref(false)
const showDeleteConfirm = ref(false)
const deletingModuleKey = ref<string | null>(null)
let resizeHandler: () => void

function triggerDelete(key: string) {
  deletingModuleKey.value = key
  showDeleteConfirm.value = true
}

function confirmDelete() {
  if (deletingModuleKey.value) {
    emit('removeCustom', deletingModuleKey.value)
  }
  showDeleteConfirm.value = false
  deletingModuleKey.value = null
}

const scrollContainer = ref<HTMLElement | null>(null)
const { x, arrivedState } = useScroll(scrollContainer, { behavior: 'smooth' })

function scrollNav(direction: 'left' | 'right') {
  if (!scrollContainer.value) return
  const offset = 250
  scrollContainer.value.scrollBy({ left: direction === 'left' ? -offset : offset, behavior: 'smooth' })
}

onMounted(() => {
  isMobile.value = window.innerWidth < 768
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  resizeHandler = () => { isMobile.value = window.innerWidth < 768 }
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})

const props = defineProps<{ data: ResumeData; current: string; optimizeLoading?: boolean; formExpanded?: boolean }>()
const emit = defineEmits<{ select: [key: string]; change: []; addCustom: [presetType?: string]; removeCustom: [key: string]; optimize: []; togglePanel: [] }>()
const builtIn = ["basics", "summary", "education", "skills", "work", "projects", "awards"]
let draggingKey = ""
const orderedSections = computed(() => ["basics", ...(props.data.layout?.section_order || []).filter((item) => item !== "basics")])
const presetGroups = modulePresetGroups()

function visible(key: string) {
  if (key === "basics") return true
  return !(props.data.layout?.hidden_sections || []).includes(key)
}

watch(() => props.current, async (newVal) => {
  if (!scrollContainer.value) return
  await nextTick()
  const tab = scrollContainer.value.querySelector(`[data-module="${newVal}"]`) as HTMLElement
  if (tab) {
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
})
function setVisible(key: string, value: boolean) {
  if (key === "basics") return
  props.data.layout ||= { section_order: [], hidden_sections: [], section_titles: {} }
  props.data.layout.hidden_sections ||= []
  const hidden = props.data.layout.hidden_sections
  if (value) props.data.layout.hidden_sections = hidden.filter((item) => item !== key)
  else if (!hidden.includes(key)) hidden.push(key)
  emit("change")
}

function onDragStart(e: DragEvent, key: string) {
  if (key === "basics") return
  draggingKey = key
  
  if (e.dataTransfer) {
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const clone = target.cloneNode(true) as HTMLElement
    clone.style.position = 'absolute'
    clone.style.top = '-9999px'
    clone.style.left = '-9999px'
    clone.classList.remove('shadow-sm', 'shadow-md')
    clone.style.backgroundColor = target.classList.contains('bg-zinc-900') ? '#18181b' : '#ffffff'
    clone.style.border = '1px solid #e4e4e7'
    document.body.appendChild(clone)
    e.dataTransfer.setDragImage(clone, e.offsetX || rect.width / 2, e.offsetY || rect.height / 2)
    setTimeout(() => clone.remove(), 100)
  }
}

function onDrop(targetKey: string) {
  if (targetKey === "basics") return
  if (!draggingKey || draggingKey === targetKey) return
  const order = props.data.layout?.section_order || []
  const from = order.indexOf(draggingKey)
  const to = order.indexOf(targetKey)
  if (from < 0 || to < 0) return
  order.splice(from, 1)
  order.splice(to, 0, draggingKey)
  draggingKey = ""
  emit("change")
}

function move(key: string, offset: number) {
  if (key === "basics") return
  const order = props.data.layout?.section_order || []
  const from = order.indexOf(key)
  const to = from + offset
  if (from < 0 || to <= 0 || to >= order.length) return
  order.splice(from, 1)
  order.splice(to, 0, key)
  emit("select", key)
  emit("change")
}

function addModule(presetType?: string) {
  emit("addCustom", presetType)
  showAddModuleModal.value = false
  showSortModal.value = false
}
</script>

<template>
  <div v-bind="$attrs" class="w-full shrink-0 border-b border-zinc-200/60 bg-white flex flex-col relative z-20">
    <!-- Module List -->
    <div class="flex items-center w-full">
      <div class="relative w-full overflow-hidden flex items-center group/nav flex-1">
      <!-- Left Fade & Arrow -->
      <div v-show="!arrivedState.left" class="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white via-white/90 to-transparent z-10 flex items-center justify-start px-2 pointer-events-none transition-opacity duration-300">
        <button @click="scrollNav('left')" class="h-7 w-7 rounded-full bg-white shadow-sm border border-zinc-200 hidden md:flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-all pointer-events-auto opacity-0 group-hover/nav:opacity-100">
          <ChevronLeft class="h-4 w-4" />
        </button>
      </div>

      <div ref="scrollContainer" class="flex items-center overflow-x-auto overflow-y-hidden pl-3 md:pl-4 pr-1 py-2.5 md:py-3 gap-1.5 md:gap-2.5 w-full scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] overscroll-x-contain relative">
        <div
          v-for="element in orderedSections"
          :key="element"
          :data-module="element"
          class="group relative flex items-center shrink-0 h-8 md:h-9 rounded-full px-3.5 md:px-4 text-xs md:text-[14px] font-medium transition-all duration-300 cursor-pointer border select-none outline-none focus:outline-none focus-visible:outline-none"
          :class="[
            current === element 
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' 
              : 'bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm', 
            !visible(element) && 'opacity-50'
          ]"
          :draggable="element !== 'basics' && !isMobile && !isTouchDevice"
          @dragover.prevent
          @drop.prevent="onDrop(element)"
          @dragstart.stop="onDragStart($event as DragEvent, element)"
          @click="$emit('select', element)"
        >
          <!-- Title Text -->
          <span class="whitespace-nowrap flex items-center">
            <GripVertical v-if="element !== 'basics' && !isMobile && !isTouchDevice" class="h-3.5 w-3.5 mr-1.5 opacity-0 group-hover:opacity-40 transition-opacity" :class="current === element ? 'text-zinc-300' : 'text-zinc-400'" />
            {{ data.layout?.section_titles?.[element] || element }}
          </span>

          <!-- Action Buttons -->
          <div class="flex items-center justify-end gap-1 transition-opacity duration-200"
               :class="[
                 element !== 'basics' ? 'ml-1 -mr-1' : '',
                 !builtIn.includes(element) ? 'w-[44px]' : 'w-[24px]',
                 (!isMobile && !isTouchDevice) ? 'opacity-0 group-hover:opacity-100' : (current === element ? 'opacity-100' : 'hidden')
               ]"
               v-if="element !== 'basics'">
              <button class="flex items-center justify-center p-1 rounded-full transition-colors" :class="current === element ? 'text-zinc-300 hover:text-white hover:bg-white/20' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50'" title="显示/隐藏" @click.stop="setVisible(element, !visible(element))">
                <Eye v-if="visible(element)" class="h-3.5 w-3.5" />
                <EyeOff v-else class="h-3.5 w-3.5" />
              </button>
              <button v-if="!builtIn.includes(element)" class="flex items-center justify-center p-1 rounded-full transition-colors" :class="current === element ? 'text-red-300 hover:text-red-100 hover:bg-red-500/50' : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'" title="删除" @click.stop="triggerDelete(element)">
                <Trash2 class="h-3.5 w-3.5" />
              </button>
          </div>
        </div>

        <!-- Add Custom Module Button -->
        <button
          class="group flex items-center justify-center shrink-0 h-8 md:h-9 rounded-full px-3.5 md:px-4 text-xs md:text-[14px] font-medium transition-all duration-200 border border-dashed border-zinc-300 bg-zinc-50/50 text-zinc-50 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
          @click="showAddModuleModal = true"
        >
          <Plus class="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
          添加模块
        </button>
      </div>

        <!-- Right Fade & Arrow -->
        <div v-show="!arrivedState.right" class="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent z-10 flex items-center justify-end px-2 pointer-events-none transition-opacity duration-300">
          <button @click="scrollNav('right')" class="h-7 w-7 rounded-full bg-white shadow-sm border border-zinc-200 hidden md:flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-all pointer-events-auto opacity-0 group-hover/nav:opacity-100">
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Settings / Sort Button (Sticky) -->
      <div class="relative z-20 flex items-center justify-center pl-0 pr-2 md:pr-3 shrink-0 bg-white">
        <button
          class="group flex items-center justify-center shrink-0 h-8 w-8 md:h-9 md:w-9 rounded-full transition-all duration-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          @click="showSortModal = true"
          title="排序与管理"
        >
          <Settings class="h-4 w-4 md:h-[18px] md:w-[18px] transition-transform duration-300 group-hover:rotate-90" stroke-width="1.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile Sort Modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      enter-to-class="opacity-100 translate-y-0 sm:scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 sm:scale-100"
      leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
    >
      <div v-if="showSortModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/40 backdrop-blur-sm" @click.self="showSortModal = false">
        <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh]">
          <div class="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
            <h3 class="font-semibold text-zinc-900">模块排序与管理</h3>
            <button @click="showSortModal = false" class="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 rounded-full hover:bg-zinc-100 transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div class="overflow-y-auto p-3 space-y-1.5 flex-1">
            <div v-for="(element, idx) in orderedSections" :key="element" class="flex items-center gap-3 px-3 py-3 rounded-xl bg-white border border-zinc-100 shadow-sm">
              <button class="flex-1 min-w-0 flex items-center text-left" @click="$emit('select', element); showSortModal = false">
                <div class="text-[14px] font-medium transition-colors" :class="visible(element) ? (current === element ? 'text-blue-600' : 'text-zinc-900 hover:text-blue-600') : 'text-zinc-400 line-through'">
                  {{ data.layout?.section_titles?.[element] || element }}
                </div>
              </button>
              
              <div class="flex items-center gap-1.5">
                <button v-if="!builtIn.includes(element)" @click="triggerDelete(element)" class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors text-red-300 hover:text-red-600 hover:bg-red-50" title="删除">
                  <Trash2 class="w-4 h-4" />
                </button>
                
                <button @click="setVisible(element, !visible(element))" class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors" :class="visible(element) ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100'" v-if="element !== 'basics'" title="显示/隐藏">
                  <Eye v-if="visible(element)" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
                
                <div class="flex items-center border border-zinc-200 rounded-lg bg-zinc-50/50" v-if="element !== 'basics'">
                  <button @click="move(element, -1)" class="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-l-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors" :disabled="idx === 1" title="上移">
                    <ArrowUp class="w-3.5 h-3.5" />
                  </button>
                  <div class="w-[1px] h-4 bg-zinc-200"></div>
                  <button @click="move(element, 1)" class="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-r-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors" :disabled="idx === orderedSections.length - 1" title="下移">
                    <ArrowDown class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="p-4 border-t border-zinc-100 bg-white shrink-0 pb-safe grid grid-cols-2 gap-3">
            <button @click="showAddModuleModal = true" class="w-full h-11 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/80 rounded-xl font-medium text-[15px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
              <Plus class="w-4 h-4" />
              添加模块
            </button>
            <button @click="showSortModal = false" class="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-medium text-[15px] transition-transform active:scale-[0.98]">
              完成
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      enter-to-class="opacity-100 translate-y-0 sm:scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 sm:scale-100"
      leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
    >
      <div v-if="showAddModuleModal" class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/40 backdrop-blur-sm" @click.self="showAddModuleModal = false">
        <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh]">
          <div class="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
            <h3 class="font-semibold text-zinc-900">添加模块</h3>
            <button @click="showAddModuleModal = false" class="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 rounded-full hover:bg-zinc-100 transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="overflow-y-auto p-4 space-y-5 flex-1">
            <section v-for="(presets, group) in presetGroups" :key="group" class="space-y-2">
              <h4 class="px-1 text-xs font-semibold text-zinc-500">{{ group }}</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="preset in presets"
                  :key="preset.type"
                  type="button"
                  class="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left transition hover:border-zinc-900 hover:bg-zinc-50 hover:shadow-sm"
                  @click="addModule(preset.type)"
                >
                  <div class="text-sm font-semibold text-zinc-900">{{ preset.title }}</div>
                  <div class="mt-1 text-xs leading-relaxed text-zinc-500">{{ preset.description }}</div>
                </button>
              </div>
            </section>
          </div>
          <div class="p-4 border-t border-zinc-100 bg-white shrink-0 pb-safe">
            <button @click="addModule()" class="w-full h-11 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-dashed border-zinc-300 rounded-xl font-medium text-[15px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
              <Plus class="w-4 h-4" />
              空白自定义模块
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmDialog 
    v-model:open="showDeleteConfirm" 
    title="确认删除该模块吗？" 
    description="删除后，模块内的所有内容将被清空，无法恢复。" 
    @confirm="confirmDelete" 
  />
</template>
