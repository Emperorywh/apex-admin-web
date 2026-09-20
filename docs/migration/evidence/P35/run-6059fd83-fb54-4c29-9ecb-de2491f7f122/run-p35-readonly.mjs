/**
 * P35 任务统计报表页：真实只读联调脚本（无业务写副作用）。
 *
 * 覆盖（三个 POST 均为统计聚合查询，按业务语义分类为只读）：
 * 1. 登录（MD5 摘要，G03 已确认形态）→ token；
 * 2. taskStatistics 默认窗口（近 7 个自然日、不传 orderTypes/vehicleKeys）→
 *    code=200 + dailyCounts 行形态（date 归一化 yyyy-MM-dd、计数字段 number）
 *    + durationDistribution label 归一化映射固定 6 桶（未知桶防御丢弃）；
 * 3. 前端汇总口径试算互证（KPI：总数=Σ终态、完成率、平均执行时长毫秒；
 *    窗口逐天补零的天数）——供 UI KPI/明细对照；
 * 4. taskStatistics 指定 vehicleKeys（取真实车辆一个）→ code=200 对照
 *    （车辆筛选仅任务统计链路消费，利用率两图不传）；
 * 5. agvStateStatistics（states=有效状态三元组）→ code=200 + dailyStateDurations
 *    行形态（date/totalDurationSeconds/vehicleCount）——P35 趋势数据源；
 *    趋势口径试算（当天窗口交集秒 × vehicleCount 分母）抽查一天；
 * 6. agvExecutingTimeStatistics（同三元组）→ 每车 activeSeconds/windowSeconds
 *    利用率试算（排行图数据源，供 UI 对照）；
 * 7. 无令牌对照：taskStatistics 拒绝（记录真实拒绝形态，不作为缺陷）；
 * 8. 登出清理本轮会话。
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_TEST_USERNAME / APEX_TEST_PASSWORD）
 * 读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-p35-readonly.mjs [baseUrl]（缺省 http://localhost:5173）
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const dayjs = require('dayjs')
const dayjsTz = require('dayjs/plugin/timezone')
const dayjsUtc = require('dayjs/plugin/utc')
try {
  dayjs.extend(dayjsUtc)
  dayjs.extend(dayjsTz)
} catch {}

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..')

// ---- 读取本机环境配置（不回显值） ------------------------------------------
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const username = env.APEX_TEST_USERNAME
const password = env.APEX_TEST_PASSWORD
if (!username || !password) {
  console.error(JSON.stringify({ ok: false, reason: '缺少 .env.local 配置（username/password）' }))
  process.exit(1)
}

const base = process.argv[2] ?? 'http://localhost:5173'
const checks = []
function record(step, ok, detail) {
  checks.push({ step, ok, detail })
  console.error(`${ok ? 'PASS' : 'FAIL'} ${step}: ${detail}`)
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'accept-language': 'zh-CN',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const contentType = String(res.headers.get('content-type') ?? '')
  const payload = contentType.includes('json') ? await res.json() : null
  return { status: res.status, contentType, payload }
}

const TASK_STATS = '/fms/v1/report/orderStatisticsReport/taskStatistics'
const EXEC_STATS = '/fms/v1/report/vehicleStatisticsReport/agvExecutingTimeStatistics'
const DAILY_STATS = '/fms/v1/report/vehicleStatisticsReport/agvStateStatistics'
const LOGOUT = '/fms/v1/auth/authorize/logout'
const DEPLOY_TZ = 'Asia/Shanghai'
const FMT = 'YYYY-MM-DD HH:mm:ss'

/** P35 利用率「有效状态」三元组（features/analyze-visual/vehicle-status/statistics.ts 常量） */
const EFFECTIVE_WORK_STATES = ['EXECUTING_WORK', 'EXECUTING_CHARGE', 'EXECUTING_PARK']

