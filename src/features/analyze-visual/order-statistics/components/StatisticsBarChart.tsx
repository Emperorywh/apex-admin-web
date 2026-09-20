/**
 * 统计柱状图（P33 私有组件；echarts 按需注册，规格 11.2「旧图表可继续使用兼容的
 * ECharts，按需注册、释放实例并适应页签显示/隐藏」）。
 *
 * 与旧实现 QuantityBar/EfficiencyBar 的对应关系：
 * - 柱状图形态（柱宽上限/圆角/柱顶数值标签/底部图例/虚线网格）逐项同构；
 * - 差异一：标题移出 echarts 由 React 层渲染（承载口径提示图标，参考旧
 *   SPEC_metric_calculation_hint 的 ChartPanel 结构），echarts 只负责绘图区；
 * - 差异二：主题来源从 localStorage 轮询改为 Redux 三态主题解析（useTheme），
 *   跟随系统/深浅切换时 setOption 重建配色（DoD11：语言/主题动态重建，不刷新整页）。
 *
 * 生命周期纪律（DoD14）：实例随组件卸载 dispose（Activity 页签隐藏即释放、
 * 恢复可见重建，后台不占 canvas 资源）；ResizeObserver 跟随容器尺寸自适应；
 * 数据/主题/语言任一变化整体 setOption(option, notMerge=true) 重建，不残留旧系列。
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { BarChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import styles from '@/features/analyze-visual/order-statistics/components/StatisticsBarChart.module.css'

/* 按需注册：本页仅柱状图 + 基础组件（不引入完整 echarts 包） */
echarts.use([
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
])

/** 主题配色（旧实现 getThemeColors 色板等价迁移：echarts canvas 无法消费 CSS 变量） */
const THEME_COLORS = {
  light: {
    primary: '#1f2937',
    secondary: '#4b5563',
    splitLine: '#f0f0f0',
    axisLine: '#d1d5db',
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipBorder: '#e5e7eb',
    legendText: '#4b5563',
    nameText: '#6b7280',
  },
  dark: {
    primary: '#ffffff',
    secondary: '#9ca3af',
    splitLine: '#374151',
    axisLine: '#4b5563',
    tooltipBg: 'rgba(30,30,30,0.95)',
    tooltipBorder: '#4b5563',
    legendText: '#d1d5db',
    nameText: '#9ca3af',
  },
} as const

/** 柱色板：数量统计 8 色循环（旧 CHART_COLORS）；效率统计取前 3 色（旧 EFFICIENCY_COLORS）。
 *  模块内常量不导出（fast-refresh 纪律：组件文件只导出组件） */
const BAR_CHART_COLORS = ['#5B8FF9', '#5AD8A6', '#F6BD16', '#E86452', '#6DC8EC', '#945FB9', '#FF9845', '#5D7092']

interface StatisticsBarChartProps {
  /** x 轴类目（已翻译；语言切换时由调用方重建触发重绘） */
  categories: string[]
  /** 各类目数值（与 categories 等长） */
  values: number[]
  /** 系列名（图例/悬浮，已翻译） */
  seriesName: string
  /** y 轴名称（如「时间（秒）」；不传则不显示） */
  yAxisName?: string
  /** 柱顶/悬浮数值 → 展示文本（数量图传整数千分位串，效率图传秒转时长） */
  formatValue: (value: number) => string
  /** 主题色板循环起点（默认全色板循环；效率图传 3 收敛为旧 3 色板） */
  colorCount?: number
}

export function StatisticsBarChart({
  categories,
  values,
  seriesName,
  yAxisName,
  formatValue,
  colorCount = BAR_CHART_COLORS.length,
}: StatisticsBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // resolved 为 light/dark 具体值（system 已解析）；切换时经 effect 重建配色
  const resolvedTheme = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // init 与 setOption 同 effect：数据/主题/语言变化即整体重建（notMerge 清旧系列）
    const chart = echarts.init(container)
    const colors = THEME_COLORS[resolvedTheme]
    const palette = BAR_CHART_COLORS.slice(0, Math.max(1, Math.min(colorCount, BAR_CHART_COLORS.length)))

    chart.setOption(
      {
        color: palette,
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: colors.tooltipBg,
          borderColor: colors.tooltipBorder,
          textStyle: { color: colors.primary },
          // 悬浮数值走调用方格式化（数量=计数；效率=秒转时长，旧 valueFormatter 同语义）；
          // 参数接受 unknown（echarts OptionDataValue 的超集，逆变安全）
          valueFormatter: (value: unknown) => formatValue(Number(value)),
        },
        legend: {
          bottom: 0,
          left: 'center',
          icon: 'roundRect',
          itemWidth: 14,
          itemHeight: 10,
          textStyle: { color: colors.legendText },
        },
        grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
        xAxis: {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: colors.axisLine } },
          axisTick: { show: false },
          axisLabel: { color: colors.secondary },
        },
        yAxis: {
          type: 'value',
          name: yAxisName,
          nameTextStyle: { color: colors.nameText },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: colors.secondary },
          splitLine: { lineStyle: { color: colors.splitLine, type: 'dashed' } },
        },
        series: [
          {
            name: seriesName,
            type: 'bar',
            barMaxWidth: 80,
            barGap: '20%',
            barCategoryGap: '40%',
            emphasis: { focus: 'series' },
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              // 逐柱取色（旧实现按 dataIndex 循环色板同语义：数量图 8 色循环、
              // 效率图 3 色循环，视觉等价——单系列默认会全部同色）
              color: (params: { dataIndex: number }) =>
                palette[params.dataIndex % palette.length],
            },
            label: {
              show: true,
              position: 'top',
              // 旧实现 label formatter：0 值不显示标签（val ? text : ''），等价保留；
              // 结构化参数类型（value 必有）逆变兼容 echarts 回调签名
              formatter: (params: { value: unknown }) => {
                const value = Number(params.value)
                return value ? formatValue(value) : ''
              },
              fontSize: 12,
              color: colors.primary,
            },
            data: values,
          },
        ],
      },
      // notMerge=true：整体替换，语言/数据切换后不残留上一个系列的图例
      true,
    )

    // 容器尺寸自适应（旧实现 ResizeObserver resize 同语义；页签隐藏宽度归零后
    // 恢复可见会再次触发，图表自动恢复绘制）
    const observer = new ResizeObserver(() => {
      chart.resize()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      // 卸载即释放实例（Activity 隐藏/组件销毁统一走这里，不残留 canvas 与事件）
      chart.dispose()
    }
  }, [categories, values, seriesName, yAxisName, formatValue, colorCount, resolvedTheme])

  return <div ref={containerRef} className={styles.chart} />
}
