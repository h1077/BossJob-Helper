<script setup lang="ts">
import BaseRichTextEditor from "@/components/admin/RichTextEditor.vue"

withDefaults(defineProps<{ modelValue: string; placeholder?: string; compact?: boolean }>(), {
  placeholder: "输入正文…",
  compact: true,
})
defineEmits<{ "update:modelValue": [value: string] }>()
</script>

<template>
  <BaseRichTextEditor
    :model-value="modelValue || ''"
    :placeholder="placeholder"
    :compact="compact"
    :allow-images="false"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
