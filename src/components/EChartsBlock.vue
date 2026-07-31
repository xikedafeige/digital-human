<template>
  <section class="echarts-block">
    <pre v-if="hasRenderError" class="echarts-block__fallback"><code>{{ raw }}</code></pre>
    <div v-else ref="chartElement" class="echarts-block__canvas" role="img"></div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'

const props = defineProps<{
  option: Record<string, unknown>
  raw: string
}>()

const chartElement = ref<HTMLDivElement | null>(null)
const hasRenderError = ref(false)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const renderChart = async () => {
  await nextTick()
  if (!chartElement.value || !chart) {
    return
  }

  try {
    chart.setOption(props.option as EChartsOption, {
      notMerge: true,
      lazyUpdate: true,
    })
    hasRenderError.value = false
    chart.resize()
  } catch {
    hasRenderError.value = true
  }
}

onMounted(async () => {
  await nextTick()
  if (!chartElement.value) {
    return
  }

  chart = echarts.init(chartElement.value)
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartElement.value)
  void renderChart()
})

watch(() => props.option, () => void renderChart(), { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})
</script>

<style scoped lang="less">
.echarts-block {
  min-height: 280px;
  overflow: hidden;
  border: 1px solid rgba(207, 218, 237, 0.86);
  border-radius: 12px;
  background: #ffffff;
}

.echarts-block__canvas {
  width: 100%;
  height: 280px;
}

.echarts-block__fallback {
  max-height: 280px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  background: rgba(24, 39, 75, 0.08);
  color: inherit;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
