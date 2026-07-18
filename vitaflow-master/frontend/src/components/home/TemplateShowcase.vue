<script setup lang="ts">
import { onMounted, ref } from "vue"
import { listTemplatesApi, type TemplateItem } from "@/api/template"
import TemplatePreview from "@/components/templates/TemplatePreview.vue"

const templates = ref<TemplateItem[]>([])
onMounted(async () => {
  templates.value = await listTemplatesApi()
})
</script>

<template>
  <section class="bg-[#fafafa] py-12 sm:py-32 border-t border-zinc-100">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center mb-8 sm:mb-16">
        <h2 class="text-xl font-medium tracking-tight text-zinc-900 sm:text-4xl">精心打磨的极简模板</h2>
        <p class="mt-3 sm:mt-4 text-sm sm:text-lg text-zinc-500">抛弃花哨，专注于排版的黄金分割。完美兼容各大厂 ATS 系统解析。</p>
      </div>
      <div class="grid grid-cols-2 gap-3.5 sm:gap-8 lg:grid-cols-4">
        <div v-for="item in templates.slice(0, 4)" :key="item.template_id" class="group relative rounded-[1.5rem] sm:rounded-[2rem] bg-white p-2 sm:p-2.5 shadow-sm ring-1 ring-zinc-100 transition-all duration-500 hover:shadow-2xl hover:shadow-zinc-200/50 hover:ring-zinc-200 hover:-translate-y-2">
          <div class="relative w-full aspect-[1/1.1] overflow-hidden rounded-[1.2rem] sm:rounded-[1.5rem] bg-zinc-50 pointer-events-none border border-zinc-100/80">
             <div class="absolute inset-x-0 top-0 w-full transform transition-transform duration-700 ease-out group-hover:scale-[1.05]">
               <TemplatePreview :html="item.preview_html" />
             </div>
             <!-- Soft fade at bottom -->
             <div class="absolute inset-x-0 bottom-0 h-16 sm:h-24 bg-gradient-to-t from-zinc-50 via-zinc-50/80 to-transparent pointer-events-none"></div>
          </div>
          <div class="mt-3 sm:mt-5 mb-1 sm:mb-2 flex items-center justify-between px-2 sm:px-3">
            <div class="text-xs sm:text-base font-medium tracking-tight text-zinc-900 truncate mr-1">{{ item.name }}</div>
            <span class="shrink-0 inline-flex items-center rounded-full bg-zinc-100 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold text-zinc-600 transition-colors group-hover:bg-zinc-900 group-hover:text-white uppercase tracking-wider">
              {{ item.category }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
