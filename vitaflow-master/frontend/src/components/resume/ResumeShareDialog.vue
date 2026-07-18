<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { Check, Clock3, Copy, ExternalLink, Link2, RefreshCw, ShieldCheck, X } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import DateTimePicker from "@/components/ui/DateTimePicker.vue"
import Select from "@/components/ui/select/Select.vue"
import { getResumeShareApi, updateResumeShareApi, type ResumeShareSettings } from "@/api/resume"
import { showGlobalToast } from "@/utils/toast"

const props = defineProps<{
  open: boolean
  resumeId: number
  resumeTitle: string
}>()

const emit = defineEmits<{ "update:open": [value: boolean] }>()

const loading = ref(false)
const saving = ref(false)
const config = ref<ResumeShareSettings | null>(null)
const enabled = ref(false)
const expiryMode = ref("7")
const customExpireTime = ref("")
const maskSensitive = ref(false)
const copied = ref(false)
const customToken = ref("")
const savedToken = ref("")
const shareBase = `${window.location.origin}/share/`

const expiryOptions = [
  { label: "永久有效", value: "permanent" },
  { label: "1 天", value: "1" },
  { label: "7 天", value: "7" },
  { label: "30 天", value: "30" },
  { label: "90 天", value: "90" },
  { label: "自定义时间", value: "custom" },
]

const shareLink = computed(() => config.value?.token ? `${window.location.origin}/share/${config.value.token}` : "")
const shareText = computed(() => {
  const title = props.resumeTitle.trim()
  const resumeName = title && title !== "未命名简历" ? `「${title}」` : "个人简历"
  return `您好，我通过 VitaFlow 向您分享了一份${resumeName}在线简历，期待与您进一步沟通。\n查看链接：${shareLink.value}`
})
const statusText = computed(() => {
  if (!config.value?.enabled) return "分享未开启"
  if (!config.value.active) return "分享已过期"
  if (!config.value.expire_time) return "公开链接永久有效"
  return `有效至 ${new Date(config.value.expire_time).toLocaleString("zh-CN", { hour12: false })}`
})

function toDatetimeLocal(value?: string | null) {
  return value ? value.slice(0, 16) : ""
}

async function loadSettings() {
  loading.value = true
  try {
    const data = await getResumeShareApi(props.resumeId)
    config.value = data
    enabled.value = data.enabled
    maskSensitive.value = data.mask_sensitive
    customToken.value = data.token || ""
    savedToken.value = data.token || ""
    if (data.expire_time) {
      expiryMode.value = "custom"
      customExpireTime.value = toDatetimeLocal(data.expire_time)
    } else {
      expiryMode.value = data.enabled ? "permanent" : "7"
      customExpireTime.value = ""
    }
  } catch (error: any) {
    showGlobalToast(error?.message || "分享设置加载失败", "error")
    emit("update:open", false)
  } finally {
    loading.value = false
  }
}

function resolvedExpireTime() {
  if (!enabled.value || expiryMode.value === "permanent") return null
  if (expiryMode.value === "custom") {
    if (!customExpireTime.value) throw new Error("请选择分享过期时间")
    return new Date(customExpireTime.value).toISOString()
  }
  const date = new Date()
  date.setDate(date.getDate() + Number(expiryMode.value))
  return date.toISOString()
}

async function saveSettings(regenerateToken = false) {
  saving.value = true
  try {
    const nextToken = customToken.value.trim()
    const shouldUpdateToken = !regenerateToken && nextToken && nextToken !== savedToken.value
    config.value = await updateResumeShareApi(props.resumeId, {
      enabled: enabled.value,
      expire_time: resolvedExpireTime(),
      regenerate_token: regenerateToken,
      mask_sensitive: maskSensitive.value,
      custom_token: shouldUpdateToken ? nextToken : undefined,
    })
    customToken.value = config.value.token || ""
    savedToken.value = config.value.token || ""
    showGlobalToast(regenerateToken ? "分享链接已重新生成" : enabled.value ? "分享已开启" : "分享已关闭")
  } catch (error: any) {
    showGlobalToast(error?.message || "分享设置保存失败", "error")
  } finally {
    saving.value = false
  }
}

async function copyShare() {
  if (!shareText.value) return
  await navigator.clipboard.writeText(shareText.value)
  copied.value = true
  showGlobalToast("分享内容已复制")
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}

function openSharePage() {
  if (shareLink.value) window.open(shareLink.value, "_blank", "noopener,noreferrer")
}

