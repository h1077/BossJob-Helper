<script setup lang="ts">
import { computed } from "vue"
import Button from "@/components/ui/button/Button.vue"
import Select from "@/components/ui/select/Select.vue"

const props = defineProps<{
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: { label: string; value: number | string }[]
}>()

const emit = defineEmits<{
  (e: "update:page", page: number): void
  (e: "update:pageSize", size: number): void
  (e: "change", page: number): void
}>()

const defaultPageSizeOptions = computed(() => props.pageSizeOptions || [
  { label: "10 条/页", value: 10 },
  { label: "20 条/页", value: 20 },
  { label: "50 条/页", value: 50 },
  { label: "100 条/页", value: 100 },
])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

const pageNumbers = computed(() => {
  const current = props.page
  const total = totalPages.value
  const start = Math.max(1, Math.min(current - 2, total - 4))
  const end = Math.min(total, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

const onPageSizeChange = (val: number | string) => {
  const num = Number(val)
  emit("update:pageSize", num)
  emit("change", 1)
}

const onPageChange = (p: number) => {
  if (p < 1 || p > totalPages.value || p === props.page) return
  emit("update:page", p)
  emit("change", p)
}
</script>

<template>
  <footer v-if="total > 0" class="flex items-center justify-between border-t border-zinc-100 px-3 py-3 text-xs text-zinc-500 sm:px-6 sm:py-4 sm:text-sm">
    <div class="flex items-center gap-1 sm:gap-3 shrink-0 whitespace-nowrap">
      <span class="text-xs sm:text-sm text-zinc-500 whitespace-nowrap shrink-0">共 {{ total }} 条<span class="hidden sm:inline">，第 {{ page }}/{{ totalPages }} 页</span></span>
      <Select
        :model-value="pageSize"
        :options="defaultPageSizeOptions"
        ghost
        class="w-auto px-2 py-1 text-xs sm:text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors shrink-0"
        @update:model-value="onPageSizeChange"
      />
    </div>

    <!-- Mobile pagination navigation (Single row compact) -->
    <div class="flex items-center gap-1 sm:hidden shrink-0">
      <Button variant="outline" size="sm" class="h-7 px-2 text-xs whitespace-nowrap" :disabled="page <= 1" @click="onPageChange(page - 1)">上一页</Button>
      <span class="text-xs font-medium px-1">{{ page }}/{{ totalPages }}</span>
      <Button variant="outline" size="sm" class="h-7 px-2 text-xs whitespace-nowrap" :disabled="page >= totalPages" @click="onPageChange(page + 1)">下一页</Button>
    </div>

    <!-- Desktop pagination navigation -->
    <div class="hidden sm:flex items-center gap-1 shrink-0">
      <Button variant="outline" size="sm" :disabled="page <= 1" @click="onPageChange(page - 1)">上一页</Button>
      <button
        v-for="num in pageNumbers"
        :key="num"
        class="h-8 min-w-8 rounded-md border px-2 text-xs font-medium transition"
        :class="num === page ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'"
        @click="onPageChange(num)"
      >
        {{ num }}
      </button>
      <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="onPageChange(page + 1)">下一页</Button>
    </div>
  </footer>
</template>
