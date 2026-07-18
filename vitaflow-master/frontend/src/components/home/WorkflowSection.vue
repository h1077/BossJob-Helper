<script setup lang="ts">
import { RouterLink } from "vue-router"
import { ArrowRight } from "lucide-vue-next"
</script>

<template>
  <section class="bg-white py-12 border-t border-zinc-100 sm:py-32">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-xl font-medium tracking-tight text-zinc-900 sm:text-4xl">准备好开始了？</h2>
      <p class="mt-3 sm:mt-4 text-sm sm:text-lg text-zinc-500">只需三步，即可拥有属于你的专业简历。</p>
      
      <div class="mt-8 sm:mt-24">
        <div class="flex flex-row justify-center items-center gap-3 sm:gap-12 md:gap-32">
          <div v-for="(item, index) in ['选择优质模板', 'AI 辅助填写', '一键导出 PDF']" :key="item" class="group flex flex-col items-center">
            <div class="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl border border-zinc-200 bg-zinc-50 text-base sm:text-xl font-medium text-zinc-900 mb-2 sm:mb-6 transition-colors duration-300 group-hover:bg-zinc-100 group-hover:border-zinc-300">
              {{ index + 1 }}
            </div>
            <span class="text-xs sm:text-base font-medium text-zinc-900 whitespace-nowrap">{{ item }}</span>
          </div>
        </div>
      </div>
      
      <div class="mt-12 sm:mt-20">
        <RouterLink to="/resumes" class="inline-flex h-11 sm:h-14 items-center justify-center rounded-full bg-zinc-900 px-8 sm:px-10 text-xs sm:text-base font-medium !text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2">
          立即免费创建
          <ArrowRight class="w-4 h-4 ml-2 text-white" />
        </RouterLink>
      </div>
    </div>
  </section>
</template>
