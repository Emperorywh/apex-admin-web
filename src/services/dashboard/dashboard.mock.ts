/**
 * 仪表盘 mock 数据：按「当前时刻 + 确定性抖动」合成一天的调度统计，
 * 同一天内多次刷新数值稳定（种子取自日期与槽位，不随刷新漂移）；
 * 接入调度后端后整个文件与 dashboard.service.ts 中的 mock 分支一并移除。
 */

import dayjs from 'dayjs'
import type {
  DailyOrderStat,
  DashboardOverview,
  HourlyTrendPoint,
  RecentAlarmItem,
  VehicleStatusSlice,
} from '@/types/dashboard/dashboard.types'

/** mock 延迟（毫秒）：让 loading 态可见，接近真实请求体感 */
export const MOCK_DASHBOARD_LATENCY_MS = 300

/** 确定性伪随机（mulberry32）：同一种子序列恒定 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 日种子：同一天恒定 */
function daySeed(date: dayjs.Dayjs): number {
  return date.year() * 10000 + (date.month() + 1) * 100 + date.date()
}

/** 24 小时任务创建模板曲线（车间双峰：上午 10 点 / 下午 16 点） */
const HOURLY_CREATED_TEMPLATE = [6, 3, 2, 1, 2, 5, 12, 20, 28, 34, 40, 44, 41, 36, 38, 44, 41, 35, 29, 24, 18, 13, 10, 7]

/** 车辆在运行状态的占比模板（白天忙、夜里闲） */
const HOURLY_RUNNING_TEMPLATE = [3, 3, 2, 2, 3, 6, 10, 13, 16, 18, 19, 20, 18, 17, 18, 20, 19, 17, 14, 12, 9, 7, 5, 4]

/** 车队规模 */
const FLEET_TOTAL = 42

/** 合成某小时的任务创建/完成数 */
function hourlyCounts(date: dayjs.Dayjs, hour: number): { created: number; completed: number } {
  const random = mulberry32(daySeed(date) * 100 + hour)
  const created = Math.round(HOURLY_CREATED_TEMPLATE[hour] * (0.85 + random() * 0.3))
  // 完成滞后于创建：以上一小时创建量为基础，按完成率收敛
  const basis = Math.max(2, HOURLY_CREATED_TEMPLATE[(hour + 23) % 24])
  const completed = Math.round(basis * (0.82 + random() * 0.16))
  return { created, completed }
}

/** 24 小时滚动窗口趋势：窗口终点为当前整点，始终铺满整幅图 */
function buildHourlyTrend(now: dayjs.Dayjs): HourlyTrendPoint[] {
  const points: HourlyTrendPoint[] = []
  for (let offset = 23; offset >= 0; offset -= 1) {
    const slot = now.subtract(offset, 'hour')
    const { created, completed } = hourlyCounts(slot, slot.hour())
    points.push({ time: slot.format('YYYY-MM-DD HH:00'), created, completed })
  }
  return points
}

/** 近 7 日完成/失败统计（周末产能回落） */
function buildDailyStats(now: dayjs.Dayjs): DailyOrderStat[] {
  const stats: DailyOrderStat[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = now.subtract(offset, 'day')
    const random = mulberry32(daySeed(date) * 7 + 3)
    const weekendFactor = [0, 6].includes(date.day()) ? 0.55 : 1
    const completed = Math.round(420 * weekendFactor * (0.88 + random() * 0.24))
    const failed = Math.max(2, Math.round(completed * (0.02 + random() * 0.05)))
    stats.push({ date: date.format('YYYY-MM-DD'), completed, failed })
  }
  return stats
}

/** 车辆状态分布：运行数随时段起伏，其余状态按车队规模分摊 */
function buildVehicleStatus(now: dayjs.Dayjs): VehicleStatusSlice[] {
  const random = mulberry32(daySeed(now))
  const running = HOURLY_RUNNING_TEMPLATE[now.hour()] + Math.round(random() * 2)
  const charging = 4 + Math.round(random() * 3)
  const alarm = 1 + Math.round(random() * 2)
  const offline = 5 + Math.round(random() * 3)
  const idle = Math.max(0, FLEET_TOTAL - running - charging - alarm - offline)
  return [
    { state: 'IDLE', count: idle },
    { state: 'RUNNING', count: running },
    { state: 'CHARGING', count: charging },
    { state: 'ALARM', count: alarm },
    { state: 'OFFLINE', count: offline },
  ]
}

