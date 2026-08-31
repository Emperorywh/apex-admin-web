/**
 * Dashboard 图表 option 构建（AGV 调度概览）：输入 AgvDashboardSnapshot、来自 antd token
 * 的图表主题与文案翻译函数，输出 echarts/core 的 EChartsCoreOption。
 * 颜色全部取自 token（规格 §10.2/§15），本文件不出现色值字面量；
 * 纯函数仅被 Dashboard 页面消费，便于同目录维护。
 */
import type { GlobalToken } from 'antd'
import type { EChartsCoreOption } from 'echarts/core'
import type { AgvDashboardSnapshot } from '@/types/dashboard/dashboard.types'

/** 图表主题：由 Dashboard 页面从 theme.useToken() 提取，窄结构保持本文件可独立测试 */
export interface DashboardChartTheme {
  colorPrimary: string
  colorPrimaryBg: string
  colorSuccess: string
  colorWarning: string
  colorInfo: string
  colorError: string
  colorText: string
  colorTextDescription: string
  colorTextQuaternary: string
  colorBorderSecondary: string
  colorBgContainer: string
}

/** 从 antd token 提取图表主题（Dashboard 页面唯一调用方） */
export function buildDashboardChartTheme(token: Pick<GlobalToken, keyof DashboardChartTheme>): DashboardChartTheme {
  return {
    colorPrimary: token.colorPrimary,
    colorPrimaryBg: token.colorPrimaryBg,
    colorSuccess: token.colorSuccess,
    colorWarning: token.colorWarning,
    colorInfo: token.colorInfo,
    colorError: token.colorError,
    colorText: token.colorText,
    colorTextDescription: token.colorTextDescription,
    colorTextQuaternary: token.colorTextQuaternary,
    colorBorderSecondary: token.colorBorderSecondary,
    colorBgContainer: token.colorBgContainer,
  }
}

/** 文案翻译函数：中文文案 key → 当前语言文案（Dashboard 页面从 useTranslation 闭包派生） */
export type ChartTranslate = (key: string) => string

/** 类目轴图表（折线/柱形/热力）共用网格边距（像素）：containLabel 使轴标签不计入边距 */
const CATEGORY_GRID = { left: 8, right: 16, top: 16, bottom: 8, containLabel: true } as const

/** 折线图网格：顶部为双系列图例预留空间 */
const LINE_GRID = { ...CATEGORY_GRID, top: 36 } as const

/** 热力图网格：底部为横向 visualMap 色条预留空间 */
const HEATMAP_GRID = { ...CATEGORY_GRID, bottom: 56 } as const

/** 环形/玫瑰图内外半径与圆心：图例置底时图形整体上移 */
const DONUT_RADIUS = ['45%', '70%'] as const
const DONUT_CENTER = ['50%', '42%'] as const

/** 柱形最大宽度（像素）：数据量少时避免柱体过宽 */
const BAR_MAX_WIDTH = 32

/** 利用率排行条形宽度（像素）与右端圆角（形成胶囊形态） */
const RANK_BAR_WIDTH = 12
const RANK_BAR_RADIUS = [0, 6, 6, 0] as const

/** 仪表盘进度环宽（像素） */
const GAUGE_LINE_WIDTH = 16

/** AGV 状态 → token 语义色映射（未列入的状态回退 colorInfo） */
const STATUS_COLOR_KEYS: Record<string, keyof DashboardChartTheme> = {
  运行中: 'colorPrimary',
  待命: 'colorInfo',
  充电中: 'colorWarning',
  故障: 'colorError',
  离线: 'colorTextQuaternary',
}

/** 饼图取色环：按序循环取用 token 语义色，扇区数超出时从头循环 */
const PIE_PALETTE_KEYS = ['colorPrimary', 'colorSuccess', 'colorWarning', 'colorInfo', 'colorError'] as const

function buildCategoryAxis(labels: readonly string[], chartTheme: DashboardChartTheme) {
  return {
    type: 'category',
    data: [...labels],
    axisLine: { lineStyle: { color: chartTheme.colorBorderSecondary } },
    axisLabel: { color: chartTheme.colorTextDescription },
  }
}

