/**
 * 故障趋势图（P36 私有；旧 FaultTrendBarLine 等价迁移）：
 * 柱 = 当天故障次数（左轴），折线 = 故障频率（次/天，右轴）。
 * 日桶恒为自然日且覆盖 1 天，频率（次/天）= 当天次数——两系列数值相同，
 * 但保留双轴语义与旧实现一致（口径提示中说明）。
 *
 * 生命周期纪律（DoD14，P33 StatisticsBarChart 同款）：echarts 按需注册，
 * 实例随组件卸载 dispose；ResizeObserver 跟随容器尺寸；数据/主题/语言任一
 * 变化整体 setOption(option, notMerge=true) 重建，不残留旧系列。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { BarChart, LineChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import type { FaultTrendPoint } from '@/features/analyze-visual/fault-alert/statistics'
import styles from '@/features/analyze-visual/fault-alert/components/FaultChart.module.css'

/* 按需注册：本图需要柱状 + 折线两类系列（不引入完整 echarts 包） */
echarts.use([
  BarChart,
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
])

/** 主题配色（canvas 无法消费 CSS 变量，P33/P34 同款双主题色表） */
const THEME_COLORS = {
  light: {
    primary: '#101728',
    secondary: '#5f6b80',
    splitLine: '#e3e8f2',
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipBorder: '#e5e7eb',
  },
  dark: {
    primary: '#f2f5fd',
    secondary: '#8b97ad',
    splitLine: '#374151',
    tooltipBg: 'rgba(30,30,30,0.95)',
    tooltipBorder: '#4b5563',
  },
} as const

/** 语义色：故障柱取警示红、频率折线取紫（旧 errorColor / seriesColors[3] 等价） */
const FAULT_BAR_COLOR = '#E86452'
const FREQUENCY_LINE_COLOR = '#945FB9'

interface FaultTrendChartProps {
  /** 趋势点（窗口覆盖的每个自然日按天升序，缺失天已补 0） */
  data: FaultTrendPoint[]
  /** 系列名（已本地化：柱=故障次数（次）、线=故障频率（次/天）） */
  barSeriesName: string
  lineSeriesName: string
}

export function FaultTrendChart({ data, barSeriesName, lineSeriesName }: FaultTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  // option 依赖项变化即整体重建（notMerge 清旧系列：语言切换不残留上一语言图例）
  const option = useMemo(
    () => {
      const colors = THEME_COLORS[resolvedTheme]
      return {
        tooltip: { trigger: 'axis' },
        legend: {
          bottom: 0,
          left: 'center',
          icon: 'roundRect',
          itemWidth: 14,
          itemHeight: 10,
          textStyle: { color: colors.secondary },
        },
        // top/bottom 预留双 Y 轴名称与底部图例空间（旧 grid 同款尺寸）
        grid: { left: 48, right: 56, top: 36, bottom: 64, containLabel: true },
        xAxis: {
          type: 'category',
          // 桶日期 yyyy-MM-dd 与语言无关（日期值不翻译，规格 18.4）
          data: data.map((point) => point.date),
          axisLine: { lineStyle: { color: colors.splitLine } },
          axisTick: { show: false },
          axisLabel: { color: colors.secondary, fontSize: 11 },
        },
        yAxis: [
          {
            type: 'value',
            name: barSeriesName,
            nameTextStyle: { color: colors.secondary },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: colors.secondary },
            splitLine: { lineStyle: { color: colors.splitLine, type: 'dashed' } },
          },
          {
            type: 'value',
            name: lineSeriesName,
            nameTextStyle: { color: colors.secondary },
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: colors.secondary },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: barSeriesName,
            type: 'bar',
            yAxisIndex: 0,
            barMaxWidth: 28,
            itemStyle: { color: FAULT_BAR_COLOR, borderRadius: [4, 4, 0, 0] },
            data: data.map((point) => point.faultCount),
          },
          {
            name: lineSeriesName,
            type: 'line',
            yAxisIndex: 1,
            smooth: true,
            showSymbol: false,
            lineStyle: { color: FREQUENCY_LINE_COLOR, width: 2 },
            itemStyle: { color: FREQUENCY_LINE_COLOR },
            data: data.map((point) => point.faultCount),
          },
        ],
      }
    },
    [data, barSeriesName, lineSeriesName, resolvedTheme],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // init 与 setOption 同 effect：数据/主题/语言变化即整体重建
    const chart = echarts.init(container)
    chart.setOption(option, true)

    // 容器尺寸自适应（页签隐藏宽度归零、恢复可见后自动恢复绘制）
    const observer = new ResizeObserver(() => {
      chart.resize()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [option])

  return <div ref={containerRef} className={styles.chart} />
}
