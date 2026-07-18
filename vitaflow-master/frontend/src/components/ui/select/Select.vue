<script setup lang="ts">
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'radix-vue'
import { ChevronDown, Check, Image, FileText, Info } from 'lucide-vue-next'
import { ref } from 'vue'

const activeTipText = ref<string | null>(null)
const tipPos = ref({ top: 0, left: 0 })

const showTip = (event: MouseEvent, text: string) => {
  if (!text) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tipPos.value = {
    top: rect.top - 34,
    left: rect.left + rect.width / 2
  }
  activeTipText.value = text
}

const hideTip = () => {
  activeTipText.value = null
}

const toggleTip = (event: MouseEvent, text: string) => {
  if (activeTipText.value === text) {
    activeTipText.value = null
  } else {
    showTip(event, text)
  }
}

const props = defineProps<{
  modelValue?: any
  options?: any[]
  placeholder?: string
  disabled?: boolean
  class?: string
  ghost?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  change: [value: any]
}>()

const getOptionValue = (option: any) => typeof option === 'object' && option !== null ? option.value : option
const getOptionLabel = (option: any) => typeof option === 'object' && option !== null ? option.label : option
const getOptionMeta = (option: any) => typeof option === 'object' && option !== null ? option.meta : ""
const getOptionIcon = (option: any) => typeof option === 'object' && option !== null ? option.icon : ""
const getOptionPrice = (option: any) => typeof option === 'object' && option !== null ? option.price : ""

const getInternalValue = (val: any) => {
  const str = String(val)
  return str === '' ? '__empty__' : str
}

const updateValue = (strVal: string) => {
  const actualStrVal = strVal === '__empty__' ? '' : strVal
  const selectedOption = props.options?.find(o => String(getOptionValue(o)) === actualStrVal)
  const realVal = selectedOption !== undefined ? getOptionValue(selectedOption) : actualStrVal
  hideTip()
  emit('update:modelValue', realVal)
  emit('change', realVal)
}
</script>

<template>
  <SelectRoot :model-value="modelValue !== undefined ? getInternalValue(modelValue) : undefined" @update:model-value="updateValue" :disabled="disabled">
    <SelectTrigger 
      class="flex w-full items-center justify-between rounded-md px-3 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all"
      :class="[
        ghost ? 'h-8 bg-transparent border-none shadow-none text-zinc-600 hover:text-zinc-900 data-[state=open]:text-zinc-900 focus:ring-0 focus:outline-none font-medium' : 'h-9 border border-zinc-200 bg-white shadow-sm hover:border-zinc-300 data-[state=open]:border-zinc-900 data-[state=open]:ring-1 data-[state=open]:ring-zinc-900 focus:ring-1 focus:ring-zinc-900',
        props.class
      ]"
    >
      <SelectValue :placeholder="placeholder" />
      <SelectIcon>
        <ChevronDown class="h-4 w-4 opacity-50" />
      </SelectIcon>
    </SelectTrigger>
    
    <SelectPortal>
      <SelectContent 
        class="relative z-[200] min-w-[8rem] overflow-visible rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        position="popper"
        :side-offset="4"
      >
        <SelectViewport class="p-1">
          <SelectItem 
            v-for="option in options" 
            :key="getInternalValue(getOptionValue(option))" 
            :value="getInternalValue(getOptionValue(option))"
            class="group relative flex w-full cursor-default select-none items-center gap-3 rounded-md py-2 pl-8 pr-3 text-sm outline-none focus:bg-zinc-100 focus:text-zinc-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
          >
            <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              <SelectItemIndicator>
                <Check class="h-4 w-4" />
              </SelectItemIndicator>
            </span>
            <div class="flex items-center gap-1.5 mr-auto py-0.5">
              <SelectItemText>
                <span class="truncate font-medium text-zinc-800 group-focus:text-zinc-900 transition-colors">{{ getOptionLabel(option) }}</span>
              </SelectItemText>
              <div v-if="getOptionPrice(option)" class="relative flex items-center">
                <button 
                  type="button" 
                  class="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 active:scale-95 transition-all outline-none"
                  @pointerdown.stop.prevent="(e) => toggleTip(e, getOptionPrice(option))"
                  @pointerup.stop.prevent
                  @click.stop.prevent
                  @touchstart.stop
                  @touchend.stop
                  @mouseenter="(e) => showTip(e, getOptionPrice(option))"
                  @mouseleave="hideTip"
                >
                  <Info class="h-3.5 w-3.5" stroke-width="1.8" />
                </button>
              </div>
            </div>
            <span
              v-if="getOptionIcon(option) === 'image' || getOptionIcon(option) === 'text'"
              class="ml-auto inline-flex shrink-0 items-center justify-end text-zinc-400 group-focus:text-zinc-600 transition-colors"
              :title="getOptionIcon(option) === 'image' ? '支持图片输入' : '仅支持文本输入'"
            >
              <Image v-if="getOptionIcon(option) === 'image'" class="h-4 w-4" stroke-width="1.8" />
              <FileText v-else class="h-4 w-4" stroke-width="1.8" />
            </span>
            <span v-if="getOptionMeta(option)" class="ml-auto shrink-0 text-xs text-zinc-400">{{ getOptionMeta(option) }}</span>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>

  <Teleport to="body">
    <Transition name="fade">
      <div 
        v-if="activeTipText"
        class="fixed z-[99999] pointer-events-none whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-2xl ring-1 ring-white/20 -translate-x-1/2"
        :style="{ top: `${tipPos.top}px`, left: `${tipPos.left}px` }"
      >
        {{ activeTipText }}
        <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-[5px] border-transparent border-t-zinc-900"></div>
      </div>
    </Transition>
  </Teleport>
</template>
