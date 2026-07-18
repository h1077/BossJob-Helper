<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { EChartsOption } from "echarts"
import { BarChart, LineChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import { init, use, type EChartsType } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"

use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer])

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  option: EChartsOption
}>()

const chartEl = ref<HTMLDivElement | null>(null)
let chart: EChartsType | null = null
let resizeObserver: ResizeObserver | null = null

function renderChart() {
  if (!chartEl.value) return
  if (!chart) chart = init(chartEl.value)
  chart.setOption(props.option, true)
}

onMounted(async () => {
  await nextTick()
  renderChart()
  if (chartEl.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(chartEl.value)
  }
})

watch(() => props.option, renderChart, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="chartEl" v-bind="$attrs"></div>
</template>