watch(
  () => props.open,
  (open) => {
    if (open) loadSettings()
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="share-dialog">
      <div v-if="open" class="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm" @click.self="$emit('update:open', false)">
        <section class="w-full max-w-xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_28px_90px_-28px_rgba(0,0,0,0.4)]">
          <header class="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-4 sm:px-6 py-4 sm:py-5 bg-white z-10">
            <div class="flex items-start gap-3.5">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white"><Link2 class="h-5 w-5" /></span>
              <div>
                <h2 class="text-lg font-semibold tracking-tight text-zinc-950">分享简历</h2>
                <p class="mt-1 text-sm text-zinc-500">只有持有有效链接的人可以查看，无法编辑。</p>
              </div>
            </div>
            <button class="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" title="关闭" @click="$emit('update:open', false)"><X class="h-5 w-5" /></button>
          </header>

          <div v-if="loading" class="flex h-72 items-center justify-center">
            <RefreshCw class="h-6 w-6 animate-spin text-zinc-400" />
          </div>
          <div v-else class="flex-1 overflow-y-auto space-y-5 p-4 sm:p-6">
            <div class="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3.5">
              <span class="flex items-center gap-3">
                <ShieldCheck class="h-5 w-5 text-zinc-600" />
                <span><span class="block text-sm font-semibold text-zinc-900">开启公开分享</span><span class="mt-0.5 block text-xs text-zinc-500">关闭后，原链接会立即停止访问。</span></span>
              </span>
              <button
                type="button"
                role="switch"
                :aria-checked="enabled"
                class="relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                :class="enabled ? 'bg-zinc-900' : 'bg-zinc-300'"
                @click="enabled = !enabled"
              >
                <span
                  class="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                  :class="enabled ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </button>
            </div>

            <div
              class="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 px-4 py-3.5 transition-opacity"
              :class="{ 'pointer-events-none opacity-45': !enabled }"
            >
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-zinc-900">敏感信息脱敏</span>
                <span class="mt-0.5 block text-xs leading-5 text-zinc-500">隐藏姓名、头像、电话、邮箱、地址、网站及自定义基本信息。</span>
              </span>
              <button
                type="button"
                role="switch"
                :aria-checked="maskSensitive"
                class="relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                :class="maskSensitive ? 'bg-zinc-900' : 'bg-zinc-300'"
                @click="maskSensitive = !maskSensitive"
              >
                <span
                  class="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                  :class="maskSensitive ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </button>
            </div>

            <div :class="{ 'pointer-events-none opacity-45': !enabled }">
              <label class="text-sm font-medium text-zinc-700">分享有效期</label>
              <div class="mt-2 grid gap-3 sm:grid-cols-2">
                <Select
                  v-model="expiryMode"
                  :options="expiryOptions"
                  placeholder="选择分享有效期"
                  class="!h-11 !rounded-xl border-zinc-200 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-sm"
                />
                <DateTimePicker v-if="expiryMode === 'custom'" v-model="customExpireTime" placeholder="选择截至时间" />
                <div v-else class="flex h-11 items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 text-xs text-zinc-500"><Clock3 class="h-4 w-4 shrink-0" /><span class="truncate">{{ expiryMode === "permanent" ? "链接不会自动过期" : `保存后 ${expiryMode} 天失效` }}</span></div>
              </div>
            </div>

            <div :class="{ 'pointer-events-none opacity-45': !enabled }">
              <label class="text-sm font-medium text-zinc-700">自定义分享链接</label>
              <div class="mt-2 flex min-w-0 items-center rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900">
                <span class="max-w-[55%] shrink-0 truncate text-xs text-zinc-400">{{ shareBase }}</span>
                <input
                  v-model.trim="customToken"
                  maxlength="64"
                  placeholder="your-resume"
                  class="min-w-0 flex-1 bg-transparent text-xs text-zinc-700 outline-none"
                />
              </div>
              <p class="mt-1.5 text-xs leading-5 text-zinc-500">支持 3-64 位字母、数字、短横线或下划线，需以字母或数字开头。</p>
            </div>

            <div v-if="config?.token && config.enabled" class="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-medium" :class="config.active ? 'text-emerald-700' : 'text-amber-700'">{{ statusText }}</span>
                <button class="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900" :disabled="saving" @click="saveSettings(true)"><RefreshCw class="h-3.5 w-3.5" />重置链接</button>
              </div>
              <div class="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2.5">
                <input :value="shareLink" readonly class="min-w-0 flex-1 bg-transparent text-xs text-zinc-600 outline-none" />
                <button class="shrink-0 text-zinc-500 hover:text-zinc-900" title="复制分享内容" @click="copyShare"><Check v-if="copied" class="h-4 w-4 text-emerald-600" /><Copy v-else class="h-4 w-4" /></button>
              </div>
              <div class="flex justify-end">
                <Button variant="outline" size="sm" class="h-9 bg-white" @click="openSharePage"><ExternalLink class="mr-1.5 h-4 w-4" />查看分享页</Button>
              </div>
            </div>
          </div>

          <footer v-if="!loading" class="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50 px-4 sm:px-6 py-3 sm:py-4 z-10">
            <Button variant="outline" class="h-10 px-5 text-xs sm:text-sm" @click="$emit('update:open', false)">取消</Button>
            <Button class="h-10 px-5 text-xs sm:text-sm" :disabled="saving" @click="saveSettings(false)">{{ saving ? "保存中..." : enabled ? "保存并开启" : "关闭分享" }}</Button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.share-dialog-enter-active,
.share-dialog-leave-active { transition: opacity 0.2s ease; }
.share-dialog-enter-active section,
.share-dialog-leave-active section { transition: transform 0.25s ease, opacity 0.2s ease; }
.share-dialog-enter-from,
.share-dialog-leave-to { opacity: 0; }
.share-dialog-enter-from section,
.share-dialog-leave-to section { opacity: 0; transform: translateY(10px) scale(0.98); }
</style>
