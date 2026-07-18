<script setup lang="ts">
import { nextTick, onMounted, ref, watch, computed } from "vue"
import { CheckCircle2, LoaderCircle, SendHorizontal, Bot, Search, Target, Wand2, Scissors, Trash2, X, ImagePlus, XCircle, Copy, Check, RotateCcw, Cpu, AlertCircle } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import Select from "@/components/ui/select/Select.vue"
import ConfirmDialog from "@/components/ui/dialog/ConfirmDialog.vue"
import { renderMarkdown } from "@/lib/markdown"
import { uploadAiChatImageApi } from "@/api/file"
import type { AiChatAttachment, AiChatModelOption } from "@/api/ai"

type ChatMessage = {
  id: number | string
  role: "user" | "assistant"
  content: string
  suggestions?: string[]
  optimized_resume_data?: any
  action_status?: "none" | "pending" | "applying" | "applied" | "rejected"
  streaming?: boolean
  phase?: string
  phaseText?: string
  attachments?: AiChatAttachment[]
}

const props = defineProps<{
  messages: ChatMessage[]
  loading?: boolean
  error?: string
  decisionLoadingId?: number | string | null
  active?: boolean
  supportsMultimodal?: boolean
  chatModels?: AiChatModelOption[]
  selectedModelId?: number | null
}>()

const emit = defineEmits<{
  send: [content: string, attachments?: AiChatAttachment[]]
  clear: []
  regenerate: [message: ChatMessage, content: string, attachments?: AiChatAttachment[]]
  confirm: [message: ChatMessage]
  reject: [message: ChatMessage]
  "update:selectedModelId": [modelId: number | null]
}>()

const input = ref("")
const inputRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const composing = ref(false)
const listRef = ref<HTMLElement | null>(null)
const showClearConfirm = ref(false)
const attachments = ref<AiChatAttachment[]>([])
const uploadingImage = ref(false)
const uploadError = ref("")
const copiedAttachmentUrl = ref("")
const regenerateSource = ref<ChatMessage | null>(null)

function confirmClear() {
  emit('clear')
  showClearConfirm.value = false
}

const quickPrompts = [
  { text: "这份简历还缺什么？", icon: Search, title: "深度体检", desc: "发现缺失加分项", bg: "bg-blue-50", color: "text-blue-500", ring: "hover:ring-blue-200" },
  { text: "帮我把个人简介写得更适合当前岗位", icon: Target, title: "重构简介", desc: "更贴合岗位需求", bg: "bg-indigo-50", color: "text-indigo-500", ring: "hover:ring-indigo-200" },
  { text: "项目经历怎么突出亮点？", icon: Wand2, title: "提炼亮点", desc: "让项目脱颖而出", bg: "bg-violet-50", color: "text-violet-500", ring: "hover:ring-violet-200" },
  { text: "帮我检查有没有可以删减的内容", icon: Scissors, title: "精简冗余", desc: "去除非核心内容", bg: "bg-rose-50", color: "text-rose-500", ring: "hover:ring-rose-200" }
]

function adjustHeight() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

async function scrollToLatest(behavior: ScrollBehavior = "auto") {
  await nextTick()
  // The message transition and Markdown layout finish after Vue's DOM flush.
  // Waiting for two frames keeps reopening the panel reliably anchored at the end.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const list = listRef.value
      if (!list) return
      list.scrollTo({ top: list.scrollHeight, behavior })
    })
  })
}

onMounted(() => {
  if (props.active !== false) void scrollToLatest("auto")
})

watch(
  () => props.active,
  (active) => {
    if (active) void scrollToLatest("auto")
  },
  { flush: "post" },
)

watch(
  () => [props.messages.length, props.loading, props.messages[props.messages.length - 1]?.content],
  async (newVals, oldVals) => {
    const isNewMessage = Boolean(oldVals && newVals[0] > oldVals[0])
    await scrollToLatest(isNewMessage ? "smooth" : "auto")
  },
  { immediate: true, flush: "post" },
)

