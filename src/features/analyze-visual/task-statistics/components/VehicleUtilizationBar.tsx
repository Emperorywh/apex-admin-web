/**
 * 车辆利用率排行横向柱（P35 私有；旧 VehicleUtilizationBar 等价迁移）。
 *
 * 视图语义（旧实现逐项等价）：
 * - 降序排列；颜色按利用率阈值：<50% 红、50%–<70% 黄、≥70% 绿（旧
 *   UTILIZATION_THRESHOLDS 等价保留），不可计算（null）灰色——与真实 0 可区分；
 * - 固定可视窗口最多 10 辆车，超出部分经纵向滑块/滚轮平移浏览（zoomLock
 *   锁定窗口大小，滚动不重新堆叠全部标签）；百车以上关闭过渡动画；
 * - y 轴类目使用排行索引（避免相同显示名称合并或定位混淆），长车名保留
 *   首 7 末 8 字符截断，完整名称经 HTML 转义进入悬浮提示；
 * - x 轴 0–100% 百分比；每条柱右端独立显示百分比数值（碰撞自动隐藏）；
 *   不可计算项柱体按 0 长度绘制但悬浮显示「--」（null ≠ 真实 0）。
 *
 * 生命周期纪律同 P33/P36/P37：按需注册、卸载 dispose、尺寸自适应、
 * 数据/主题/语言变化整体重建。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { BarSeriesOption, ComposeOption } from 'echarts'
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { DataZoomComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { BarChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { format } from 'echarts/core'
import { useTheme } from '@/hooks/useTheme'
import type { VehicleUtilizationItem } from '@/features/analyze-visual/task-statistics/statistics'
import styles from '@/features/analyze-visual/task-statistics/components/TaskChart.module.css'

/* 按需注册：本图需要柱状系列 + 坐标轴/提示/纵向缩放组件（不引入完整 echarts 包） */
echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
])

type UtilizationRankOption = ComposeOption<
  | BarSeriesOption
  | AriaComponentOption
  | DataZoomComponentOption
  | GridComponentOption
  | TooltipComponentOption
>

const THEME_COLORS = {
  light: {
    secondary: '#5f6b80',
    splitLine: '#e3e8f2',
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipBorder: '#e5e7eb',
    /** 不可计算（null）柱色：中性灰（旧 token.colorTextQuaternary 等价） */
    notComputable: '#A8B3C5',
    sliderFiller: 'rgba(91,143,249,0.18)',
  },
  dark: {
    secondary: '#8b97ad',
    splitLine: '#374151',
    tooltipBg: 'rgba(30,30,30,0.95)',
    tooltipBorder: '#4b5563',
    notComputable: '#5D6879',
    sliderFiller: 'rgba(91,143,249,0.3)',
  },
} as const

/** 利用率阈值色：<50% 红 / 50%–<70% 黄 / ≥70% 绿（旧 policy 阈值等价保留） */
const UTILIZATION_LOW = 0.5
const UTILIZATION_HIGH = 0.7
const COLOR_LOW = '#E86452'
const COLOR_MIDDLE = '#F6BD16'
const COLOR_HIGH = '#5AD8A6'

/** 固定可视窗口车辆数：每行预留独立柱体与数值空间，其余经滑块浏览 */
const VISIBLE_VEHICLE_COUNT = 10

/** 按利用率映射柱色；null（不可计算）用中性灰，区别于真实 0% */
function utilizationColor(ratio: number | null, notComputable: string): string {
  if (ratio === null || Number.isNaN(ratio)) return notComputable
  if (ratio < UTILIZATION_LOW) return COLOR_LOW
  if (ratio < UTILIZATION_HIGH) return COLOR_MIDDLE
  return COLOR_HIGH
}

interface VehicleUtilizationBarProps {
  /** 排行数据（降序在组件内排序；utilization null = 不可计算） */
  data: VehicleUtilizationItem[]
  /** aria 可访问描述（已本地化） */
  ariaDescription: string
  /** 利用率文案（悬浮提示用，已本地化） */
  utilizationLabel: string
  /** 百分比格式化（页面注入 Intl；null 传入返回「--」占位） */
  formatRatio: (ratio: number | null) => string
}

