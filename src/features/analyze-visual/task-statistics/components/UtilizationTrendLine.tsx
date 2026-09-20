/**
 * 利用率趋势折线（P35 私有；旧 EfficiencyTrendLine 等价迁移）。
 *
 * 视图语义（旧实现逐项等价）：
 * - 单 Y 轴折线，0–100%（y 轴名称与轴标签均为百分比）；
 * - 缺失天按 0 补齐、不可计算（null）断线——echarts line 默认 connectNulls=false，
 *   null 点不连线（与「0 值」视觉可区分，A19 口径纪律）；
 * - x 轴为自然日 YYYY-MM-DD（日期值不翻译）；
 * - 悬浮百分比格式化由页面注入（Intl，features 域隔离）。
 *
 * 生命周期纪律同 P33/P36/P37：按需注册、卸载 dispose、尺寸自适应、
 * 数据/主题/语言变化整体重建。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { ComposeOption, LineSeriesOption } from 'echarts'
import type {
  AriaComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { LineChart } from 'echarts/charts'
import { UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import type { UtilizationTrendPoint } from '@/features/analyze-visual/task-statistics/statistics'
import styles from '@/features/analyze-visual/task-statistics/components/TaskChart.module.css'

/* 按需注册：本图需要折线系列 + 坐标轴/图例/提示组件（不引入完整 echarts 包） */
echarts.use([
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
  UniversalTransition,
])

type TrendLineOption = ComposeOption<
  | LineSeriesOption
  | AriaComponentOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
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

/** 折线色：P33 主蓝（旧 seriesColors[0] 等价） */
const LINE_COLOR = '#5B8FF9'

interface UtilizationTrendLineProps {
  /** 趋势点（窗口覆盖的每个自然日按天升序；缺失天 0、不可计算 null） */
  data: UtilizationTrendPoint[]
  /** aria 可访问描述（已本地化） */
  ariaDescription: string
  /** 系列名 / y 轴名称（已本地化，含单位） */
  seriesName: string
  /** 悬浮百分比格式化（页面注入 Intl；null 传入返回「--」占位） */
  formatRatio: (ratio: number | null) => string
}

/** 利用率趋势折线（单 Y 轴；null 断线、0 有效值正常连线） */
export function UtilizationTrendLine({
  data,
  ariaDescription,
  seriesName,
  formatRatio,
}: UtilizationTrendLineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  const option = useMemo<TrendLineOption>(() => {
    const colors = THEME_COLORS[resolvedTheme]
    return {
      aria: { enabled: true, label: { description: ariaDescription }, decal: { show: true } },
      tooltip: {
        trigger: 'axis',
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        textStyle: { color: colors.secondary },
        // 悬浮百分比格式化（非数值/null → 「--」占位，不可计算区别于 0%）；
        // value 签名随 echarts 类型为宽联合，内部按数值处理
        valueFormatter: (value: unknown) => formatRatio(typeof value === 'number' ? value : null),
      },
      legend: {
        bottom: 0,
        data: [seriesName],
        textStyle: { color: colors.secondary },
      },
      // top/bottom 预留 y 轴名称与底部图例空间（旧 grid 同款尺寸）
      grid: { left: 48, right: 48, top: 36, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        // 桶日期 YYYY-MM-DD 与语言无关（日期值不翻译，规格 18.4）
        data: data.map((point) => point.date),
        axisLabel: { color: colors.secondary, fontSize: 11, hideOverlap: true },
        axisLine: { lineStyle: { color: colors.splitLine } },
      },
      yAxis: {
        type: 'value',
        name: seriesName,
        min: 0,
        max: 1,
        nameTextStyle: { color: colors.secondary },
        axisLabel: {
          color: colors.secondary,
          formatter: (value: number) => `${Math.round(value * 100)}%`,
        },
        splitLine: { lineStyle: { color: colors.splitLine } },
      },
      series: [
        {
          name: seriesName,
          type: 'line' as const,
          smooth: true,
          // null 点断线（connectNulls 默认 false）：不可计算与 0 值视觉可区分
          data: data.map((point) => point.utilization),
          itemStyle: { color: LINE_COLOR },
          lineStyle: { color: LINE_COLOR, width: 2 },
        },
      ],
    }
  }, [data, ariaDescription, seriesName, formatRatio, resolvedTheme])

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