function submit(event?: Event) {
  const keyEvent = event instanceof KeyboardEvent ? event : null
  if (composing.value || keyEvent?.isComposing || keyEvent?.keyCode === 229) return
  const text = input.value.trim()
  if ((!text && !attachments.value.length) || props.loading) return
  const sendingAttachments = [...attachments.value]
  const source = regenerateSource.value
  input.value = ""
  attachments.value = []
  regenerateSource.value = null
  uploadError.value = ""
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }
  if (source) {
    emit("regenerate", source, text || "请结合我上传的图片分析简历。", sendingAttachments)
    return
  }
  emit("send", text || "请结合我上传的图片分析简历。", sendingAttachments)
}

function sendQuick(text: string) {
  if (props.loading) return
  input.value = ""
  attachments.value = []
  regenerateSource.value = null
  emit("send", text)
}

async function startRegenerate(message: ChatMessage) {
  if (props.loading) return
  regenerateSource.value = message
  input.value = String(message.content || "")
  attachments.value = (message.attachments || []).map((item) => ({ ...item }))
  uploadError.value = ""
  await nextTick()
  adjustHeight()
  inputRef.value?.focus()
}

function cancelRegenerate() {
  regenerateSource.value = null
  input.value = ""
  attachments.value = []
  uploadError.value = ""
  if (inputRef.value) inputRef.value.style.height = 'auto'
}

async function handleImageChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadError.value = ""
  uploadingImage.value = true
  try {
    const result = await uploadAiChatImageApi(file)
    attachments.value.push({ url: result.url, name: file.name, content_type: file.type, object_name: result.object_name })
  } catch (err: any) {
    uploadError.value = err.message || "图片上传失败"
  } finally {
    uploadingImage.value = false
    if (fileInputRef.value) fileInputRef.value.value = ""
  }
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function chooseImage() {
  fileInputRef.value?.click()
}

async function copyAttachmentUrl(url: string) {
  try {
    await navigator.clipboard?.writeText(url)
    copiedAttachmentUrl.value = url
    window.setTimeout(() => {
      if (copiedAttachmentUrl.value === url) copiedAttachmentUrl.value = ""
    }, 1600)
  } catch {
    uploadError.value = "复制失败，请手动选择地址"
  }
}

function actionStatus(message: ChatMessage) {
  if (!message.optimized_resume_data) return "none"
  return message.action_status || "pending"
}

const lastAssistantIndex = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    if (props.messages[i].role === 'assistant') return i
  }
  return -1
})

const firstAssistantIndex = computed(() => {
  for (let i = 0; i < props.messages.length; i++) {
    if (props.messages[i].role === 'assistant') return i
  }
  return -1
})

const selectedModel = computed(() => (props.chatModels || []).find((item) => item.id === props.selectedModelId) || null)
const modelOptions = computed(() =>
  (props.chatModels || []).map((model) => {
    const call = model.points_per_call
    const inputRate = model.points_per_million_input_tokens
    const outputRate = model.points_per_million_output_tokens
    let priceText = ""
    if (call != null || inputRate != null || outputRate != null) {
      const parts: string[] = []
      if (call != null) parts.push(`${call}点/次`)
      if (inputRate != null) parts.push(`输入${inputRate}/百万`)
      if (outputRate != null) parts.push(`输出${outputRate}/百万`)
      priceText = `${model.uses_default_pricing ? "默认 " : ""}${parts.join(" · ")}`
    }
    return {
      label: model.name,
      value: model.id,
      icon: model.supports_multimodal ? "image" : "text",
      price: priceText,
    }
  }),
)
const modelPriceText = computed(() => "")

const previewImageUrl = ref("")
function openPreview(url: string) { previewImageUrl.value = url }
function closePreview() { previewImageUrl.value = "" }

const toastMessage = ref("")

