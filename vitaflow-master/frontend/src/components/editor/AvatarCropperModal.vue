<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import Button from '@/components/ui/button/Button.vue'
import { LoaderCircle } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  imageUrl: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  cancel: []
  confirm: [blob: Blob]
}>()

const imageRef = ref<HTMLImageElement | null>(null)
let cropper: Cropper | null = null
const isCropping = ref(false)

const initializeCropper = () => {
  if (cropper) {
    cropper.destroy()
    cropper = null
  }
  if (!imageRef.value) return
  cropper = new Cropper(imageRef.value, {
    aspectRatio: 5 / 7,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.9,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
  })
}

watch(
  () => props.open,
  async (newVal) => {
    if (newVal && props.imageUrl) {
      await nextTick()
      initializeCropper()
    } else {
      if (cropper) {
        cropper.destroy()
        cropper = null
      }
    }
  }
)

onBeforeUnmount(() => {
  if (cropper) {
    cropper.destroy()
    cropper = null
  }
})

function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}

function handleConfirm() {
  if (!cropper) return
  isCropping.value = true
  cropper.getCroppedCanvas({
    width: 500, // Export resolution
    height: 700,
    fillColor: '#fff',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  }).toBlob(
    (blob) => {
      isCropping.value = false
      if (blob) {
        emit('confirm', blob)
        emit('update:open', false)
      }
    },
    'image/jpeg',
    0.9
  )
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
        <div class="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]" @click.stop>
          <div class="border-b border-zinc-100 px-5 py-4 shrink-0">
            <h3 class="text-lg font-semibold text-zinc-900">裁剪头像</h3>
            <p class="text-sm text-zinc-500">拖拽调整位置，固定 5:7 比例以适配简历</p>
          </div>
          
          <div class="bg-zinc-50 flex items-center justify-center flex-1 min-h-[40vh] max-h-[60vh] overflow-hidden">
            <img ref="imageRef" :src="imageUrl" alt="Cropper target" class="block max-w-full" />
          </div>
          
          <div class="flex items-center justify-end gap-3 border-t border-zinc-100 px-5 py-4 bg-white shrink-0">
            <Button variant="outline" class="h-10 px-5" @click="handleCancel" :disabled="isCropping">取消</Button>
            <Button class="h-10 px-5 bg-zinc-900 text-white hover:bg-zinc-800" @click="handleConfirm" :disabled="isCropping">
              <LoaderCircle v-if="isCropping" class="mr-2 h-4 w-4 animate-spin" />
              确认裁剪
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
