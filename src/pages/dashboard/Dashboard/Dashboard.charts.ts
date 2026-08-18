/**
 * Dashboard 图表 option 构建（规格 §14.2/§15）：输入 DashboardOverview 与来自
 * antd token 的图表主题，输出 echarts/core 的 EChartsCoreOption。
 * 颜色全部取自 token（规格 §10.2/§15），本文件不出现色值字面量；
 * 纯函数便于同目录测试，仅被 Dashboard 页面消费。
 */
import type { EChartsCoreOption } from 'echarts/core'
import type { GlobalToken } from 'antd'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'

/** 图表主题：由 Dashboard 页面从 theme.useToken() 提取，窄结构保持本文件可独立测试 */
export interface DashboardChartTheme {
  colorPrimary: string
  colorSuccess: string
  colorWarning: string
  colorInfo: string
  colorError: string
  colorText: string
  colorTextDescription: string
  colorBorderSecondary: string
  colorBgContainer: string
}

/** 从 antd token 提取图表主题（Dashboard 页面唯一调用方） */
export function buildDashboardChartTheme(token: Pick<GlobalToken, keyof DashboardChartTheme>): DashboardChartTheme {
  return {
    colorPrimary: token.colorPrimary,
    colorSuccess: token.colorSuccess,
    colorWarning: token.colorWarning,
    colorInfo: token.colorInfo,
    colorError: token.colorError,
    colorText: token.colorText,
    colorTextDescription: token.colorTextDescription,
    colorBorderSecondary: token.colorBorderSecondary,
    colorBgContainer: token.colorBgContainer,
  }
}

/** 类目轴图表（折线/柱形）共用网格边距（像素）：containLabel 使轴标签不计入边距 */
const CATEGORY_GRID = { left: 8, right: 16, top: 32, bottom: 8, containLabel: true } as const

/** 环形图内外半径（相对容器百分比）：形成 donut 形态（规格 §14.2 饼/环） */
const DONUT_RADIUS = ['45%', '70%'] as const

/** 柱形最大宽度（像素）：数据量少时避免柱体过宽 */
const BAR_MAX_WIDTH = 28

/** 角色分布取色环：按序循环取用 token 扩展色，扇区数超出时从头循环 */
const DISTRIBUTION_PALETTE_KEYS = [
  'colorPrimary',
  'colorSuccess',
  'colorWarning',
  'colorInfo',
  'colorError',
] as const

function buildCategoryAxis(dates: string[], chartTheme: DashboardChartTheme) {
  return {
    type: 'category',
    data: dates,
    axisLine: { lineStyle: { color: chartTheme.colorBorderSecondary } },
    axisLabel: { color: chartTheme.colorTextDescription },
  }
}

function buildValueAxis(chartTheme: DashboardChartTheme) {
  return {
    type: 'value',
    // 计数为非负整数（规格 §14.1），minInterval 保证刻度不出现小数
    minInterval: 1,
    axisLabel: { color: chartTheme.colorTextDescription },
    splitLine: { lineStyle: { color: chartTheme.colorBorderSecondary } },
  }
}

/** 登录趋势折线图（规格 §14.2）：loginTrend 按日期升序的平滑折线 */
export function buildLoginTrendOption(
  overview: DashboardOverview,
  chartTheme: DashboardChartTheme,
): EChartsCoreOption {
  return {
    grid: { ...CATEGORY_GRID },
    tooltip: { trigger: 'axis' },
    xAxis: buildCategoryAxis(
      overview.loginTrend.map((point) => point.date),
      chartTheme,
    ),
    yAxis: buildValueAxis(chartTheme),
    series: [
      {
        type: 'line',
        smooth: true,
        data: overview.loginTrend.map((point) => point.count),
        itemStyle: { color: chartTheme.colorPrimary },
        lineStyle: { color: chartTheme.colorPrimary, width: 2 },
      },
    ],
  }
}

/** 用户增长柱形图（规格 §14.2）：userGrowth 各日累计用户数 */
export function buildUserGrowthOption(
  overview: DashboardOverview,
  chartTheme: DashboardChartTheme,
): EChartsCoreOption {
  return {
    grid: { ...CATEGORY_GRID },
    tooltip: { trigger: 'axis' },
    xAxis: buildCategoryAxis(
      overview.userGrowth.map((point) => point.date),
      chartTheme,
    ),
    yAxis: buildValueAxis(chartTheme),
    series: [
      {
        type: 'bar',
        barMaxWidth: BAR_MAX_WIDTH,
        data: overview.userGrowth.map((point) => point.count),
        itemStyle: { color: chartTheme.colorInfo },
      },
    ],
  }
}

/** 角色分布环形图（规格 §14.2 饼/环）：roleName 图例 + 占比标签，颜色循环取自 token 扩展色 */
export function buildRoleDistributionOption(
  overview: DashboardOverview,
  chartTheme: DashboardChartTheme,
): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: chartTheme.colorText } },
    series: [
      {
        type: 'pie',
        radius: [...DONUT_RADIUS],
        avoidLabelOverlap: true,
        // 扇区间隙色取容器背景，与卡片融为一体（颜色来自 token，规格 §10.2）
        itemStyle: { borderColor: chartTheme.colorBgContainer, borderWidth: 2 },
        label: { color: chartTheme.colorTextDescription },
        data: overview.roleDistribution.map((item, index) => ({
          name: item.roleName,
          value: item.count,
          itemStyle: {
            color: chartTheme[DISTRIBUTION_PALETTE_KEYS[index % DISTRIBUTION_PALETTE_KEYS.length]],
          },
        })),
      },
    ],
  }
}

/** 统计卡环比变化百分比（SPEC_UI2 §8）：序列末位对前一位；基期为 0 或序列不足时不展示 */
export function deriveDeltaPercent(series: readonly number[] | undefined): number | undefined {
  if (series === undefined || series.length < 2) {
    return undefined
  }
  const previous = series[series.length - 2]
  const current = series[series.length - 1]
  if (previous === 0) {
    return undefined
  }
  return ((current - previous) / previous) * 100
}