function buildValueAxis(chartTheme: DashboardChartTheme) {
  return {
    type: 'value',
    // 任务量为非负整数，minInterval 保证刻度不出现小数
    minInterval: 1,
    axisLabel: { color: chartTheme.colorTextDescription },
    splitLine: { lineStyle: { color: chartTheme.colorBorderSecondary } },
  }
}

/** 24H 任务吞吐折线图：下发/完成任务双系列平滑面积线 */
export function buildThroughputOption(
  snapshot: AgvDashboardSnapshot,
  chartTheme: DashboardChartTheme,
  translate: ChartTranslate,
): EChartsCoreOption {
  const seriesStyles = [
    { name: translate('下发任务'), color: chartTheme.colorPrimary },
    { name: translate('完成任务'), color: chartTheme.colorSuccess },
  ]
  return {
    grid: { ...LINE_GRID },
    tooltip: { trigger: 'axis' },
    legend: {
      top: 4,
      right: 8,
      itemGap: 16,
      textStyle: { color: chartTheme.colorTextDescription },
    },
    xAxis: buildCategoryAxis(snapshot.hourlyThroughput.map((point) => point.hour), chartTheme),
    yAxis: buildValueAxis(chartTheme),
    series: seriesStyles.map((style, index) => ({
      name: style.name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: snapshot.hourlyThroughput.map((point) => (index === 0 ? point.dispatched : point.completed)),
      itemStyle: { color: style.color },
      lineStyle: { color: style.color, width: 2 },
      areaStyle: { color: style.color, opacity: 0.12 },
    })),
  }
}

/** AGV 状态分布环形图：按状态语义取色（运行/待命/充电/故障/离线） */
export function buildStatusDistributionOption(
  snapshot: AgvDashboardSnapshot,
  chartTheme: DashboardChartTheme,
  translate: ChartTranslate,
): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: chartTheme.colorTextDescription } },
    series: [
      {
        type: 'pie',
        radius: [...DONUT_RADIUS],
        center: [...DONUT_CENTER],
        // 窄面板下外置标签会被截断，占比信息由 tooltip 与图例承担
        label: { show: false },
        // 扇区间隙色取容器背景，与卡片融为一体（颜色来自 token，规格 §10.2）
        itemStyle: { borderColor: chartTheme.colorBgContainer, borderWidth: 2 },
        emphasis: { label: { show: false } },
        data: snapshot.statusDistribution.map((item) => ({
          name: translate(item.status),
          value: item.count,
          itemStyle: { color: chartTheme[STATUS_COLOR_KEYS[item.status] ?? 'colorInfo'] },
        })),
      },
    ],
  }
}

/** 区域任务量柱形图：各区域今日任务量，柱顶标注数值 */
export function buildAreaTaskOption(
  snapshot: AgvDashboardSnapshot,
  chartTheme: DashboardChartTheme,
  translate: ChartTranslate,
): EChartsCoreOption {
  return {
    grid: { ...CATEGORY_GRID },
    tooltip: { trigger: 'axis' },
    // 六个区域类目在 8 栅格窄面板下全量显示会相互紧贴，旋转标签保证逐区可读
    xAxis: {
      ...buildCategoryAxis(snapshot.areaTaskLoad.map((item) => translate(item.area)), chartTheme),
      axisLabel: { interval: 0, rotate: 30, color: chartTheme.colorTextDescription },
    },
    yAxis: buildValueAxis(chartTheme),
    series: [
      {
        type: 'bar',
        barMaxWidth: BAR_MAX_WIDTH,
        data: snapshot.areaTaskLoad.map((item) => item.taskCount),
        itemStyle: { color: chartTheme.colorInfo },
        label: { show: true, position: 'top', color: chartTheme.colorTextDescription },
      },
    ],
  }
}

