<script setup lang="ts">
import type { Component } from "vue"
import { RefreshCw, ShieldCheck } from "lucide-vue-next"
import AppLayout from "@/components/layout/AppLayout.vue"
import Button from "@/components/ui/button/Button.vue"

defineProps<{
  navItems: Array<{ id: string; label: string; icon: Component }>
  section: string
  title: string
  loading: boolean
  error?: string
}>()

defineEmits<{
  switchSection: [section: string]
  refresh: []
}>()
</script>

<template>
  <AppLayout>
    <div class="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:py-10">
      <aside class="hidden w-56 shrink-0 lg:block">
        <div class="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div class="mb-3 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-zinc-900">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white"><ShieldCheck class="h-4 w-4" /></span>
            管理控制台
          </div>
          <button
            v-for="item in navItems"
            :key="item.id"
            class="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition"
            :class="section === item.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'"
            @click="$emit('switchSection', item.id)"
          >
            <component :is="item.icon" class="h-4 w-4" />{{ item.label }}
          </button>
        </div>
      </aside>

      <main class="min-w-0 flex-1">
        <div class="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm"
            :class="section === item.id ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-600'"
            @click="$emit('switchSection', item.id)"
          >
            <component :is="item.icon" class="h-4 w-4" />{{ item.label }}
          </button>
        </div>

        <header class="mb-7 flex items-end justify-between gap-4">
          <div>
            <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 sm:mb-2 sm:text-xs sm:tracking-[0.18em]">VitaFlow Admin</p>
            <h1 class="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{{ title }}</h1>
            <p class="mt-1.5 text-xs text-zinc-500 sm:mt-2 sm:text-sm">管理与配置 VitaFlow 系统各项核心功能</p>
          </div>
          <Button variant="outline" size="sm" :disabled="loading" @click="$emit('refresh')"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />刷新</Button>
        </header>

        <div v-if="error" class="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>

        <slot />
      </main>
    </div>
  </AppLayout>
</template>
