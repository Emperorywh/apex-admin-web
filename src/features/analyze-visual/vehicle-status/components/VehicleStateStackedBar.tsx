/**
 * 车辆 × 状态 时长堆叠柱（P37 私有；旧 VehicleStateStackedBar 等价迁移）。
 *
 * 视图语义（旧实现逐项等价）：
 * - 每辆车一根柱，按状态堆叠（小时），状态顺序固定为枚举语义顺序，
 *   系列只为「本次数据中出现过的状态」建立，颜色取状态固定语义映射
 *   （颜色跟随状态实体，不随数据排名变化）；
 * - 默认展示全部车辆；底部滑块可缩放/平移查看局部车辆，Ctrl+滚轮缩放；
 *   百车以上关闭过渡动画，保留所有车辆与状态数据，不截断不抽样；
 * - Tooltip 逐状态展示人性化时长（车辆名与状态名 HTML 转义，时长保留
 *   原始秒数精度换算，不提前四舍五入——短时状态不会变成零而消失）；
 * - x 轴长车名保留开头和末尾（前 4 … 后 5），避免相同前缀遮住区分编号。
 *
 * 生命周期纪律（DoD14，P36 FaultTrendChart 同款）：echarts 按需注册，
 * 实例随组件卸载 dispose；ResizeObserver 跟随容器尺寸；数据/主题/语言任一
 * 变化整体 setOption(option, notMerge=true) 重建，不残留旧系列。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { BarSeriesOption, ComposeOption } from 'echarts'
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { BarChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { format } from 'echarts/core'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { stateColor, stateLabelKey, VEHICLE_STATISTIC_STATE_ORDER } from '@/features/analyze-visual/vehicle-status/states'
import type { VehicleDurationGroup } from '@/features/analyze-visual/vehicle-status/selectors'
import styles from '@/features/analyze-visual/vehicle-status/components/VehicleChart.module.css'

/* 按需注册：本图需要柱状系列 + 坐标轴/图例/提示/缩放组件（不引入完整 echarts 包） */
echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
])

/** 声明本图实际使用的组件，缩放配置与按需注册保持一致（旧实现同款精确类型） */
type StackedBarOption = ComposeOption<
  | BarSeriesOption
  | AriaComponentOption
  | DataZoomComponentOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
>

/** 主题配色（canvas 无法消费 CSS 变量，P33/P34/P36 同款双主题色表） */
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

interface VehicleStateStackedBarProps {
  /** 按车辆分组的时长聚合（selectors.groupByVehicle 产物，秒） */
  data: VehicleDurationGroup[]
  /** aria 可访问描述（已本地化；读屏用途，旧实现同款） */
  ariaDescription: string
  /**
   * 时长格式化函数（秒 → 人性化文案；由页面层注入 features/dashboard 的
   * formatDurationMs——features 业务域之间不得互相导入，结构检查规则 3）。
   */
  formatDuration: (seconds: number) => string
}