/** AGV 利用率排行条形图：横向条形 + 右端百分比标注，y 轴反转使首位在顶部 */
export function buildUtilizationOption(
  snapshot: AgvDashboardSnapshot,
  chartTheme: DashboardChartTheme,
): EChartsCoreOption {
  return {
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'item', valueFormatter: (value: number) => `${value}%` },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: chartTheme.colorTextDescription, formatter: '{value}%' },
      splitLine: { lineStyle: { color: chartTheme.colorBorderSecondary } },
    },
    yAxis: {
      ...buildCategoryAxis(snapshot.utilizationRanking.map((item) => item.agvCode), chartTheme),
      inverse: true,
    },
    series: [
      {
        type: 'bar',
        barWidth: RANK_BAR_WIDTH,
        data: snapshot.utilizationRanking.map((item) => item.rate),
        itemStyle: { color: chartTheme.colorPrimary, borderRadius: [...RANK_BAR_RADIUS] },
        label: { show: true, position: 'right', formatter: '{c}%', color: chartTheme.colorTextDescription },
      },
    ],
  }
}

/** 任务类型分布玫瑰图：roseType 半径映射任务量，颜色循环取用 token 语义色 */
export function buildTaskTypeOption(
  snapshot: AgvDashboardSnapshot,
  chartTheme: DashboardChartTheme,
  translate: ChartTranslate,
): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: chartTheme.colorTextDescription } },
    series: [
      {
        type: 'pie',
        roseType: 'radius',
        radius: ['18%', '72%'],
        center: [...DONUT_CENTER],
        itemStyle: { borderColor: chartTheme.colorBgContainer, borderWidth: 2 },
        label: { show: false },
        data: snapshot.taskTypeDistribution.map((item, index) => ({
          name: translate(item.typeName),
          value: item.taskCount,
          itemStyle: {
            color: chartTheme[PIE_PALETTE_KEYS[index % PIE_PALETTE_KEYS.length]],
          },
        })),
      },
    ],
  }
}

/** 区域 × 时段任务热力图：visualMap 由浅（colorPrimaryBg）至深（colorPrimary）映射负荷 */
export function buildHeatmapOption(
  snapshot: AgvDashboardSnapshot,
  chartTheme: DashboardChartTheme,
  translate: ChartTranslate,
): EChartsCoreOption {
  const slots = [...new Set(snapshot.areaSlotHeatmap.map((point) => point.slot))]
  const areas = [...new Set(snapshot.areaSlotHeatmap.map((point) => translate(point.area)))]
  const data = snapshot.areaSlotHeatmap.map((point) => [
    slots.indexOf(point.slot),
    areas.indexOf(translate(point.area)),
    point.taskCount,
  ])
  const maxTaskCount = Math.max(...data.map(([, , value]) => value))
  return {
    grid: { ...HEATMAP_GRID },
    tooltip: {
      trigger: 'item',
      formatter: (params: { data: [number, number, number] }) =>
        `${areas[params.data[1]]} ${slots[params.data[0]]}：${params.data[2]}`,
    },
    xAxis: { ...buildCategoryAxis(slots, chartTheme), splitArea: { show: true } },
    yAxis: { ...buildCategoryAxis(areas, chartTheme), splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: maxTaskCount,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 120,
      textStyle: { color: chartTheme.colorTextDescription },
      inRange: { color: [chartTheme.colorPrimaryBg, chartTheme.colorPrimary] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        itemStyle: { borderColor: chartTheme.colorBgContainer, borderWidth: 2, borderRadius: 3 },
      },
    ],
  }
}

/** 任务完成率仪表盘：进度环 + 中心百分数 + 环比副文案 */
export function buildCompletionGaugeOption(
  snapshot: AgvDashboardSnapshot,
  chartTheme: DashboardChartTheme,
  compareText: string,
): EChartsCoreOption {
  const completionRate =
    snapshot.stats.todayTaskCount === 0
      ? 0
      : Number(((snapshot.stats.todayCompletedCount / snapshot.stats.todayTaskCount) * 100).toFixed(1))
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        progress: { show: true, width: GAUGE_LINE_WIDTH, itemStyle: { color: chartTheme.colorPrimary } },
        axisLine: { lineStyle: { width: GAUGE_LINE_WIDTH, color: [[1, chartTheme.colorBorderSecondary]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { offsetCenter: [0, '36%'], color: chartTheme.colorTextDescription },
        detail: {
          offsetCenter: [0, 0],
          formatter: '{value}%',
          color: chartTheme.colorText,
          fontSize: 30,
          fontWeight: 600,
        },
        data: [{ value: completionRate, name: compareText }],
      },
    ],
  }
}
