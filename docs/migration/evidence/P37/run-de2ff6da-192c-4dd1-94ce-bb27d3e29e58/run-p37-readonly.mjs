/**
 * P37 车辆状态统计页：真实只读联调脚本（无业务写副作用）。
 *
 * 覆盖（两个 POST 均为统计聚合查询，按业务语义分类为只读）：
 * 1. 登录（MD5 摘要，G03 已确认形态）→ token；
 * 2. agvExecutingTimeStatistics 默认窗口（近 7 个自然日）→ code=200 +
 *    vehicleExecutingDurations 行形态（vehicleKey/vehicleName/state 枚举/
 *    totalDurationSeconds number 秒）；前端同口径试算互证：groupByVehicle 车辆数、
 *    workSeconds/trafficSeconds/errorSeconds、利用率（窗口秒数截断）、平均时长
 *    （分母=车辆数）——供 UI KPI 对照；
 * 3. 状态集合筛选 states=['ERROR'] → 全部行 state=ERROR（协议「状态由参数指定」）；
 * 4. byHour=true + 窗口 ≤24h → code=200（小时维度可用）；
 *    byHour=true + 窗口 >24h → 记录后端真实拒绝形态（前端已拦截，仅对照约束）；
 * 5. agvStateStatistics（P35 消费的服务层）→ code=200 + dailyStateDurations 行形态
 *    （date/totalDurationSeconds/vehicleCount，按天升序）；
 * 6. 无令牌对照：agvExecutingTimeStatistics 拒绝（记录真实拒绝形态，不作为缺陷）；
 * 7. 登出清理本轮会话。
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_TEST_USERNAME / APEX_TEST_PASSWORD）
 * 读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-p37-readonly.mjs [baseUrl]（缺省 http://localhost:5173）
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

const EXEC_STATS = '/fms/v1/report/vehicleStatisticsReport/agvExecutingTimeStatistics'
const DAILY_STATS = '/fms/v1/report/vehicleStatisticsReport/agvStateStatistics'
const LOGOUT = '/fms/v1/auth/authorize/logout'
const DEPLOY_TZ = 'Asia/Shanghai'
const FMT = 'YYYY-MM-DD HH:mm:ss'
const KNOWN_STATES = new Set([
  'ONLINE', 'OFFLINE', 'IDLE', 'EXECUTING_WORK', 'EXECUTING_CHARGE', 'EXECUTING_PARK',
  'TRAFFIC', 'PAUSED', 'AVOID', 'BRAKE', 'WARNING', 'ERROR', 'CHARGING',
])

// 默认统计窗口：近 7 个自然日（页面 defaultRange 同口径）
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
  // ---- 2. 每车各状态总时长（默认窗口） --------------------------------------
  const execBody = { startTime: winStart.format(FMT), endTime: winEnd.format(FMT) }
  const exec = await call('POST', EXEC_STATS, { token, body: execBody })
  const rows = Array.isArray(exec.payload?.data?.vehicleExecutingDurations)
    ? exec.payload.data.vehicleExecutingDurations
    : null
  const execOk = exec.status === 200 && exec.payload?.code === 200 && rows !== null
  record(
    'executing-time-statistics',
    execOk,
    `HTTP ${exec.status} code=${exec.payload?.code} vehicleExecutingDurations=${rows?.length ?? 'n/a'} 窗口=${winStart.format('YYYY-MM-DD')}~${winEnd.format('YYYY-MM-DD')}`,
  )

  if (execOk) {
    // 行形态：state 枚举值域 + totalDurationSeconds 非负整数秒（int64 JSON number）
    const badState = rows.filter((r) => r.state !== undefined && !KNOWN_STATES.has(r.state))
    const badSeconds = rows.filter(
      (r) => r.totalDurationSeconds !== undefined &&
        (typeof r.totalDurationSeconds !== 'number' || r.totalDurationSeconds < 0 || !Number.isInteger(r.totalDurationSeconds)),
    )
    record(
      'exec-row-shape',
      badState.length === 0 && badSeconds.length === 0,
      `state 未知枚举行=${badState.length}（${JSON.stringify(badState.slice(0, 2).map((r) => r.state))}，未知枚举页面显示原值）；totalDurationSeconds 非法行=${badSeconds.length}`,
    )

    // 前端同口径试算互证（statistics.ts/selectors.ts 的聚合公式，供 UI KPI 对照）
    const vehicleKeys = new Set(rows.map((r) => r.vehicleKey))
    const sumOf = (state) =>
      rows.reduce((sum, r) => (r.state === state ? sum + (r.totalDurationSeconds ?? 0) : sum), 0)
    const workSeconds = sumOf('EXECUTING_WORK')
    const trafficSeconds = sumOf('TRAFFIC')
    const errorSeconds = sumOf('ERROR')
    const vehicleCount = vehicleKeys.size
    // 窗口秒数：终点超过当前时刻截断（页面 computeWindowSeconds 同口径）
    const effectiveEnd = winEnd.isBefore(now) ? winEnd : now
    const windowSeconds = Math.max(0, effectiveEnd.diff(winStart, 'second'))
    const utilization = windowSeconds > 0 ? workSeconds / windowSeconds : null
    const avg = (seconds) => (vehicleCount > 0 ? (seconds / vehicleCount) * 1000 : null)
    record(
      'exec-kpi-summary',
      true,
      `试算（页面同口径）：vehicleCount=${vehicleCount} workSeconds=${workSeconds} trafficSeconds=${trafficSeconds} errorSeconds=${errorSeconds} utilization=${utilization === null ? 'null(分母0)' : utilization.toFixed(4)} avgTrafficMs=${avg(trafficSeconds) === null ? 'null' : Math.round(avg(trafficSeconds))} avgWorkMs=${avg(workSeconds) === null ? 'null' : Math.round(avg(workSeconds))} avgErrorMs=${avg(errorSeconds) === null ? 'null' : Math.round(avg(errorSeconds))}（供 UI 对照）`,
    )
    const sample = rows[0]
    record(
      'exec-first-row',
      true,
      sample
        ? `首行 vehicleKey=${JSON.stringify(sample.vehicleKey)} vehicleName=${JSON.stringify(sample.vehicleName)} state=${sample.state} totalDurationSeconds=${sample.totalDurationSeconds}`
        : '窗口内无任何状态记录（真实空结果，页面显示空态/“--”）',
    )
  }

  // ---- 3. 状态集合筛选 states=['ERROR'] -------------------------------------
  const errBody = { startTime: winStart.format(FMT), endTime: winEnd.format(FMT), states: ['ERROR'] }
  const errOnly = await call('POST', EXEC_STATS, { token, body: errBody })
  const errRows = Array.isArray(errOnly.payload?.data?.vehicleExecutingDurations)
    ? errOnly.payload.data.vehicleExecutingDurations
    : []
  const allError = errRows.every((r) => r.state === 'ERROR')
  record(
    'exec-filter-states',
    errOnly.payload?.code === 200 && allError,
    `states=['ERROR'] → ${errRows.length} 行全部 ERROR=${allError}`,
  )

  // ---- 4. byHour 边界 ---------------------------------------------------------
  const hourStart = now.subtract(1, 'hour').startOf('hour')
  const hourBody = { startTime: hourStart.format(FMT), endTime: now.format(FMT), byHour: true }
  const byHourOk = await call('POST', EXEC_STATS, { token, body: hourBody })
  record(
    'exec-by-hour-within-24h',
    byHourOk.status === 200 && byHourOk.payload?.code === 200,
    `byHour=true 窗口 1 小时 → HTTP ${byHourOk.status} code=${byHourOk.payload?.code}`,
  )
  const overBody = { startTime: winStart.format(FMT), endTime: winEnd.format(FMT), byHour: true }
  const over = await call('POST', EXEC_STATS, { token, body: overBody })
  record(
    'exec-by-hour-over-24h',
    true,
    `byHour=true 窗口 7 天 → HTTP ${over.status} code=${over.payload?.code} message=${String(over.payload?.message ?? '')}（后端约束对照；前端已在查询前拦截并提示，不发该请求）`,
  )

  // ---- 5. 每日状态时长统计（P35 消费的服务层） -------------------------------
  const daily = await call('POST', DAILY_STATS, { token, body: execBody })
  const dailyRows = Array.isArray(daily.payload?.data?.dailyStateDurations)
    ? daily.payload.data.dailyStateDurations
    : null
  const dailyOk = daily.status === 200 && daily.payload?.code === 200 && dailyRows !== null
  let dailySorted = true
  if (dailyOk) {
    for (let i = 1; i < dailyRows.length; i += 1) {
      if (String(dailyRows[i - 1].date) > String(dailyRows[i].date)) {
        dailySorted = false
        break
      }
    }
  }
  record(
    'daily-state-statistics',
    dailyOk,
    `HTTP ${daily.status} code=${daily.payload?.code} dailyStateDurations=${dailyRows?.length ?? 'n/a'} 按天升序=${dailySorted}；首行 ${JSON.stringify(dailyRows?.[0] ?? null)}`,
  )

  // ---- 6. 无令牌对照 ---------------------------------------------------------
  const noToken = await call('POST', EXEC_STATS, { body: execBody })
  record(
    'exec-no-token',
    noToken.payload?.code !== 200,
    `HTTP ${noToken.status} code=${noToken.payload?.code} message=${String(noToken.payload?.message ?? '')}`,
  )
} finally {
  // ---- 7. 登出清理 -----------------------------------------------------------
  const logout = await call('POST', LOGOUT, { token })
  record('logout', logout.status === 200, `HTTP ${logout.status} code=${logout.payload?.code}`)
}

const ok = checks.every((c) => c.ok)
const result = { ok, checkedAt: new Date().toISOString(), base, checks }
writeFileSync(new URL('./readonly-result.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ ok, total: checks.length }))
if (!ok) process.exit(2)