/** 时长分布 label 归一化映射（页面 statistics.ts 同款：去空白 + 小写） */
const DURATION_LABEL_TO_BUCKET = {
  '<1min': 'lt1m',
  '1-2min': 'm1To2',
  '2-3min': 'm2To3',
  '3-5min': 'm3To5',
  '5-10min': 'm5To10',
  '>10min': 'gte10m',
}
const normalizeDurationLabel = (label) =>
  typeof label === 'string' ? label.replace(/\s+/g, '').toLowerCase() : ''

// 默认统计窗口：近 7 个自然日（页面 initialStatRange 同口径）
const now = dayjs().tz(DEPLOY_TZ)
const winStart = now.subtract(6, 'day').startOf('day')
const winEnd = now.endOf('day')

// ---- 1. 登录 ----------------------------------------------------------------
const md5 = createHash('md5').update(password).digest('hex')
const login = await call('POST', '/fms/v1/auth/authorize/login', {
  body: { username, password: md5 },
})
const loginOk =
  login.status === 200 &&
  login.payload?.code === 200 &&
  typeof login.payload?.data?.token === 'string' &&
  login.payload.data.token !== ''
record('login', loginOk, `HTTP ${login.status} code=${login.payload?.code} activated=${login.payload?.data?.activated}`)
if (!loginOk) process.exit(1)
const token = login.payload.data.token