/** 最新告警：以当前时刻倒推 minutesBefore 分钟生成时间 */
function buildRecentAlarms(now: dayjs.Dayjs): RecentAlarmItem[] {
  const rows: Array<Omit<RecentAlarmItem, 'raisedAt'>> = [
    { id: 1, level: 'ERROR', alarmCode: 'E2003', vehicleName: 'AGV-07', message: '驱动器过流，已自动限速并停靠安全点' },
    { id: 2, level: 'WARN', alarmCode: 'W1004', vehicleName: 'AGV-12', message: '激光雷达数据丢帧，已切换冗余传感器' },
    { id: 3, level: 'WARN', alarmCode: 'W1017', vehicleName: 'AGV-03', message: '电量低于 20%，已派发充电任务' },
    { id: 4, level: 'INFO', alarmCode: 'I3002', vehicleName: 'AGV-18', message: '路径阻塞超时，已自动重规划绕行' },
    { id: 5, level: 'WARN', alarmCode: 'W1021', vehicleName: 'AGV-09', message: '货架检测异常，请确认取放姿态' },
    { id: 6, level: 'INFO', alarmCode: 'I3005', vehicleName: 'AGV-21', message: '进入充电桩泊位，开始充电' },
  ]
  const minutesBefore = [3, 9, 16, 28, 41, 57]
  return rows.map((row, index) => ({
    ...row,
    raisedAt: now.subtract(minutesBefore[index], 'minute').format('YYYY-MM-DD HH:mm:ss'),
  }))
}

/** 合成整份仪表盘数据 */
export function buildMockDashboardOverview(): DashboardOverview {
  const now = dayjs()
  const hourlyTrend = buildHourlyTrend(now)
  const elapsedCreated = hourlyTrend
    .filter((point) => point.time.startsWith(now.format('YYYY-MM-DD')))
    .reduce((sum, point) => sum + point.created, 0)
  const elapsedCompleted = hourlyTrend
    .filter((point) => point.time.startsWith(now.format('YYYY-MM-DD')))
    .reduce((sum, point) => sum + point.completed, 0)
  const vehicleStatus = buildVehicleStatus(now)

  // 今日 KPI：由趋势累计 + 少量在途/排队抖动合成，保证口径自洽
  const random = mulberry32(daySeed(now) * 13 + 5)
  const processing = 8 + Math.round(random() * 6)
  const queued = 10 + Math.round(random() * 12)
  const failedToday = Math.max(2, Math.round(elapsedCompleted * 0.04))
  const todayOrders = elapsedCreated + queued
  const completionRate = Math.round((elapsedCompleted / Math.max(1, elapsedCompleted + processing + queued + failedToday)) * 1000) / 10
  const onlineVehicles = vehicleStatus
    .filter((slice) => slice.state !== 'OFFLINE')
    .reduce((sum, slice) => sum + slice.count, 0)
  const activeAlarms = vehicleStatus.find((slice) => slice.state === 'ALARM')?.count ?? 0

  const delta = (base: number) => Math.round((todayOrders / Math.max(1, base) - 1) * 1000) / 10
  // 与昨日同时段（0 点至当前整点）累计对比，避免拿全天总量对比出夸张涨跌
  let yesterdayElapsed = 0
  for (let hour = 0; hour <= now.hour(); hour += 1) {
    yesterdayElapsed += hourlyCounts(now.subtract(1, 'day'), hour).created
  }
  const kpi = {
    todayOrders: { value: todayOrders, deltaPercent: delta(yesterdayElapsed) },
    processing: { value: processing, deltaPercent: Math.round((random() * 16 - 6) * 10) / 10 },
    queued: { value: queued, deltaPercent: Math.round((random() * 20 - 8) * 10) / 10 },
    completionRate: { value: completionRate, deltaPercent: Math.round((random() * 4 - 1) * 10) / 10 },
    onlineVehicles: { value: onlineVehicles, deltaPercent: null },
    activeAlarms: { value: activeAlarms, deltaPercent: null },
  }

  return {
    kpi,
    hourlyTrend,
    dailyStats: buildDailyStats(now),
    vehicleStatus,
    // 今日任务类型分布：按占比切分今日任务总量
    orderTypes: [
      { orderType: 'WORK', count: Math.round(todayOrders * 0.64) },
      { orderType: 'PARK', count: Math.round(todayOrders * 0.21) },
      { orderType: 'CHARGE', count: Math.round(todayOrders * 0.09) },
      { orderType: 'MOVE', count: Math.max(1, Math.round(todayOrders * 0.06)) },
    ],
    vehicleRank: [
      { vehicleName: 'AGV-05', groupName: '一号车间', completedCount: 118 },
      { vehicleName: 'AGV-11', groupName: '一号车间', completedCount: 106 },
      { vehicleName: 'AGV-02', groupName: '立体库区', completedCount: 97 },
      { vehicleName: 'AGV-16', groupName: '二号车间', completedCount: 88 },
      { vehicleName: 'AGV-08', groupName: '立体库区', completedCount: 76 },
    ],
    recentAlarms: buildRecentAlarms(now),
    generatedAt: now.format('YYYY-MM-DD HH:mm:ss'),
  }
}
