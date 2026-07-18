<script setup lang="ts">
import { ref, watch } from "vue"
import { X, Gift, Coins } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"

const props = defineProps<{
  open: boolean
  mode: "single" | "all"
  username?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [points: number, description: string]
}>()

const points = ref(100)
const description = ref("")

watch(
  () => [props.open, props.mode],
  () => {
    if (props.open) {
      points.value = 100
      description.value = props.mode === "all" ? "运营活动赠送 Flow Points" : "管理员调整 Flow Points"
    }
  },
  { immediate: true }
)

function handleSubmit() {
  const p = Number(points.value)
  if (!Number.isFinite(p) || p === 0 || (props.mode === "all" && p < 0)) return
  emit("confirm", p, description.value.trim() || (props.mode === "all" ? "运营活动赠送 Flow Points" : "管理员调整 Flow Points"))
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
        <div class="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
          <header class="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Gift v-if="mode === 'all'" class="h-5 w-5" />
                  <Coins v-else class="h-5 w-5" />
                </span>
                <div>
                  <h2 class="text-lg font-semibold tracking-tight text-zinc-950">
                    {{ mode === 'all' ? '全员发放 Flow Points' : `调整 Flow Points` }}
                  </h2>
                  <p class="mt-0.5 text-xs text-zinc-500">
                    {{ mode === 'all' ? '给所有正常用户分批发放同等点数' : `为 ${username} 调整点数` }}
                  </p>
                </div>
              </div>
              <Button size="icon" variant="ghost" class="h-9 w-9 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" @click="$emit('close')">
                <X class="h-4 w-4" />
              </Button>
            </div>
          </header>

          <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
            <div>
              <label class="block text-sm font-semibold text-zinc-900">
                {{ mode === 'all' ? '发放额度 (点数)' : '调整额度 (正数增加，负数扣减)' }}
              </label>
              <div class="mt-2 relative">
                <input
                  v-model.number="points"
                  type="number"
                  required
                  step="0.01"
                  :min="mode === 'all' ? 1 : undefined"
                  class="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  placeholder="请输入点数 (例如: 100)"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-zinc-900">
                {{ mode === 'all' ? '发放说明' : '调整原因' }}
              </label>
              <div class="mt-2">
                <input
                  v-model="description"
                  type="text"
                  required
                  class="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  placeholder="请输入备注说明"
                />
              </div>
            </div>

            <footer class="flex items-center justify-end gap-3 pt-3">
              <Button type="button" variant="outline" class="h-11 px-6 rounded-xl" @click="$emit('close')">取消</Button>
              <Button type="submit" class="h-11 px-6 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700">确定</Button>
            </footer>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div,
.modal-leave-to > div {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
