<script setup lang="ts">
import { CheckCircle2, FileUp, Sparkles } from "lucide-vue-next"

withDefaults(defineProps<{
  open: boolean
  progress: number
  stageIndex: number
  stages: string[]
  templateName?: string
}>(), {
  templateName: "",
})
</script>

<template>
  <Teleport to="body">
    <Transition name="resume-import-progress">
      <div v-if="open" class="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
        <section class="w-full max-w-[520px] rounded-[28px] border border-zinc-200 bg-white p-7 shadow-[0_24px_70px_-18px_rgba(0,0,0,0.28)] sm:p-8">
          <div class="flex items-center justify-between gap-4">
            <div class="flex min-w-0 items-center gap-4">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/15">
                <FileUp class="h-6 w-6" stroke-width="1.6" />
              </span>
              <div class="min-w-0">
                <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Resume Import</p>
                <h3 class="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl">正在智能导入简历</h3>
              </div>
            </div>
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-100 bg-zinc-50 text-sm font-semibold tabular-nums text-zinc-700 shadow-sm">{{ progress }}%</span>
          </div>

          <p class="mt-4 text-sm leading-6 text-zinc-500">正在识别原简历内容与结构，并转换为可继续编辑的履历数据。</p>

          <div class="mt-6 space-y-2.5">
            <div
              v-for="(stage, index) in stages"
              :key="stage"
              class="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300"
              :class="index === stageIndex ? 'bg-zinc-50 shadow-sm ring-1 ring-zinc-100' : ''"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300"
                :class="index < stageIndex ? 'bg-blue-500 text-white' : index === stageIndex ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400 ring-1 ring-zinc-200'"
              >
                <CheckCircle2 v-if="index < stageIndex" class="h-4 w-4" />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="text-sm font-medium transition-colors" :class="index <= stageIndex ? 'text-zinc-900' : 'text-zinc-400'">{{ stage }}</span>
              <span v-if="index === stageIndex && progress < 100" class="ml-auto flex gap-1.5">
                <i v-for="dot in 3" :key="dot" class="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-700" :style="{ animationDelay: `${dot * 150}ms` }"></i>
              </span>
              <CheckCircle2 v-else-if="index < stageIndex" class="ml-auto h-4 w-4 text-blue-500" />
            </div>
          </div>

          <div class="mt-7 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div class="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out" :style="{ width: `${progress}%` }"></div>
          </div>

          <div class="mt-5 flex items-start gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-500 ring-1 ring-zinc-200/70">
            <Sparkles class="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
            <span>完成后将直接进入编辑页面<span v-if="templateName">，并应用「{{ templateName }}」模板</span>，请勿关闭当前窗口。</span>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.resume-import-progress-enter-active,
.resume-import-progress-leave-active {
  transition: opacity 0.2s ease;
}

.resume-import-progress-enter-active section,
.resume-import-progress-leave-active section {
  transition: transform 0.26s ease, opacity 0.2s ease;
}

.resume-import-progress-enter-from,
.resume-import-progress-leave-to {
  opacity: 0;
}

.resume-import-progress-enter-from section,
.resume-import-progress-leave-to section {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
