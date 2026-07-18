<script setup lang="ts">
// 该组件已改造为虚拟插槽包装器，实际导航栏与布局管理已迁移至 App.vue 与 MainLayout.vue
// 以便在路由功能切换时保持顶部导航栏常驻不重绘、防止闪烁。
</script>

<template>
  <slot />
</template>
