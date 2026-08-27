/**
 * 仪表盘服务：后端暂无对应端点，数据由本地演示模型提供。
 * 接入真实接口时替换本文件实现即可，页面与 ViewModel 不变。
 */

import type { RequestOptions } from '@/services/request/request.types'
import type {
  AlertItem,
  DashboardOverview,
  EventItem,
} from '@/types/dashboard/dashboard.types'

const SIMULATED_LATENCY_MS = 260

function delay<T>(value: T, options?: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), SIMULATED_LATENCY_MS)
    options?.signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

const overview: DashboardOverview = {
  kpis: [
    {
      id: 'gmv',
      label: '总交易金额',
      value: '¥ 8,320.6',
      unit: '万',
      footer: '较昨日',
      trend: 'up',
      trendText: '▲ 12.5%',
      sparkPath:
        'M2 43 C12 44, 18 39, 26 41 S42 34, 52 36 S68 40, 78 30 S96 23, 106 27 S122 19, 132 24 S144 19, 158 6',
    },
    {
      id: 'active-users',
      label: '活跃用户（总量）',
      value: '128,560',
      footer: '较昨日',
      trend: 'down',
      trendText: '▼ 2.4%',
      sparkPath:
        'M2 45 C12 40, 18 35, 28 33 S44 22, 54 24 S70 39, 82 30 S97 22, 108 28 S124 26, 136 16 S148 18, 158 8',
    },
    {
      id: 'orders',
      label: '订单量（今日）',
      value: '36,478',
      footer: '较昨日',
      trend: 'down',
      trendText: '▼ 0.1%',
      sparkPath:
        'M2 40 C10 42, 18 35, 26 37 S42 33, 50 28 S64 24, 74 31 S88 35, 98 22 S118 18, 126 11 S146 28, 158 8',
    },
    {
      id: 'sla',
      label: '系统可用性（SLA）',
      value: '99.98%',
      footer: '近 30 天',
      trend: 'flat',
      sparkPath:
        'M2 43 C12 42, 16 37, 24 34 S40 28, 48 30 S64 26, 74 32 S90 22, 100 28 S114 18, 126 20 S142 26, 158 9',
    },
  ],
  workflow: {
    version: 'v2.4.1',
    runningFor: '32:39:18',
    performancePercent: 68,
    chainPercent: '68%',
    stageLabels: ['接单', '校验与去重', '库存校验', '支付处理', '发货处理', '完成'],
    nodes: [
      { id: 'accept', name: '订单验收', volume: '10,236 单', state: 'done', left: 90, top: 24 },
      { id: 'risk', name: '风险校验', volume: '8,612 单', state: 'done', left: 198, top: 24 },
      { id: 'freeze', name: '库存冻结', volume: '6,578 单', state: 'running', left: 322, top: 24 },
      { id: 'shipping', name: '发货中', volume: '3,231 单', state: 'running', left: 442, top: 24 },
      { id: 'archive', name: '完成归档', volume: '—', state: 'pending', left: 552, top: 24 },
      { id: 'notify', name: '商家通知', volume: '9,200 单', state: 'done', left: 156, top: 86 },
      { id: 'pack', name: '履约打包', volume: '8,910 单', state: 'running', left: 276, top: 86 },
      { id: 'tracking', name: '物流跟踪', volume: '—', state: 'pending', left: 398, top: 86 },
    ],
    edges: [
      { path: 'M62 50 H114', color: '#18ad68' },
      { path: 'M218 50 H240', color: '#18ad68' },
      { path: 'M342 50 H364', color: '#2f7fff' },
      { path: 'M462 50 H486', color: '#2f7fff' },
      { path: 'M114 50 V100 H190', color: 'rgba(140,155,185,.55)' },
      { path: 'M238 100 H312', color: '#18ad68' },
      { path: 'M416 100 H488', color: 'rgba(140,155,185,.55)' },
      { path: 'M540 100 H564 V50', color: 'rgba(140,155,185,.55)' },
    ],
    dots: [
      { x: 114, y: 50, color: '#18ad68' },
      { x: 218, y: 50, color: '#18ad68' },
      { x: 342, y: 50, color: '#2f7fff' },
      { x: 462, y: 50, color: '#2f7fff' },
      { x: 188, y: 100, color: '#18ad68' },
      { x: 312, y: 100, color: '#2f7fff' },
      { x: 488, y: 100, color: 'rgba(140,155,185,.75)' },
    ],
  },
  topology: {
    score: 98,
    scoreLabel: '优秀',
    healthItems: [
      { id: 'gateway', name: 'API 网关', ready: '8/8' },
      { id: 'trade', name: '交易服务', ready: '24/24' },
      { id: 'marketing', name: '营销服务', ready: '6/6' },
      { id: 'fulfill', name: '履约服务', ready: '12/12' },
      { id: 'cdn', name: 'CDN 加速', ready: '10/10' },
      { id: 'mq', name: '消息队列', ready: '18/18' },
      { id: 'monitor', name: '监控告警', ready: '12/12' },
    ],
    regions: [
      { id: 'bj', name: '北京中心', sub: '低延迟', x: 120, y: 58 },
      { id: 'sh', name: '上海中心', sub: '低延迟', x: 330, y: 58 },
      { id: 'cd', name: '成都中心', sub: '低延迟', x: 120, y: 186 },
      { id: 'gz', name: '广州中心', sub: '低延迟', x: 344, y: 186 },
    ],
  },
  schedule: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    today: new Date().getDate(),
    todos: [
      { id: 'todo-1', time: '09:30', title: '运营晨会' },
      { id: 'todo-2', time: '11:00', title: '审核供应商资质' },
      { id: 'todo-3', time: '14:00', title: '数据复盘会议' },
      { id: 'todo-4', time: '16:30', title: '月报规划' },
    ],
  },
  alerts: [
    { id: 'alert-1', severity: 'P1', title: '支付服务响应超时告警', detail: '平均响应时间 ＞ 300ms', target: '交易核心 / 华东', occurredAt: '09:40:21' },
    { id: 'alert-2', severity: 'P2', title: '库存同步延迟告警', detail: '延迟时间 ＞ 120s', target: '库存服务 / 广州机房', occurredAt: '09:36:48' },
    { id: 'alert-3', severity: 'P2', title: '用户登录失败率上升', detail: '5 分钟内 ＞ 1%', target: '认证服务 / 全局', occurredAt: '09:34:22' },
    { id: 'alert-4', severity: 'P3', title: '消息队列堆积', detail: '堆积 ＞ 4.6k', target: 'MQ 集群 / 北京', occurredAt: '09:32:11' },
  ],
  alertCount: 12,
  events: [
    { id: 'event-1', time: '09:40:21', title: '用户登录成功', lines: ['用户：zhangwei@corp.com', '地点：北京'], level: 'info' },
    { id: 'event-2', time: '09:36:48', title: '订单支付成功', lines: ['订单号：ORD-20250602009336', '金额：¥ 1,299.00', '支付方式：支付宝'], level: 'info' },
    { id: 'event-3', time: '09:34:22', title: '库存预警', lines: ['商品：智能摄像头 Pro', '当前库存：32 （阈值：200）', '仓库：广州仓'], level: 'warn' },
    { id: 'event-4', time: '09:32:11', title: 'API 调用异常', lines: ['服务：user-service', '错误：500', '耗时：2.3s'], level: 'error' },
    { id: 'event-5', time: '09:28:54', title: '订单发货成功', lines: ['订单号：ORD-20250602009312', '物流：顺丰速运', '运单号：SF153312312312'], level: 'info' },
  ],
}