watch(
  () => props.error,
  (newErr) => {
    if (newErr) {
      toastMessage.value = newErr
      setTimeout(() => {
        if (toastMessage.value === newErr) {
          toastMessage.value = ""
        }
      }, 4000)
    } else {
      toastMessage.value = ""
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 relative overflow-x-hidden">
    <div class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px]"></div>
    

    <section class="chat-stage relative flex min-h-0 flex-1 flex-col bg-transparent z-10">
      <div ref="listRef" class="relative min-h-0 flex-1 flex flex-col overflow-y-auto px-4 py-4 md:px-6 md:py-8 thin-scrollbar">
        <section v-if="!messages.length && !loading" class="mx-auto flex w-full min-h-full max-w-xl flex-col items-center justify-center py-6 text-center">
          <div class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white text-zinc-700 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60" style="view-transition-name: ai-hero-icon;">
            <Bot class="relative z-10 h-7 w-7" stroke-width="1.5" />
          </div>
          <h3 class="mt-2.5 text-[20px] font-medium tracking-tight text-zinc-900">简历打磨，现在开始。</h3>
          
          <div class="mt-8 grid w-full grid-cols-2 gap-3 px-1">
            <button v-for="prompt in quickPrompts" :key="prompt.text" class="group relative flex flex-col items-start overflow-hidden rounded-[16px] sm:rounded-[20px] bg-white ring-1 ring-zinc-200/60 p-2.5 sm:p-3.5 text-left transition-all duration-300 active:scale-[0.97] hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] hover:-translate-y-0.5" :class="prompt.ring" @click="sendQuick(prompt.text)">
              <div class="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl transition-opacity duration-500 opacity-0 group-hover:opacity-100" :class="prompt.bg"></div>
              <div class="relative z-10 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-[10px] sm:rounded-[12px] ring-1 ring-white/50 mb-1.5 sm:mb-2.5 transition-transform duration-300 group-hover:scale-110" :class="[prompt.bg, prompt.color]">
                <component :is="prompt.icon" class="h-3.5 w-3.5 sm:h-4 sm:w-4" stroke-width="2" />
              </div>
              <div class="relative z-10 text-[12px] sm:text-[13px] font-semibold text-zinc-900">{{ prompt.title }}</div>
              <div class="relative z-10 mt-0.5 text-[10px] sm:text-[11px] text-zinc-500 line-clamp-1">{{ prompt.desc }}</div>
            </button>
          </div>
        </section>

        <TransitionGroup name="message-list" tag="div" class="space-y-6 md:space-y-7">
          <article v-for="(message, index) in messages" :key="message.id" class="group relative flex gap-2 md:gap-4" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
            <div v-if="message.role === 'assistant'" class="absolute opacity-0 pointer-events-none md:relative md:opacity-100 md:pointer-events-auto self-end mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-white text-zinc-700 shadow-[0_4px_12px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60" :style="index === lastAssistantIndex ? 'view-transition-name: ai-hero-icon;' : ''">
              <Bot class="h-5 w-5" stroke-width="1.5" />
            </div>
            
            <div :class="message.role === 'assistant' ? 'assistant-message-shell' : 'max-w-[90%] md:max-w-[75%] relative'">
              <div class="message-bubble relative text-[13px] md:text-[15px] leading-relaxed transition-all" :class="message.role === 'user' ? 'rounded-[20px] md:rounded-[24px] rounded-tr-[8px] bg-zinc-100 px-4 py-2.5 md:px-5 md:py-3.5 text-zinc-900' : 'rounded-[20px] md:rounded-[24px] rounded-tl-[8px] bg-white px-4.5 py-3.5 md:px-6 md:py-5 text-zinc-800 ring-1 ring-zinc-200/50 shadow-sm'">
                <p v-if="message.role === 'user'" class="whitespace-pre-wrap break-words">{{ message.content }}</p>
                <div v-else-if="message.content" class="chat-markdown break-words" v-html="renderMarkdown(message.content)" />
                <div v-else-if="message.streaming" class="flex min-h-[24px] items-center gap-2.5" aria-label="AI 正在处理">
                  <div class="flex items-center gap-1.5">
                    <span v-for="i in 3" :key="i" class="typing-dot h-1.5 w-1.5 rounded-full bg-blue-400" :style="{ animationDelay: `${(i - 1) * 160}ms` }" />
                  </div>
                  <span v-if="message.phaseText" class="text-xs md:text-[13px] font-medium text-blue-500/80 animate-pulse">{{ message.phaseText }}</span>
                </div>

                <div v-if="message.role === 'assistant' && !message.streaming && ['pending', 'applying'].includes(actionStatus(message))" class="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
                  <span class="mr-auto min-w-[180px] text-xs md:text-[13px] font-medium text-zinc-600">是否确认将这些修改写入简历？</span>
                  <button type="button" class="h-8 rounded-full px-3 text-xs md:text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50" :disabled="decisionLoadingId === message.id" @click="emit('reject', message)">取消</button>
                  <Button type="button" size="sm" class="h-8 rounded-full bg-zinc-900 px-4 text-xs md:text-[13px] font-medium text-white hover:bg-zinc-800" :disabled="decisionLoadingId === message.id" @click="emit('confirm', message)">
                    <LoaderCircle v-if="decisionLoadingId === message.id" class="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    确认修改
                  </Button>
                </div>
                <div v-else-if="message.role === 'assistant' && actionStatus(message) === 'applied'" class="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs md:text-[13px] font-medium text-emerald-600">
                  <CheckCircle2 class="h-4 w-4" /> 修改已生效
                </div>
                <div v-else-if="message.role === 'assistant' && actionStatus(message) === 'rejected'" class="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs md:text-[13px] font-medium text-zinc-400">
                  <X class="h-4 w-4" /> 修改已取消
                </div>
                <div v-if="message.attachments?.length" class="mt-3 flex flex-wrap gap-2">
                  <button v-for="item in message.attachments" :key="item.url" type="button" class="block h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm transition-all hover:shadow-md active:scale-95 cursor-zoom-in" @click="openPreview(item.url)">
                    <img :src="item.url" :alt="item.name || '对话图片'" class="h-full w-full object-cover" />
                  </button>
                </div>
              </div>
              <div v-if="message.role === 'user' && !message.streaming" class="mt-1.5 flex justify-end pr-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button type="button" class="inline-flex items-center gap-1.5 text-[11px] md:text-[12px] font-medium text-zinc-400 hover:text-blue-600 active:scale-95 transition-colors disabled:opacity-40" :disabled="loading" title="编辑后重新生成" @click="startRegenerate(message)">
                  <RotateCcw class="h-3 w-3 shrink-0" stroke-width="1.8" />
                  <span class="whitespace-nowrap">重新生成</span>
                </button>
              </div>
            </div>
          </article>
        </TransitionGroup>
      </div>

      <form class="composer relative mx-3 sm:mx-4 mb-18 sm:mb-4 mt-1 shrink-0 rounded-[18px] sm:rounded-[24px] bg-zinc-50/80 p-1 sm:p-2.5 ring-1 ring-zinc-200/50 transition-all focus-within:bg-white focus-within:ring-blue-200 focus-within:shadow-[0_8px_40px_rgba(16,185,129,0.08)]" @submit.prevent="submit">
        <div class="relative flex items-start">
          <textarea ref="inputRef" v-model="input" placeholder="输入你想调整的内容..." rows="1" class="w-full min-h-[32px] sm:min-h-[44px] max-h-[100px] sm:max-h-[160px] resize-none bg-transparent px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-[15px] leading-relaxed text-zinc-800 placeholder:text-zinc-400 border-0 shadow-none focus-visible:ring-0 outline-none" style="scrollbar-width: none;" @input="adjustHeight" @compositionstart="composing = true" @compositionend="composing = false" @keydown.enter.exact.prevent="submit($event)"></textarea>
        </div>
        <div v-if="attachments.length || uploadError" class="mb-2 flex flex-wrap gap-2 sm:gap-3 px-2.5 sm:px-3 pt-1">
          <div v-for="(item, index) in attachments" :key="item.url" class="group relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl border border-zinc-200/80 bg-white shadow-sm">
            <img :src="item.url" :alt="item.name || '待发送图片'" class="h-full w-full rounded-xl object-cover" />
            <button type="button" class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-zinc-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-200/80 transition hover:text-red-500 hover:scale-110 active:scale-95" title="移除图片" @click="removeAttachment(index)">
              <X class="h-3 w-3" stroke-width="2.5" />
            </button>
          </div>
          <p v-if="uploadError" class="w-full text-xs text-red-500">{{ uploadError }}</p>
        </div>
        <div class="flex items-center justify-between gap-2 px-2 sm:px-3 pt-2 pb-1">
          <div v-if="chatModels?.length" class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200/80 shadow-sm transition-all hover:ring-zinc-300 hover:shadow">
            <Cpu class="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <Select
              :model-value="selectedModelId || ''"
              :options="modelOptions"
              :disabled="loading"
              ghost
              class="!h-6 !max-w-[200px] !rounded-full !p-0 !text-xs !font-semibold"
              @change="(value) => emit('update:selectedModelId', value ? Number(value) : null)"
            />
          </div>
          <div v-else class="text-xs text-zinc-400">默认模型</div>
          
          <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <input ref="fileInputRef" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="handleImageChange" />
            <button v-if="supportsMultimodal" type="button" class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[12px] sm:rounded-[16px] text-zinc-400 transition-all hover:bg-blue-50 hover:text-blue-600 active:scale-95 disabled:opacity-50" :disabled="loading || uploadingImage" title="上传图片" @click="chooseImage">
              <LoaderCircle v-if="uploadingImage" class="h-4 w-4 sm:h-5 sm:w-5 animate-spin" stroke-width="1.5" />
              <ImagePlus v-else class="h-4 w-4 sm:h-5 sm:w-5" stroke-width="1.5" />
            </button>
            <button v-if="messages.length > 0 && !loading && !regenerateSource" type="button" class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[12px] sm:rounded-[16px] text-zinc-400 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95" @click="showClearConfirm = true" title="清空对话">
              <Trash2 class="h-4 w-4 sm:h-5 sm:w-5" stroke-width="1.5" />
            </button>
            <button v-if="regenerateSource" type="button" class="flex h-8 sm:h-9 items-center justify-center rounded-[12px] sm:rounded-[16px] px-2.5 sm:px-3 text-xs sm:text-[13px] font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 active:scale-95 transition-all" title="取消重新生成" @click="cancelRegenerate">
              取消
            </button>
            <button type="button" class="group flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-[12px] sm:rounded-[16px] bg-zinc-900 text-white shadow-sm transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.92]" :disabled="loading || (!input.trim() && !attachments.length)" :title="regenerateSource ? '确认重新生成' : '发送'" @click="submit">
              <RotateCcw v-if="regenerateSource" class="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ease-out group-hover:rotate-[-25deg]" stroke-width="1.6" />
              <SendHorizontal v-else class="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ease-out" :class="{ 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5': !loading && (input.trim() || attachments.length) }" stroke-width="1.5" />
            </button>
          </div>
        </div>
      </form>
    </section>
  </div>

  <ConfirmDialog 
    v-model:open="showClearConfirm" 
    title="确认清空对话记录吗？" 
    description="清空后将无法恢复当前的 AI 会话历史。" 
    @confirm="confirmClear" 
  />

  <!-- Image Preview Lightbox -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="previewImageUrl" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click="closePreview">
        <button type="button" class="absolute top-6 right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white active:scale-95 ring-1 ring-white/20" title="关闭预览" @click.stop="closePreview">
          <X class="h-6 w-6" stroke-width="2" />
        </button>
        <img :src="previewImageUrl" alt="大图预览" class="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl transition-transform duration-300 select-none cursor-zoom-out" @click.stop="closePreview" />
      </div>
    </Transition>
  </Teleport>

  <!-- Error Toast -->
  <Teleport to="body">
    <Transition name="toast-slide">
      <div v-if="toastMessage" class="fixed bottom-12 left-1/2 -translate-x-1/2 z-[10000] flex w-max max-w-[90vw] items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white shadow-xl border border-zinc-800">
        <AlertCircle class="h-4 w-4 shrink-0 text-red-400" />
        <span class="break-words">{{ toastMessage }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px) scale(0.95);
}

.chat-markdown :deep(p) { margin: 0 0 0.6rem; }
.chat-markdown :deep(p:last-child),
.chat-markdown :deep(ul:last-child),
.chat-markdown :deep(ol:last-child) { margin-bottom: 0; }
.chat-markdown :deep(h1),
.chat-markdown :deep(h2),
.chat-markdown :deep(h3) {
  margin: 1rem 0 0.4rem;
  color: #18181b;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.02em;
}
.chat-markdown :deep(h1:first-child),
.chat-markdown :deep(h2:first-child),
.chat-markdown :deep(h3:first-child) { margin-top: 0; }
.chat-markdown :deep(h1) { font-size: 1.1rem; }
.chat-markdown :deep(h2),
.chat-markdown :deep(h3) { font-size: 1rem; }
.chat-markdown :deep(ul),
.chat-markdown :deep(ol) { margin: 0.4rem 0 0.8rem; padding-left: 1.25rem; }
.chat-markdown :deep(ul) { list-style: disc; }
.chat-markdown :deep(ol) { list-style: decimal; }
.chat-markdown :deep(li) { margin: 0.25rem 0; }
.chat-markdown :deep(strong) { color: #18181b; font-weight: 600; }
.chat-markdown :deep(code) {
  border-radius: 0.4rem;
  background: #f4f4f5;
  padding: 0.15rem 0.4rem;
  color: #27272a;
  font-size: 0.85em;
}
.chat-markdown :deep(pre) {
  margin: 0.75rem 0;
  overflow-x: auto;
  border-radius: 0.75rem;
  background: #18181b;
  padding: 1rem;
  color: #fafafa;
}
.chat-markdown :deep(pre code) { background: transparent; padding: 0; color: inherit; }
.chat-markdown :deep(a) { color: #3b82f6; text-decoration: none; font-weight: 500; transition: color 0.2s; }
.chat-markdown :deep(a:hover) { color: #059669; }

.chat-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  overflow-x: auto;
  display: block;
}
.chat-markdown :deep(th),
.chat-markdown :deep(td) {
  border: 1px solid #e4e4e7;
  padding: 0.5rem 0.75rem;
  text-align: left;
  min-width: 100px;
}
.chat-markdown :deep(th) {
  background-color: #f4f4f5;
  font-weight: 600;
  color: #18181b;
  white-space: nowrap;
}

.typing-dot { animation: typing-bounce 1.4s ease-in-out infinite; }
.assistant-message-shell {
  width: 100%;
  max-width: 720px;
  min-width: 0;
}

@media (min-width: 768px) {
  .assistant-message-shell {
    width: min(720px, calc(100% - 54px));
  }
}

.assistant-orb::before {
  position: absolute;
  inset: -12px;
  content: "";
  border-radius: 40px;
  background: radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%);
  animation: orb-breathe 4s ease-in-out infinite alternate;
}

.message-list-enter-active {
  transition: all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.message-list-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
@keyframes orb-breathe {
  from { transform: scale(0.9); opacity: 0.8; }
  to { transform: scale(1.1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { 
  .analysis-step, .analysis-dot, .chat-markdown > *, .assistant-orb::before, .message-row { 
    animation: none !important; 
  } 
}
.icon-morph-anim {
  animation: icon-morph 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.1s;
}
@keyframes icon-morph {
  0% { transform: scale(0.5) rotate(-15deg); opacity: 0; filter: blur(4px); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
