<script setup lang="ts">
import { AlertCircle, X } from "lucide-vue-next"

const props = defineProps<{
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  "confirm": []
  "cancel": []
}>()

function close() {
  emit("update:open", false)
  emit("cancel")
}

function confirm() {
  emit("confirm")
  emit("update:open", false)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      enter-to-class="opacity-100 translate-y-0 sm:scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 sm:scale-100"
      leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
    >
      <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm" @click.self="close">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all">
          <!-- Header -->
          <div class="px-5 py-4 flex items-start gap-3">
            <div class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full" :class="destructive !== false ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'">
              <AlertCircle class="w-5 h-5" />
            </div>
            <div class="flex-1 pt-1">
              <h3 class="font-semibold text-zinc-900 text-[16px]">{{ title }}</h3>
              <p v-if="description" class="mt-1.5 text-sm text-zinc-500 leading-relaxed">{{ description }}</p>
            </div>
            <button @click="close" class="flex-shrink-0 -mr-2 -mt-1 p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Actions -->
          <div class="px-5 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-3">
            <button 
              @click="close" 
              class="flex-1 h-10 rounded-xl font-medium text-sm border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              {{ cancelText || '取消' }}
            </button>
            <button 
              @click="confirm" 
              class="flex-1 h-10 rounded-xl font-medium text-sm text-white transition-colors"
              :class="destructive !== false ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-900 hover:bg-zinc-800'"
            >
              {{ confirmText || '删除' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
