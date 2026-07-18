<script setup lang="ts">
import { Sparkles, FileText, LayoutTemplate, Share } from "lucide-vue-next"
const features = [
  {
    icon: Sparkles,
    title: "智能提炼",
    desc: "将零散的经历转化为专业的表达，精准突出你的核心竞争力。"
  },
  {
    icon: LayoutTemplate,
    title: "极简排版",
    desc: "多套经过设计师打磨的模板，完美平衡美观与 ATS 兼容性。"
  },
  {
    icon: FileText,
    title: "实时双栏",
    desc: "内容与样式分离。左侧专注内容编辑，右侧实时预览最终效果。"
  },
  {
    icon: Share,
    title: "一键导出",
    desc: "支持高清晰度 PDF 导出，无论打印还是在线投递都保持完美。"
  }
]
</script>

<template>
  <section class="bg-white py-12 sm:py-32 overflow-hidden">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-xl sm:text-4xl font-medium tracking-tight text-zinc-900 whitespace-nowrap sm:whitespace-normal">少一点格式负担，多一点内容表达</h2>
        <p class="mt-3 sm:mt-4 text-sm sm:text-lg text-zinc-500 font-normal">去掉繁琐的排版流程，把重点留给经历梳理、内容优化和最终呈现。</p>
      </div>
      <div class="mx-auto mt-8 sm:mt-20 lg:mt-24 lg:max-w-none">
        <div class="grid max-w-none grid-cols-4 gap-2 sm:gap-8">
          <div v-for="feature in features" :key="feature.title" class="group relative flex flex-col items-center justify-center text-center p-3 sm:p-8 rounded-2xl sm:rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/60 hover:ring-zinc-300 transition-all duration-300 hover:shadow-md hover:-translate-y-1 aspect-square sm:aspect-auto">
            <div class="mb-2 sm:mb-6 flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl sm:bg-zinc-50 sm:border sm:border-zinc-100 transition-transform duration-300 group-hover:scale-105">
              <component :is="feature.icon" class="h-4.5 w-4.5 sm:h-6 sm:w-6 text-zinc-700 transition-colors duration-300 group-hover:text-zinc-900" />
            </div>
            <h3 class="text-xs sm:text-lg font-semibold text-zinc-900 tracking-tight whitespace-nowrap">{{ feature.title }}</h3>
            <p class="hidden sm:block mt-3 text-sm text-zinc-500 leading-relaxed font-normal">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