try {
  // ---- 2. 任务统计（默认窗口，不传 orderTypes/vehicleKeys） -------------------
  const statsBody = { startTime: winStart.format(FMT), endTime: winEnd.format(FMT) }
  const stats = await call('POST', TASK_STATS, { token, body: statsBody })
  const dailyCounts = Array.isArray(stats.payload?.data?.dailyCounts)
    ? stats.payload.data.dailyCounts
    : null
  const distribution = Array.isArray(stats.payload?.data?.durationDistribution)
    ? stats.payload.data.durationDistribution
    : null
  const statsOk = stats.status === 200 && stats.payload?.code === 200 && dailyCounts !== null && distribution !== null
  record(
    'task-statistics-default',
    statsOk,
    `HTTP ${stats.status} code=${stats.payload?.code} dailyCounts=${dailyCounts?.length ?? 'n/a'} durationDistribution=${distribution?.length ?? 'n/a'} 窗口=${winStart.format('YYYY-MM-DD')}~${winEnd.format('YYYY-MM-DD')}`,
  )

  if (statsOk) {
    // 行形态：date 归一化 + 计数字段类型
    const dateRe = /^\d{4}-\d{2}-\d{2}/
    const badDate = dailyCounts.filter((d) => typeof d.date !== 'string' || !dateRe.test(d.date))
    const badCount = dailyCounts.filter((d) =>
      ['created', 'completed', 'cancelled', 'failed', 'createdSucceededCount', 'createdSucceededDurationSeconds'].some(
        (k) => d[k] !== undefined && (typeof d[k] !== 'number' || d[k] < 0),
      ),
    )
    record(
      'task-row-shape',
      badDate.length === 0 && badCount.length === 0,
      `date 非法行=${badDate.length}（${JSON.stringify(badDate.slice(0, 2).map((d) => d.date))}）；计数字段非法行=${badCount.length}；首行 ${JSON.stringify(dailyCounts[0] ?? null)}`,
    )

    // label 归一化映射固定 6 桶（未知桶防御丢弃，页面同口径）
    const buckets = new Set()
    let unknownBuckets = 0
    for (const b of distribution) {
      const key = DURATION_LABEL_TO_BUCKET[normalizeDurationLabel(b.label)]
      if (key) buckets.add(key)
      else unknownBuckets += 1
    }
    record(
      'task-duration-buckets',
      unknownBuckets === 0,
      `命中固定桶=${buckets.size}/6 未知桶=${unknownBuckets}（label 原样：${JSON.stringify(distribution.slice(0, 8).map((b) => b.label))}）`,
    )

    // 前端汇总口径试算互证（页面 buildTaskStatistics 同口径，供 UI KPI/明细对照）
    const dailyIndex = new Map()
    for (const day of dailyCounts) {
      const dateStr = typeof day?.date === 'string' ? day.date.slice(0, 10) : ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) dailyIndex.set(dateStr, day)
    }
    let completed = 0, failed = 0, canceled = 0, succeededCount = 0, succeededSeconds = 0
    let filledDays = 0, missingDays = 0
    const startDay = winStart.startOf('day')
    const totalDays = winEnd.startOf('day').diff(startDay, 'day') + 1
    for (let i = 0; i < totalDays; i++) {
      const day = dailyIndex.get(startDay.add(i, 'day').format('YYYY-MM-DD'))
      if (!day) { missingDays += 1; continue }
      filledDays += 1
      completed += day.completed ?? 0
      failed += day.failed ?? 0
      canceled += day.cancelled ?? 0
      succeededCount += day.createdSucceededCount ?? 0
      succeededSeconds += day.createdSucceededDurationSeconds ?? 0
    }
    const totalCount = completed + failed + canceled
    const completionRate = totalCount > 0 ? completed / totalCount : null
    const avgMs = succeededCount > 0 ? Math.round((succeededSeconds / succeededCount) * 1000) : null
    record(
      'task-kpi-summary',
      true,
      `试算（页面同口径）：窗口天=${totalDays} 接口下发天=${filledDays} 补零天=${missingDays} totalCount=${totalCount} completed=${completed} failed=${failed} canceled=${canceled} completionRate=${completionRate === null ? 'null(总数0)' : completionRate.toFixed(4)} averageCompletedDurationMs=${avgMs === null ? 'null(分母0)' : avgMs}（供 UI 对照）`,
    )
  }

  // ---- 4. 车辆筛选对照（取真实车辆一个；车辆筛选仅任务统计链路消费） ----------
  const simple = await call('GET', '/fms/v1/dispatcher/vehicle/getSimpleVehicles', { token })
  const vehicles = Array.isArray(simple.payload?.data) ? simple.payload.data : []
  record(
    'simple-vehicles',
    simple.status === 200 && simple.payload?.code === 200,
    `HTTP ${simple.status} code=${simple.payload?.code} vehicles=${vehicles.length}`,
  )
  if (vehicles.length > 0) {
    const oneKey = vehicles[0].key
    const filtered = await call('POST', TASK_STATS, {
      token,
      body: { startTime: winStart.format(FMT), endTime: winEnd.format(FMT), vehicleKeys: [oneKey] },
    })
    const fRows = Array.isArray(filtered.payload?.data?.dailyCounts) ? filtered.payload.data.dailyCounts : []
    record(
      'task-filter-vehicle',
      filtered.status === 200 && filtered.payload?.code === 200,
      `vehicleKeys=[${JSON.stringify(oneKey)}] → HTTP ${filtered.status} code=${filtered.payload?.code} dailyCounts=${fRows.length}`,
    )
  }

  // ---- 5. 每日状态时长（有效状态三元组；利用率趋势数据源） ---------------------
  const dailyBody = { startTime: winStart.format(FMT), endTime: winEnd.format(FMT), byHour: false, states: EFFECTIVE_WORK_STATES }
  const daily = await call('POST', DAILY_STATS, { token, body: dailyBody })
  const dailyRows = Array.isArray(daily.payload?.data?.dailyStateDurations)
    ? daily.payload.data.dailyStateDurations
    : null
  const dailyOk = daily.status === 200 && daily.payload?.code === 200 && dailyRows !== null
  record(
    'daily-state-effective',
    dailyOk,
    `HTTP ${daily.status} code=${daily.payload?.code} dailyStateDurations=${dailyRows?.length ?? 'n/a'} 首行 ${JSON.stringify(dailyRows?.[0] ?? null)}`,
  )
  if (dailyOk && dailyRows.length > 0) {
    // 趋势口径试算（首天）：utilization = 总时长 ÷（当天窗口交集秒 × vehicleCount）
    const first = dailyRows[0]
    const dayStr = typeof first.date === 'string' ? first.date.slice(0, 10) : ''
    const dayStart = dayjs.tz(dayStr, DEPLOY_TZ).startOf('day')
    const dayEnd = dayStart.add(1, 'day')
    const effectiveEnd = winEnd.isBefore(now) ? winEnd : now
    const overlapStart = dayStart.isAfter(winStart) ? dayStart : winStart
    const overlapEnd = dayEnd.isBefore(effectiveEnd) ? dayEnd : effectiveEnd
    const overlapSeconds = overlapEnd.diff(overlapStart, 'second')
    const vc = first.vehicleCount
    const trendUtil =
      overlapSeconds > 0 && typeof vc === 'number' && vc > 0
        ? (first.totalDurationSeconds ?? 0) / (overlapSeconds * vc)
        : null
    record(
      'trend-utilization-summary',
      true,
      `试算（页面同口径，首天 ${dayStr}）：overlapSeconds=${overlapSeconds} vehicleCount=${JSON.stringify(vc)} totalDurationSeconds=${first.totalDurationSeconds} utilization=${trendUtil === null ? 'null(不可计算)' : trendUtil.toFixed(4)}（供 UI 对照）`,
    )
  }

  // ---- 6. 每车有效状态时长（利用率排行数据源） --------------------------------
  const exec = await call('POST', EXEC_STATS, { token, body: dailyBody })
  const execRows = Array.isArray(exec.payload?.data?.vehicleExecutingDurations)
    ? exec.payload.data.vehicleExecutingDurations
    : null
  const execOk = exec.status === 200 && exec.payload?.code === 200 && execRows !== null
  record(
    'executing-time-effective',
    execOk,
    `HTTP ${exec.status} code=${exec.payload?.code} vehicleExecutingDurations=${execRows?.length ?? 'n/a'}`,
  )
  if (execOk && execRows.length > 0) {
    // 排行口径试算（页面层组合 P37 聚合 + P35 换算同口径）：activeSeconds/windowSeconds
    const byVehicle = new Map()
    for (const r of execRows) {
      if (!EFFECTIVE_WORK_STATES.includes(r.state)) continue
      byVehicle.set(r.vehicleKey, (byVehicle.get(r.vehicleKey) ?? 0) + (r.totalDurationSeconds ?? 0))
    }
    const effectiveEnd = winEnd.isBefore(now) ? winEnd : now
    const windowSeconds = Math.max(0, effectiveEnd.diff(winStart, 'second'))
    const top = [...byVehicle.entries()].sort((a, b) => b[1] - a[1])[0]
    const topUtil = windowSeconds > 0 ? top[1] / windowSeconds : null
    record(
      'rank-utilization-summary',
      true,
      `试算（页面同口径）：有效车辆数=${byVehicle.size} windowSeconds=${windowSeconds} 首名 vehicleKey=${JSON.stringify(top[0])} activeSeconds=${top[1]} utilization=${topUtil === null ? 'null(分母0)' : topUtil.toFixed(4)}（供 UI 对照）`,
    )
  }

  // ---- 7. 无令牌对照 ---------------------------------------------------------
  const noToken = await call('POST', TASK_STATS, { body: statsBody })
  record(
    'task-no-token',
    noToken.payload?.code !== 200,
    `HTTP ${noToken.status} code=${noToken.payload?.code} message=${String(noToken.payload?.message ?? '')}`,
  )
} finally {
  // ---- 8. 登出清理 -----------------------------------------------------------
  const logout = await call('POST', LOGOUT, { token })
  record('logout', logout.status === 200, `HTTP ${logout.status} code=${logout.payload?.code}`)
}

const ok = checks.every((c) => c.ok)
const result = { ok, checkedAt: new Date().toISOString(), base, checks }
writeFileSync(new URL('./readonly-result.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ ok, total: checks.length }))
if (!ok) process.exit(2)
