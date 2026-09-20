/**
 * 任务执行时长分布柱（P35 私有；旧 DurationDistributionBar 等价迁移）。
 *
 * 视图语义（旧实现逐项等价）：
 * - 固定 6 桶：<1m / 1–2m / 2–3m / 3–5m / 5–10m / >10m（label 已随语言翻译）；
 * - 判空以分布桶计数总和为准（接口仅提供分桶计数，无原始耗时样本）；
 * - P50/P90 需要原始样本：真实接口无样本，不展示标线（旧实现传 null 同口径）；
 * - 单系列柱（P33 主蓝），y 轴名称「任务数量（个）」，x 轴桶标签自带分钟单位。
 *
 * 生命周期纪律同 P33/P36/P37：按需注册、卸载 dispose、尺寸自适应、
 * 数据/主题/语言变化整体重建。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { BarSeriesOption, ComposeOption } from 'echarts'
import type {
  AriaComponentOption,
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { BarChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import type { DurationBucketView } from '@/features/analyze-visual/task-statistics/statistics'
import styles from '@/features/analyze-visual/task-statistics/components/TaskChart.module.css'

/* 按需注册：本图需要柱状系列 + 坐标轴/提示组件（不引入完整 echarts 包） */
echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
])

type DistributionOption = ComposeOption<
  BarSeriesOption | AriaComponentOption | GridComponentOption | TooltipComponentOption
>

const THEME_COLORS = {
  light: {
    secondary: '#5f6b80',
    splitLine: '#e3e8f2',
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipBorder: '#e5e7eb',
  },
  dark: {
    secondary: '#8b97ad',
    splitLine: '#374151',
    tooltipBg: 'rgba(30,30,30,0.95)',
    tooltipBorder: '#4b5563',
  },
} as const

/** 柱色：P33 主蓝（旧 seriesColors[0] 等价） */
const BAR_COLOR = '#5B8FF9'

interface DurationDistributionBarProps {
  /** 分布桶（固定 6 桶升序，缺失桶已按 0 对齐） */
  data: DurationBucketView[]
  /** 桶标签（已本地化，顺序与 data 一致：<1m / 1–2m / … / >10m） */
  bucketLabels: string[]
  /** 系列名（已本地化，axis 悬浮提示中展示；本图无图例） */
  seriesName: string
  /** y 轴名称（已本地化，含单位） */
  valueAxisName: string
  /** aria 可访问描述（已本地化） */
  ariaDescription: string
}

/** 任务执行时长分布柱（固定分桶；P50/P90 无原始样本不展示标线） */
export function DurationDistributionBar({
  data,
  bucketLabels,
  seriesName,
  valueAxisName,
  ariaDescription,
}: DurationDistributionBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  const option = useMemo<DistributionOption>(() => {
    const colors = THEME_COLORS[resolvedTheme]
    return {
      aria: { enabled: true, label: { description: ariaDescription }, decal: { show: true } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        textStyle: { color: colors.secondary },
      },
      grid: { left: 52, right: 16, top: 36, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: bucketLabels,
        axisLabel: { color: colors.secondary, fontSize: 11 },
        axisLine: { lineStyle: { color: colors.splitLine } },
      },
      yAxis: {
        type: 'value',
        // 数量单位（个）标注在数值轴上方；x 轴桶标签自带分钟单位
        name: valueAxisName,
        nameTextStyle: { color: colors.secondary },
        axisLabel: { color: colors.secondary },
        splitLine: { lineStyle: { color: colors.splitLine } },
      },
      series: [
        {
          // 系列名带单位：axis 触发的悬浮提示中展示（本图无图例）
          name: seriesName,
          type: 'bar' as const,
          itemStyle: { color: BAR_COLOR },
          barMaxWidth: 40,
          data: data.map((bucket) => bucket.count),
          // 接口无原始耗时样本：不展示 P50/P90 标线（旧实现传 null 同口径）
        },
      ],
    }
  }, [data, bucketLabels, seriesName, valueAxisName, ariaDescription, resolvedTheme])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = echarts.init(container)
    chart.setOption(option, true)

    const observer = new ResizeObserver(() => {
      chart.resize()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [option])

  return <div ref={containerRef} className={styles.standardChart} />
}
