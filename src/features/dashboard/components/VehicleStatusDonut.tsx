/**
 * AGV 状态分布环形图（P34 私有组件；旧 RealtimeDashboard/charts/VehicleStatusPie
 * 等价迁移，echarts 按需注册——规格 11.2「按需注册、释放实例并适应页签显示/隐藏」）。
 *
 * 与旧实现的对应与差异：
 * - 环形形态（radius/center/图例在底部/悬浮单位「台」/中心在线数富文本）逐项同构；
 * - 全部 5 类状态固定进图例（含 0 值：0 值不渲染扇区但图例保留完整状态口径）；
 * - 主题来源为 Redux 三态解析 useTheme（P33 StatisticsBarChart 同款），切换主题时
 *   setOption 整体重建配色；canvas 无法消费 CSS 变量，状态语义色按主题给 hex。
 *
 * 生命周期纪律（DoD14）：实例随组件卸载 dispose；ResizeObserver 跟随容器；
 * 数据/主题/语言任一变化整体 setOption(notMerge) 重建，不残留旧系列。
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { PieChart } from 'echarts/charts'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/hooks/useTheme'
import type { RealtimeSnapshot, VehicleStatusKey } from '@/features/dashboard/realtime'
import { VEHICLE_STATUS_ORDER } from '@/features/dashboard/realtime'
import chartStyles from '@/features/dashboard/components/chart.module.css'

/* 按需注册：本图仅饼图 + 提示/图例组件（不引入完整 echarts 包） */
echarts.use([PieChart, TooltipComponent, LegendComponent, LabelLayout, CanvasRenderer])

/** 状态语义色（canvas 无法消费 CSS 变量；亮/暗两套与 globals.css 语义色对齐） */
const STATUS_COLORS: Record<VehicleStatusKey, { light: string; dark: string }> = {
  running: { light: '#0f9f58', dark: '#2fbf74' }, // 运行 = 绿（--app-green）
  idle: { light: '#1f6ef5', dark: '#4c8dff' }, // 空闲 = 蓝（--app-blue）
  charging: { light: '#e8860c', dark: '#f0a13c' }, // 充电 = 橙（--app-orange）
  fault: { light: '#e5484d', dark: '#f2555a' }, // 故障 = 红（--app-red）
  offline: { light: '#7d879b', dark: '#8b97ad' }, // 离线 = 次要灰（--app-text-4）
}

/** 文本色（亮/暗） */
const TEXT_COLORS = {
  light: { primary: '#101728', secondary: '#5f6b80' },
  dark: { primary: '#f2f5fd', secondary: '#8b97ad' },
} as const

interface VehicleStatusDonutProps {
  /** 五类状态计数（固定顺序，0 值保留） */
  data: RealtimeSnapshot['vehicleStatus']
  /** 中心展示的在线数（运行+空闲+充电+故障，旧口径） */
  onlineCount: number
  /** 各状态已翻译名称（key → 文案；语言切换由调用方重建触发重绘） */
  labels: Record<VehicleStatusKey, string>
  /** 中心在线数下方的单位说明（已翻译，如「在线 AGV（台）」） */
  centerLabel: string
  /** 悬浮数量单位后缀（已翻译，如「台」） */
  unitSuffix: string
}

export function VehicleStatusDonut({
  data,
  onlineCount,
  labels,
  centerLabel,
  unitSuffix,
}: VehicleStatusDonutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedTheme = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = echarts.init(container)
    const themeKey = resolvedTheme
    const text = TEXT_COLORS[themeKey]

    // 全部 5 类状态固定进数据（0 值不渲染扇区但图例保留完整口径）
    const seriesData = VEHICLE_STATUS_ORDER.map((status) => {
      const item = data.find((entry) => entry.status === status)
      return {
        name: labels[status],
        value: item?.count ?? 0,
        itemStyle: { color: STATUS_COLORS[status][themeKey] },
      }
    })

    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          backgroundColor: themeKey === 'dark' ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
          borderColor: themeKey === 'dark' ? '#4b5563' : '#e5e7eb',
          textStyle: { color: text.primary },
          // 数量单位（台）：与旧实现 valueFormatter 同语义
          valueFormatter: (value: unknown) => `${Number(value)} ${unitSuffix}`,
        },
        legend: {
          bottom: 0,
          icon: 'roundRect',
          itemWidth: 14,
          itemHeight: 10,
          // 显式指定图例项：只列五个状态，排除中心文字占位系列（name:'center'）
          // 泄漏进图例（首轮截图实测缺陷；旧实现同款排除）
          data: seriesData.map((entry) => entry.name),
          textStyle: { color: text.secondary },
        },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: true,
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 14, fontWeight: 700, color: text.primary },
            },
            data: seriesData,
          },
          {
            // 中心文字：在线数（旧 VehicleStatusPie 同款双系列方案）
            type: 'pie',
            silent: true,
            radius: ['0%', '0%'],
            center: ['50%', '45%'],
            label: {
              show: true,
              position: 'center',
              formatter: () => `{a|${onlineCount}}\n{b|${centerLabel}}`,
              rich: {
                a: { fontSize: 28, fontWeight: 700, color: text.primary, lineHeight: 34 },
                b: { fontSize: 12, color: text.secondary, lineHeight: 16 },
              },
            },
            data: [{ value: 1, name: 'center' }],
          },
        ],
      },
      // notMerge=true：整体替换，语言/数据切换后不残留上一个图例项
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
  }, [data, onlineCount, labels, centerLabel, unitSuffix, resolvedTheme])

  return <div ref={containerRef} className={chartStyles.fill} />
}
