/**
 * 今日任务完成趋势双折线（P34 私有组件；旧 RealtimeDashboard/charts/TodayTaskTrendLine
 * 等价迁移，echarts 按需注册）。
 *
 * 与旧实现的对应与差异：
 * - 今日实线（带淡面积）vs 昨日虚线、平滑、圆点标记、图例在底部逐项同构；
 * - 横轴仅展示至今日当前小时的整点桶（同时刻公平对比），标签 `MM-DD HH:00`；
 * - 悬浮数值千分位 + 单位「个」，Y 轴名称「任务数量（个）」（已翻译传入）；
 * - 主题来源 useTheme，切换整体重建；主题系列色与状态图对齐（今日=蓝、昨日=灰）。
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { LineChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import type { RealtimeSnapshot } from '@/features/dashboard/realtime'
import chartStyles from '@/features/dashboard/components/chart.module.css'

/* 按需注册：本图仅折线 + 网格/提示/图例组件 */
echarts.use([
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
])

/** 文本与系列色（亮/暗；今日=蓝主色、昨日=次要灰虚线） */
const THEME = {
  light: {
    primary: '#101728',
    secondary: '#5f6b80',
    splitLine: '#e3e8f2',
    today: '#1f6ef5',
    yesterday: '#7d879b',
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipBorder: '#e5e7eb',
  },
  dark: {
    primary: '#f2f5fd',
    secondary: '#8b97ad',
    splitLine: '#374151',
    today: '#4c8dff',
    yesterday: '#8b97ad',
    tooltipBg: 'rgba(30,30,30,0.95)',
    tooltipBorder: '#4b5563',
  },
} as const

interface TodayTrendLineProps {
  /** 今日 vs 昨日小时对比点（截至当前小时） */
  data: RealtimeSnapshot['todayTaskTrend']
  /** 已翻译文案：今日/昨日系列名、Y 轴名称、悬浮单位后缀 */
  todayLabel: string
  yesterdayLabel: string
  yAxisName: string
  unitSuffix: string
}

export function TodayTrendLine({
  data,
  todayLabel,
  yesterdayLabel,
  yAxisName,
  unitSuffix,
}: TodayTrendLineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = echarts.init(container)
    const colors = THEME[resolvedTheme]

    chart.setOption(
      {
        tooltip: {
          trigger: 'axis',
          backgroundColor: colors.tooltipBg,
          borderColor: colors.tooltipBorder,
          textStyle: { color: colors.primary },
          // 千分位 + 单位（个）：与旧 valueFormatter 同语义
          valueFormatter: (value: unknown) =>
            `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value))} ${unitSuffix}`,
        },
        legend: {
          bottom: 0,
          icon: 'roundRect',
          itemWidth: 14,
          itemHeight: 10,
          data: [todayLabel, yesterdayLabel],
          textStyle: { color: colors.secondary },
        },
        // top 需容纳 Y 轴名称（旧实现同款留白），bottom 容纳图例
        grid: { left: 52, right: 16, top: 36, bottom: 40 },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: data.map((point) => point.label),
          axisLabel: { color: colors.secondary, fontSize: 11 },
          axisLine: { lineStyle: { color: colors.splitLine } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          name: yAxisName,
          nameTextStyle: { color: colors.secondary },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: colors.secondary },
          splitLine: { lineStyle: { color: colors.splitLine } },
        },
        series: [
          {
            name: todayLabel,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            data: data.map((point) => point.todayCompleted),
            itemStyle: { color: colors.today },
            lineStyle: { color: colors.today, width: 2 },
            areaStyle: { opacity: 0.08, color: colors.today },
          },
          {
            name: yesterdayLabel,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            data: data.map((point) => point.yesterdayCompleted),
            itemStyle: { color: colors.yesterday },
            lineStyle: { color: colors.yesterday, width: 2, type: 'dashed' },
          },
        ],
      },
      // notMerge=true：整体替换，语言/数据切换后不残留旧系列
      true,
    )

    const observer = new ResizeObserver(() => {
      chart.resize()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      // 卸载即释放实例（Activity 页签隐藏即释放，不残留 canvas 与事件）
      chart.dispose()
    }
  }, [data, todayLabel, yesterdayLabel, yAxisName, unitSuffix, resolvedTheme])

  return <div ref={containerRef} className={chartStyles.fill} />
}
