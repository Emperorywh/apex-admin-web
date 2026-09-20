/**
 * 单机故障排行 TOP10 横向柱图（P36 私有；旧 VehicleFaultRankBar 等价迁移）：
 * y 轴为车辆展示名（倒序，第一名在顶部），x 轴为告警次数（带单位轴名），
 * 柱端右侧标注数值。数据已由 statistics.ts 稳定排序（次数降序、同名升序），
 * 接口仅下发窗口最后一天（topAgvDate）的 Top10，标题由页面标注对应日期。
 *
 * 生命周期纪律（DoD14，P33 StatisticsBarChart 同款）：按需注册、卸载 dispose、
 * ResizeObserver 自适应、数据/主题/语言变化整体重建。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { BarChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import type { VehicleFaultRankItem } from '@/features/analyze-visual/fault-alert/statistics'
import styles from '@/features/analyze-visual/fault-alert/components/FaultChart.module.css'

/* 按需注册：本图仅横向柱状图 + 基础组件 */
echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
])

/** 主题配色（canvas 无法消费 CSS 变量，与趋势图共用一套双主题色表） */
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

/** 排行柱取警示橙（旧 warningColor 等价） */
const RANK_BAR_COLOR = '#F6BD16'

interface VehicleFaultRankChartProps {
  /** 排行数据（已稳定排序；展示名优先 vehicleName 回退 vehicleKey） */
  data: VehicleFaultRankItem[]
  /** x 轴名称 / 系列名（已本地化：「故障次数（次）」） */
  seriesName: string
}

export function VehicleFaultRankChart({ data, seriesName }: VehicleFaultRankChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  const option = useMemo(
    () => {
      const colors = THEME_COLORS[resolvedTheme]
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
        },
        // 左侧留展示名宽度，底部留轴名空间（旧 grid 同款尺寸）
        grid: { left: 70, right: 40, top: 16, bottom: 46, containLabel: true },
        xAxis: {
          type: 'value',
          // 数值轴标注指标名称与单位，居中置于轴下方
          name: seriesName,
          nameLocation: 'middle',
          nameGap: 26,
          nameTextStyle: { color: colors.secondary },
          axisLabel: { color: colors.secondary },
          splitLine: { lineStyle: { color: colors.splitLine, type: 'dashed' } },
        },
        yAxis: {
          type: 'category',
          // inverse：数据首行（第一名）显示在顶部
          inverse: true,
          data: data.map((item) => item.displayName),
          axisLabel: { color: colors.secondary },
          axisLine: { lineStyle: { color: colors.splitLine } },
          axisTick: { show: false },
        },
        series: [
          {
            name: seriesName,
            type: 'bar',
            barMaxWidth: 18,
            itemStyle: { color: RANK_BAR_COLOR, borderRadius: [0, 4, 4, 0] },
            // 柱端右侧标注数值（旧实现同款；0 值也标注，排行行必有权次）
            label: { show: true, position: 'right', color: colors.secondary },
            data: data.map((item) => item.faultCount),
          },
        ],
      }
    },
    [data, seriesName, resolvedTheme],
  )

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

  return <div ref={containerRef} className={styles.chart} />
}
