/**
 * 任务量趋势堆叠柱（P35 私有；旧 TaskVolumeStackedBar 等价迁移）。
 *
 * 视图语义（旧实现逐项等价）：
 * - 每天一根柱，按 完成 / 失败 / 取消 三系列堆叠（终态口径，缺失天已补 0）；
 * - x 轴为自然日 YYYY-MM-DD（日期值不翻译，语言切换仅影响图例/提示文案）；
 * - y 轴名称「任务数量（个）」，悬浮数值千分位并追加单位；
 * - 悬浮按 axis 触发，valueFormatter 由页面注入（Intl 千分位，features 域隔离）。
 *
 * 生命周期纪律（DoD14，P33/P36/P37 同款）：echarts 按需注册，实例随组件卸载
 * dispose；ResizeObserver 跟随容器尺寸；数据/主题/语言任一变化整体
 * setOption(option, notMerge=true) 重建，不残留旧系列。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { BarSeriesOption, ComposeOption } from 'echarts'
import type {
  AriaComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { BarChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import type { DailyVolumePoint } from '@/features/analyze-visual/task-statistics/statistics'
import styles from '@/features/analyze-visual/task-statistics/components/TaskChart.module.css'

/* 按需注册：本图需要柱状系列 + 坐标轴/图例/提示组件（不引入完整 echarts 包） */
echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
])

/** 声明本图实际使用的组件（与按需注册保持一致的精确类型） */
type VolumeStackedOption = ComposeOption<
  BarSeriesOption | AriaComponentOption | GridComponentOption | LegendComponentOption | TooltipComponentOption
>

/** 主题配色（canvas 无法消费 CSS 变量，P33/P36/P37 同款双主题色表） */
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

/** 语义色：完成=成功绿 / 失败=警示红（P36 同款）/ 取消=中性灰（P33 色板体系内） */
const COMPLETED_COLOR = '#5AD8A6'
const FAILED_COLOR = '#E86452'
const CANCELED_COLOR = '#A8B3C5'

interface TaskVolumeStackedBarProps {
  /** 趋势点（窗口覆盖的每个自然日按天升序，缺失天已补 0） */
  data: DailyVolumePoint[]
  /** aria 可访问描述（已本地化；读屏用途，旧实现同款） */
  ariaDescription: string
  /** 系列名（已本地化：完成 / 失败 / 取消） */
  completedName: string
  failedName: string
  canceledName: string
  /** y 轴名称（已本地化，含单位） */
  valueAxisName: string
  /** 悬浮数值格式化（页面注入 Intl 千分位；features 域隔离不直接导入 dashboard） */
  formatValue: (value: number) => string
}

/** 任务量趋势堆叠柱：完成 / 失败 / 取消（终态口径） */
export function TaskVolumeStackedBar({
  data,
  ariaDescription,
  completedName,
  failedName,
  canceledName,
  valueAxisName,
  formatValue,
}: TaskVolumeStackedBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  const option = useMemo<VolumeStackedOption>(() => {
    const colors = THEME_COLORS[resolvedTheme]
    return {
      aria: { enabled: true, label: { description: ariaDescription }, decal: { show: true } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        textStyle: { color: colors.secondary },
        // 悬浮数值保留千分位（格式化由页面注入，单位语义在 y 轴名称中）；
        // value 签名随 echarts 类型为宽联合，内部按数值处理
        valueFormatter: (value: unknown) => (typeof value === 'number' ? formatValue(value) : '-'),
      },
      legend: {
        bottom: 0,
        data: [completedName, failedName, canceledName],
        textStyle: { color: colors.secondary },
      },
      // top 需容纳 y 轴名称（nameGap 15 + 文字高 12），过小会贴近画布顶边
      grid: { left: 52, right: 16, top: 36, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        // 桶日期 YYYY-MM-DD 与语言无关（日期值不翻译，规格 18.4）
        data: data.map((point) => point.date),
        axisLabel: { color: colors.secondary, fontSize: 11, hideOverlap: true },
        axisLine: { lineStyle: { color: colors.splitLine } },
      },
      yAxis: {
        type: 'value',
        // 数量单位（个）标注在数值轴上方
        name: valueAxisName,
        nameTextStyle: { color: colors.secondary },
        axisLabel: { color: colors.secondary },
        splitLine: { lineStyle: { color: colors.splitLine } },
      },
      series: [
        {
          name: completedName,
          type: 'bar' as const,
          stack: 'total',
          itemStyle: { color: COMPLETED_COLOR },
          data: data.map((point) => point.completedCount),
        },
        {
          name: failedName,
          type: 'bar' as const,
          stack: 'total',
          itemStyle: { color: FAILED_COLOR },
          data: data.map((point) => point.failedCount),
        },
        {
          name: canceledName,
          type: 'bar' as const,
          stack: 'total',
          itemStyle: { color: CANCELED_COLOR },
          data: data.map((point) => point.canceledCount),
        },
      ],
    }
  }, [data, ariaDescription, completedName, failedName, canceledName, valueAxisName, formatValue, resolvedTheme])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // init 与 setOption 同 effect：数据/主题/语言变化即整体重建（notMerge 清旧系列）
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

  return <div ref={containerRef} className={styles.standardChart} />
}
