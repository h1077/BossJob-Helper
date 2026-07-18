<script setup lang="ts">
import { CheckCircle2 } from "lucide-vue-next"
import Button from "@/components/ui/button/Button.vue"
import type { AdminPointRule } from "@/api/admin"

defineProps<{
  saving: boolean
}>()

const rules = defineModel<AdminPointRule[]>("rules", { required: true })

defineEmits<{
  save: []
}>()
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div></div>
      <Button size="sm" class="h-10 w-full sm:w-auto" :disabled="saving" @click="$emit('save')"><CheckCircle2 class="mr-2 h-4 w-4" />保存规则</Button>
    </div>
    <article class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr class="border-b bg-zinc-50 text-xs text-zinc-500">
              <th class="px-5 py-3">功能</th>
              <th class="px-5 py-3">每次扣点</th>
              <th class="px-5 py-3">输入百万 Token</th>
              <th class="px-5 py-3">输出百万 Token</th>
              <th class="px-5 py-3">启用</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rules" :key="item.feature_type" class="border-b border-zinc-100 last:border-0">
              <td class="px-5 py-4 align-top">
                <input v-model="item.display_name" class="block h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                <p class="mt-1 text-xs text-zinc-400">{{ item.feature_type }}</p>
              </td>
              <td class="px-5 py-4 align-top">
                <input v-model.number="item.points_per_call" type="number" min="0" step="0.01" class="block h-9 w-32 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
              </td>
              <td class="px-5 py-4 align-top">
                <input v-model.number="item.points_per_million_input_tokens" type="number" min="0" step="0.01" class="block h-9 w-36 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                <p class="mt-1 text-xs text-zinc-400">按输入 Token 折算</p>
              </td>
              <td class="px-5 py-4 align-top">
                <input v-model.number="item.points_per_million_output_tokens" type="number" min="0" step="0.01" class="block h-9 w-36 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
                <p class="mt-1 text-xs text-zinc-400">按输出 Token 折算</p>
              </td>
              <td class="px-5 py-4 align-top">
                <div class="flex h-9 items-center">
                  <input v-model="item.enabled" type="checkbox" class="h-4 w-4 accent-zinc-900" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </div>
</template>
