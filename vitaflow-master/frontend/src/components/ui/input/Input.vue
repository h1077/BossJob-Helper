<script setup lang="ts">
defineProps<{ modelValue?: string | number; placeholder?: string; type?: string }>()
defineEmits<{ "update:modelValue": [value: string] }>()
</script>
<template>
  <input :type="type || 'text'" :value="modelValue" :placeholder="placeholder" class="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[14px] text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-500" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
</template>
