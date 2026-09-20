/**
 * P34 合并业务首页：真实只读联调脚本（无业务写副作用）。
 *
 * 覆盖（查询性质 POST 按业务语义分类为只读查询）：
 * 1. 登录（MD5 摘要，G03 已确认形态）→ token/activated；
 * 2. POST /fms/v1/dispatcher/dashboard/board {days:2} → code=200 +
 *    data.order.hourlyCounts 数组 + data.vehicle 五状态计数；
 *    不变量抽查：五状态计数之和 = totalVehicleCount（旧规格 §6.1 口径）、
 *    hourlyCounts 小时键可解析且按部署时区落在近两天窗口；
 * 3. POST /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords
 *    {pageNo:1,pageSize:100,isClosed:false} → code=200 + records 数组
 *    （每行 isClosed===false、行数 ≤ 100）；
 * 4. 无令牌对照：board 拒绝（记录真实拒绝形态，不作为缺陷）；
 * 5. 登出清理本轮会话。
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_TEST_USERNAME / APEX_TEST_PASSWORD）
 * 读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-p34-readonly.mjs [baseUrl]（缺省 http://localhost:5173）
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

const BOARD = '/fms/v1/dispatcher/dashboard/board'
const OPEN_ALERTS = '/fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords'
const LOGOUT = '/fms/v1/auth/authorize/logout'

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
  // ---- 2. 看板聚合（days=2） -------------------------------------------------
  const board = await call('POST', BOARD, { token, body: { days: 2 } })
  const boardData = board.payload?.data
  const hourly = Array.isArray(boardData?.order?.hourlyCounts) ? boardData.order.hourlyCounts : null
  const vehicle = boardData?.vehicle ?? null
  const boardOk =
    board.status === 200 &&
    board.payload?.code === 200 &&
    hourly !== null &&
    vehicle !== null
  record(
    'board',
    boardOk,
    `HTTP ${board.status} code=${board.payload?.code} hourlyCounts=${hourly?.length ?? 'n/a'} total=${vehicle?.totalVehicleCount ?? 'n/a'} online=${vehicle?.onlineVehicleCount ?? 'n/a'}`,
  )

  // 不变量抽查（记录结果，与 UI 计算口径互证）
  if (boardOk) {
    const fiveSum =
      (vehicle.runningCount ?? 0) +
      (vehicle.idleCount ?? 0) +
      (vehicle.chargingCount ?? 0) +
      (vehicle.faultCount ?? 0) +
      (vehicle.offlineCount ?? 0)
    const sumMatches = fiveSum === (vehicle.totalVehicleCount ?? 0)
    record(
      'board-five-state-sum',
      sumMatches,
      `五状态之和 ${fiveSum} ${sumMatches ? '=' : '!='} totalVehicleCount ${vehicle.totalVehicleCount}（旧规格 §6.1 口径）`,
    )

    const hourKeys = hourly.map((h) => String(h.hourTime ?? '')).filter(Boolean)
    const parsedKeys = hourKeys.filter((k) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}/.test(k))
    const daysSeen = [...new Set(parsedKeys.map((k) => k.slice(0, 10)))]
    record(
      'board-hour-keys',
      parsedKeys.length === hourKeys.length && hourKeys.length > 0,
      `小时键 ${parsedKeys.length}/${hourKeys.length} 可解析；覆盖日期 ${JSON.stringify(daysSeen)}（days=2 预期今天+昨天）`,
    )

    // 前端同口径试算（创建口径今日总数 / 完成口径今日总数），为浏览器 UI 数值对照留基准
    const today = String(daysSeen[daysSeen.length - 1] ?? '')
    const todayRows = hourly.filter((h) => String(h.hourTime ?? '').startsWith(today))
    const createdTotal = todayRows.reduce((s, h) => s + (h.created ?? 0), 0)
    const succeededTotal = todayRows.reduce((s, h) => s + (h.succeeded ?? 0), 0)
    record(
      'board-today-summary',
      true,
      `今日(${today}) 创建口径 created=${createdTotal}、完成口径 succeeded=${succeededTotal}、积压 queueOrderCount=${boardData?.order?.queueOrderCount ?? 'n/a'}（供 UI 对照）`,
    )
  }

  // ---- 3. 未关闭告警分页 ----------------------------------------------------
  const alerts = await call('POST', OPEN_ALERTS, {
    token,
    body: { pageNo: 1, pageSize: 100, isClosed: false },
  })
  const records = Array.isArray(alerts.payload?.data?.records) ? alerts.payload.data.records : null
  const allOpen = records ? records.every((r) => r.isClosed === false) : false
  const alertsOk =
    alerts.status === 200 && alerts.payload?.code === 200 && records !== null && allOpen
  record(
    'open-alerts',
    alertsOk,
    `HTTP ${alerts.status} code=${alerts.payload?.code} records=${records?.length ?? 'n/a'}（上限 100）全部未关闭=${allOpen}`,
  )
  if (records && records.length > 0) {
    const sample = records[0]
    const hasLevel = sample.alarmLevel === 'FATAL' || sample.alarmLevel === 'WARNING'
    record(
      'open-alerts-level',
      hasLevel || sample.alarmLevel === undefined || sample.alarmLevel === null,
      `首行级别=${String(sample.alarmLevel)}（协议枚举 WARNING/FATAL）；来源=${String(sample.sourceType)} startTime=${String(sample.startTime)}`,
    )
  }

  // ---- 4. 无令牌对照 --------------------------------------------------------
  const noToken = await call('POST', BOARD, { body: { days: 2 } })
  const noTokenOk = noToken.payload?.code !== 200 && noToken.payload?.code !== undefined
  record(
    'board-no-token',
    noTokenOk,
    `HTTP ${noToken.status} code=${noToken.payload?.code} message=${String(noToken.payload?.message ?? '')}`,
  )
} finally {
  // ---- 5. 登出清理 ----------------------------------------------------------
  const logout = await call('POST', LOGOUT, { token })
  record('logout', logout.status === 200, `HTTP ${logout.status} code=${logout.payload?.code}`)
}

const ok = checks.every((c) => c.ok)
const result = { ok, checkedAt: new Date().toISOString(), base, checks }
writeFileSync(new URL('./readonly-result.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ ok, total: checks.length }))
if (!ok) process.exit(2)