export function VehicleStateStackedBar({ data, ariaDescription, formatDuration }: VehicleStateStackedBarProps) {
  const { t } = useTranslation('report-vehicle-state')
  const resolvedTheme = useTheme()

  // 本次数据中实际出现过的状态（保持枚举语义顺序），只为出现过的状态建系列
  const presentStates = useMemo(
    () =>
      VEHICLE_STATISTIC_STATE_ORDER.filter((state) =>
        data.some((group) => (group.stateSeconds[state] ?? 0) > 0),
      ),
    [data],
  )

  const option = useMemo<StackedBarOption>(() => {
    const colors = THEME_COLORS[resolvedTheme]
    /*
     * 缩放后的标签索引从可见范围重新计数，不能用它访问原始数组。
     * 按唯一车辆标识查找名称，保证平移后标签始终对应当前柱体。
     */
    const vehicleNames = new Map(data.map((group) => [group.vehicleKey, group.vehicleName]))
    return {
      aria: { enabled: true, label: { description: ariaDescription }, decal: { show: true } },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        textStyle: { color: colors.primary },
        extraCssText: 'max-width: min(360px, 80vw); white-space: normal; overflow-wrap: anywhere;',
        /*
         * 根据数据索引读取完整车名，重名车辆也能分别展示。
         * 外部文本转义后插入提示框，时长由原始秒数换算（×1000 进 formatDurationMs）。
         */
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [params]
          const first = items[0] as { dataIndex?: number } | undefined
          const group = first?.dataIndex !== undefined ? data[first.dataIndex] : undefined
          if (!group) return ''
          const lines = (items as { marker?: string; seriesName?: string; value?: number }[]).map(
            (p) =>
              `${p.marker ?? ''}${format.encodeHTML(p.seriesName ?? '')}: ${formatDuration(p.value ?? 0)}`,
          )
          return [format.encodeHTML(group.vehicleName), ...lines].join('<br/>')
        },
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        data: presentStates.map((s) => t(stateLabelKey(s))),
        textStyle: { color: colors.secondary },
      },
      /*
       * 分别为轴标签、缩放条和图例预留空间，不让长车名参与无限扩张。
       * 默认全量展示，缩放条两端可调节范围，中间区域可拖动浏览。
       */
      grid: { left: 12, right: 20, top: 36, bottom: 100, containLabel: true },
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          start: 0,
          end: 100,
          minValueSpan: Math.min(4, Math.max(0, data.length - 1)),
          bottom: 40,
          height: 24,
          showDetail: false,
          brushSelect: false,
          borderColor: colors.splitLine,
          textStyle: { color: colors.secondary },
          filterMode: 'filter',
          throttle: 80,
        },
        {
          type: 'inside',
          xAxisIndex: 0,
          zoomOnMouseWheel: 'ctrl',
          moveOnMouseWheel: false,
          moveOnMouseMove: true,
          filterMode: 'filter',
          throttle: 80,
        },
      ],
      xAxis: {
        type: 'category',
        /*
         * 使用唯一标识作为类目，避免同名车辆在缩放定位时混淆。
         * 标签自动间隔并截断，完整名称通过悬浮提示查看。
         */
        data: data.map((group) => group.vehicleKey),
        axisLabel: {
          color: colors.secondary,
          fontSize: 11,
          interval: 'auto',
          hideOverlap: true,
          width: 112,
          overflow: 'truncate',
          rotate: 0,
          margin: 12,
          /*
           * 长车名保留开头和末尾，避免相同前缀遮住用于区分车辆的编号。
           * 先缩短文本再交给自动间隔计算，使缩放后能显示更多有效标签。
           */
          formatter: (value: string) => {
            const name = vehicleNames.get(value) ?? value
            const characters = Array.from(name)
            return characters.length > 10
              ? `${characters.slice(0, 4).join('')}…${characters.slice(-5).join('')}`
              : name
          },
        },
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: colors.splitLine } },
      },
      yAxis: {
        type: 'value',
        // 指标名称 + 单位（小时），与明细表「时长（小时）」列口径一致
        name: t('时长（小时）'),
        // 单位文字跟随主题，保证深色背景下仍清晰可读
        nameTextStyle: { color: colors.secondary },
        // 数值轴保持较少分段，为全量车辆提供稳定的比较基准
        splitNumber: 4,
        axisLabel: { color: colors.secondary },
        splitLine: { lineStyle: { color: colors.splitLine } },
      },
      series: presentStates.map((state) => ({
        name: t(stateLabelKey(state)),
        type: 'bar' as const,
        stack: 'total',
        barMaxWidth: 36,
        barCategoryGap: '25%',
        itemStyle: { color: stateColor(state) },
        emphasis: { focus: 'series' },
        /*
         * 小时数不提前四舍五入，避免短时状态变成零而消失。
         * 提示框负责时长格式化，柱体保持原始数值比例。
         */
        data: data.map((group) => (group.stateSeconds[state] ?? 0) / 3600),
      })),
    }
    // 动画开关随数据规模变化（百车以上关闭过渡），一并纳入依赖
  }, [data, presentStates, t, resolvedTheme, ariaDescription, formatDuration])

  const containerRef = useRef<HTMLDivElement>(null)

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

  /*
   * 提供真实内容高度（旧实现 460px 等价），避免绝对定位子节点使面板收缩。
   * 百车全景下仍为柱体保留足够高度，宽度随面板自适应。
   */
  return <div ref={containerRef} className={styles.stackedBar} />
}
