<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    size?: "sm" | "md" | "lg"
    tone?: "dark" | "light"
    showText?: boolean
  }>(),
  {
    size: "md",
    tone: "dark",
    showText: true,
  },
)

const sizeClass = computed(() => {
  if (props.size === "sm") return "h-9"
  if (props.size === "lg") return "h-12"
  return "h-10"
})

const iconClass = computed(() => {
  if (props.size === "sm") return "h-9 w-9"
  if (props.size === "lg") return "h-12 w-12"
  return "h-10 w-10"
})

const titleClass = computed(() => {
  if (props.size === "lg") return "text-2xl"
  if (props.size === "sm") return "text-lg"
  return "text-xl"
})

const subtitleClass = computed(() => (props.size === "lg" ? "text-sm" : "text-[11px]"))
const textToneClass = computed(() => (props.tone === "light" ? "text-white" : "text-gray-950"))
const subToneClass = computed(() => (props.tone === "light" ? "text-gray-300" : "text-gray-500"))
const iconAccent = computed(() => "#2563eb")
</script>

<template>
  <span class="inline-flex items-center gap-3" :class="sizeClass">
    <svg :class="iconClass" viewBox="0 0 48 48" role="img" aria-label="VitaFlow 简历流标志">
      <rect x="8" y="5" width="32" height="38" rx="7" fill="#ffffff" stroke="#d1d5db" stroke-width="1.5" />
      <path d="M15 14h13" stroke="#111827" stroke-width="3.2" stroke-linecap="round" />
      <path d="M15 21h10" :stroke="iconAccent" stroke-width="3" stroke-linecap="round" />
      <path d="M15 27h19M15 32h15" stroke="#d1d5db" stroke-width="2.2" stroke-linecap="round" />
      <path d="M15 37c5-4.2 10 3.8 18-1.8" fill="none" :stroke="iconAccent" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="34" cy="35.2" r="2.2" :fill="iconAccent" />
    </svg>
    <span v-if="showText" class="leading-none">
      <span class="block font-semibold tracking-normal" :class="[titleClass, textToneClass]">VitaFlow</span>
      <span class="mt-1 block font-medium tracking-normal" :class="[subtitleClass, subToneClass]">简历流</span>
    </span>
  </span>
</template>