/** 概览整页数据 */
export async function getDashboardOverview(options?: RequestOptions): Promise<DashboardOverview> {
  return delay({ ...overview, kpis: overview.kpis.map((kpi) => ({ ...kpi })) }, options)
}

const eventPushPool: EventItem[] = [
  { id: 'push-1', time: '09:41:05', title: '用户登录成功', lines: ['用户：liling@corp.com', '地点：上海'], level: 'info' },
  { id: 'push-2', time: '09:41:32', title: '订单支付成功', lines: ['订单号：ORD-20250602009401', '金额：¥ 329.00', '支付方式：微信支付'], level: 'info' },
  { id: 'push-3', time: '09:42:10', title: '库存预警', lines: ['商品：无线降噪耳机', '当前库存：54 （阈值：100）', '仓库：华东仓'], level: 'warn' },
  { id: 'push-4', time: '09:42:48', title: '订单发货成功', lines: ['订单号：ORD-20250602009415', '物流：京东物流', '运单号：JD772310045'], level: 'info' },
]

let pushCursor = 0

/** 生成一条新的实时事件（演示推送） */
export async function pushDemoEvent(options?: RequestOptions): Promise<EventItem> {
  const item = eventPushPool[pushCursor % eventPushPool.length]
  pushCursor += 1
  return delay({ ...item, id: `${item.id}-${pushCursor}` }, options)
}

/** 告警排序辅助：级别权重 */
export function alertSeverityWeight(alert: AlertItem): number {
  return { P1: 3, P2: 2, P3: 1 }[alert.severity]
}
