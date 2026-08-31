/**
 * AGV 调度概览演示数据（纯前端模式）：
 * 本仓库无请求层（CLAUDE.md「项目定位」），仪表盘按确定性静态数据渲染——
 * 无随机数、无时间依赖、无 mock 服务；接入真实后端时由 dashboard service
 * 以同名结构（AgvDashboardSnapshot）替换，页面与图表构建层不需调整。
 * 数据内部保持口径一致：吞吐序列求和 = 今日任务数，状态分布求和 = AGV 总数，
 * 各趋势序列末位与对应统计值一致。
 */
import type { AgvDashboardSnapshot } from '@/types/dashboard/dashboard.types'

/** 两小时时段起点标签（区域 × 时段热力图 x 轴，升序覆盖全天） */
const HEATMAP_SLOTS = [
  '00:00',
  '02:00',
  '04:00',
  '06:00',
  '08:00',
  '10:00',
  '12:00',
  '14:00',
  '16:00',
  '18:00',
  '20:00',
  '22:00',
] as const

/** 热力图区域基量（单/时段）：体现立体库 > 产线 > 包装 > 月台的调度梯度 */
const HEATMAP_AREA_BASE = [38, 30, 26, 22, 8, 5] as const

/** 时段负荷系数：早高峰（08-12）与午后高峰（14-18）双峰形态 */
const HEATMAP_SLOT_FACTOR = [0.05, 0.02, 0.02, 0.08, 0.35, 0.75, 1, 0.85, 0.9, 0.7, 0.35, 0.12] as const

/** 热力图单元格去规律化扰动：由序号算术派生（确定性，非随机） */
function heatmapNoise(areaIndex: number, slotIndex: number): number {
  return (areaIndex * 7 + slotIndex * 3) % 5
}

function buildAreaSlotHeatmap(areaNames: readonly string[]): AgvDashboardSnapshot['areaSlotHeatmap'] {
  return HEATMAP_AREA_BASE.flatMap((base, areaIndex) =>
    HEATMAP_SLOT_FACTOR.map((factor, slotIndex) => ({
      area: areaNames[areaIndex],
      slot: HEATMAP_SLOTS[slotIndex],
      taskCount: Math.round(base * factor + heatmapNoise(areaIndex, slotIndex)),
    })),
  )
}

/** 热力图区域名（中文文案 key，图表层经 dashboard 命名空间翻译） */
const AREA_NAMES = ['立体库A区', '立体库B区', '产线一线', '产线二线', '包装区', '出货月台'] as const

export const AGV_DASHBOARD_DEMO_DATA: AgvDashboardSnapshot = {
  stats: {
    agvTotal: 42,
    agvOnline: 39,
    todayTaskCount: 1284,
    todayCompletedCount: 1236,
    avgTaskDurationMin: 8.4,
    todayAlarmCount: 7,
    yesterdayTaskCount: 1208,
    yesterdayCompletionRate: 95.1,
    yesterdayAvgTaskDurationMin: 9,
    yesterdayAlarmCount: 10,
  },
  onlineTrend: [31, 32, 32, 33, 33, 34, 35, 36, 37, 38, 39, 39],
  cumulativeTaskTrend: [610, 698, 810, 926, 1030, 1112, 1168, 1208, 1236, 1256, 1272, 1284],
  durationTrend: [9.2, 9, 8.9, 9.1, 8.8, 8.6, 8.7, 8.5, 8.4, 8.3, 8.5, 8.4],
  alarmTrend: [4, 5, 5, 6, 8, 7, 6, 6, 5, 7, 6, 7],
  hourlyThroughput: [
    { hour: '00:00', dispatched: 12, completed: 11 },
    { hour: '01:00', dispatched: 8, completed: 8 },
    { hour: '02:00', dispatched: 6, completed: 6 },
    { hour: '03:00', dispatched: 5, completed: 5 },
    { hour: '04:00', dispatched: 7, completed: 7 },
    { hour: '05:00', dispatched: 14, completed: 13 },
    { hour: '06:00', dispatched: 32, completed: 30 },
    { hour: '07:00', dispatched: 58, completed: 55 },
    { hour: '08:00', dispatched: 86, completed: 82 },
    { hour: '09:00', dispatched: 104, completed: 98 },
    { hour: '10:00', dispatched: 118, completed: 112 },
    { hour: '11:00', dispatched: 96, completed: 93 },
    { hour: '12:00', dispatched: 64, completed: 62 },
    { hour: '13:00', dispatched: 88, completed: 84 },
    { hour: '14:00', dispatched: 112, completed: 108 },
    { hour: '15:00', dispatched: 116, completed: 111 },
    { hour: '16:00', dispatched: 104, completed: 104 },
    { hour: '17:00', dispatched: 82, completed: 80 },
    { hour: '18:00', dispatched: 56, completed: 54 },
    { hour: '19:00', dispatched: 40, completed: 39 },
    { hour: '20:00', dispatched: 28, completed: 27 },
    { hour: '21:00', dispatched: 20, completed: 20 },
    { hour: '22:00', dispatched: 16, completed: 15 },
    { hour: '23:00', dispatched: 12, completed: 12 },
  ],
  statusDistribution: [
    { status: '运行中', count: 26 },
    { status: '待命', count: 6 },
    { status: '充电中', count: 5 },
    { status: '故障', count: 2 },
    { status: '离线', count: 3 },
  ],
  areaTaskLoad: [
    { area: AREA_NAMES[0], taskCount: 386 },
    { area: AREA_NAMES[1], taskCount: 302 },
    { area: AREA_NAMES[2], taskCount: 268 },
    { area: AREA_NAMES[3], taskCount: 214 },
    { area: AREA_NAMES[4], taskCount: 72 },
    { area: AREA_NAMES[5], taskCount: 42 },
  ],
  utilizationRanking: [
    { agvCode: 'AGV-07', rate: 96.5 },
    { agvCode: 'AGV-12', rate: 94.8 },
    { agvCode: 'AGV-03', rate: 93.2 },
    { agvCode: 'AGV-18', rate: 91.7 },
    { agvCode: 'AGV-09', rate: 89.4 },
    { agvCode: 'AGV-15', rate: 86.1 },
    { agvCode: 'AGV-21', rate: 83.5 },
    { agvCode: 'AGV-05', rate: 79.8 },
    { agvCode: 'AGV-24', rate: 74.3 },
    { agvCode: 'AGV-11', rate: 68.9 },
  ],
  taskTypeDistribution: [
    { typeName: '搬运', taskCount: 512 },
    { typeName: '入库', taskCount: 296 },
    { typeName: '出库', taskCount: 244 },
    { typeName: '盘点', taskCount: 128 },
    { typeName: '充电回桩', taskCount: 104 },
  ],
  areaSlotHeatmap: buildAreaSlotHeatmap(AREA_NAMES),
}
