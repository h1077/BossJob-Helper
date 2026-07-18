<script setup lang="ts">
import Button from "@/components/ui/button/Button.vue"
defineProps<{ loading?: boolean }>()
</script>
<template><Button :disabled="loading"><slot /></Button></template>