/** 车辆利用率排行横向柱（降序 + 阈值色 + 纵向滚动浏览） */
export function VehicleUtilizationBar({
  data,
  ariaDescription,
  utilizationLabel,
  formatRatio,
}: VehicleUtilizationBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  const sorted = useMemo(
    () => [...data].sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0)),
    [data],
  )

  const option = useMemo<UtilizationRankOption>(() => {
    const colors = THEME_COLORS[resolvedTheme]
    const scrollable = sorted.length > VISIBLE_VEHICLE_COUNT
    return {
      /*
       * 单系列排行使用纯色柱体，避免密集纹理干扰数值阅读。
       * 保留无障碍描述，百车以上关闭动画以降低滚动绘制开销。
       */
      animation: sorted.length <= 100,
      aria: { enabled: true, label: { description: ariaDescription }, decal: { show: false } },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        textStyle: { color: colors.secondary },
        extraCssText: 'max-width: min(360px, 80vw); white-space: normal; overflow-wrap: anywhere;',
        /*
         * 按原始数据索引获取完整车名，滚动及重名时仍对应正确车辆。
         * 车名经过转义再进入提示框；缺失利用率显示「--」，区别于实际零值。
         */
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : (params as { dataIndex?: number })
          const vehicle = item?.dataIndex !== undefined ? sorted[item.dataIndex] : undefined
          if (!vehicle) return ''
          return `${format.encodeHTML(vehicle.vehicleName)}<br/>${utilizationLabel}: ${formatRatio(vehicle.utilization)}`
        },
      },
      /*
       * 车名、百分比和滑块各自预留空间，绘图区不再被长车名挤压。
       * 滑块锁定窗口大小，保证滚动到任意位置都不会重新堆叠全部标签。
       */
      grid: { left: 156, right: scrollable ? 80 : 60, top: 12, bottom: 32 },
      dataZoom: scrollable
        ? [
            {
              type: 'slider',
              yAxisIndex: 0,
              startValue: 0,
              endValue: VISIBLE_VEHICLE_COUNT - 1,
              zoomLock: true,
              right: 4,
              top: 12,
              bottom: 32,
              width: 12,
              showDetail: false,
              showDataShadow: false,
              brushSelect: false,
              borderColor: colors.splitLine,
              fillerColor: colors.sliderFiller,
              filterMode: 'filter',
              throttle: 80,
            },
            {
              type: 'inside',
              yAxisIndex: 0,
              startValue: 0,
              endValue: VISIBLE_VEHICLE_COUNT - 1,
              zoomLock: true,
              zoomOnMouseWheel: false,
              moveOnMouseWheel: true,
              moveOnMouseMove: true,
              filterMode: 'filter',
              throttle: 80,
            },
          ]
        : [],
      xAxis: {
        type: 'value',
        max: 1,
        axisLabel: {
          color: colors.secondary,
          formatter: (value: number) => `${Math.round(value * 100)}%`,
        },
        splitLine: { lineStyle: { color: colors.splitLine } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        /*
         * 类目使用排行索引，避免相同显示名称合并或定位混淆。
         * 长名称保留首尾以区分车辆，完整名称留在悬浮提示中。
         */
        data: sorted.map((_vehicle, index) => String(index)),
        axisLabel: {
          color: colors.secondary,
          interval: 0,
          width: 140,
          overflow: 'truncate',
          margin: 12,
          formatter: (value: string) => {
            const name = sorted[Number(value)]?.vehicleName ?? value
            const characters = Array.from(name)
            return characters.length > 16
              ? `${characters.slice(0, 7).join('')}…${characters.slice(-8).join('')}`
              : name
          },
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar' as const,
          data: sorted.map((item) => ({
            // 不可计算按 0 长度绘制（灰色），真实数值只在悬浮提示呈现
            value: item.utilization ?? 0,
            itemStyle: { color: utilizationColor(item.utilization, colors.notComputable) },
          })),
          barMaxWidth: 18,
          /*
           * 每个可见条形独立显示数值，并为极端窄容器启用碰撞隐藏。
           * 柱体按原始比例绘制，数值格式化复用报表统一规则。
           */
          labelLayout: { hideOverlap: true },
          label: {
            show: true,
            position: 'right',
            distance: 8,
            formatter: (params: { dataIndex: number }) =>
              formatRatio(sorted[params.dataIndex]?.utilization ?? null),
            color: colors.secondary,
          },
        },
      ],
    }
  }, [sorted, resolvedTheme, ariaDescription, utilizationLabel, formatRatio])

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

  return <div ref={containerRef} className={styles.utilizationRankChart} />
}
