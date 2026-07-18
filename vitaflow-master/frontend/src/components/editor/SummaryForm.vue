<script setup lang="ts">
import Label from "@/components/ui/label/Label.vue"
import RichTextEditor from "./RichTextEditor.vue"
defineProps<{ summary: { content: string } }>()
defineEmits<{ change: [] }>()
</script>
<template>
  <div class="max-w-3xl mx-auto py-2">
    <Label class="text-[13px] text-zinc-600 mb-2 block font-medium">个人简介</Label>
    <RichTextEditor v-model="summary.content" placeholder="填写个人简介，可使用列表、加粗等格式" @update:model-value="$emit('change')" />
  </div>
</template>
