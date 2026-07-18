<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits<{ "update:modelValue": [value: boolean] }>()
</script>
<template>
  <button type="button" class="relative h-6 w-11 rounded-full transition" :class="modelValue ? 'bg-gray-900' : 'bg-gray-300'" @click="$emit('update:modelValue', !modelValue)">
    <span class="absolute top-1 h-4 w-4 rounded-full bg-white transition" :class="modelValue ? 'left-6' : 'left-1'" />
  </button>
</template>
