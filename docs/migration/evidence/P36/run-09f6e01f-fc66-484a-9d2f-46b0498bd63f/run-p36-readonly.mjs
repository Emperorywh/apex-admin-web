/**
 * P36 故障告警页：真实只读联调脚本（无业务写副作用）。
 *
 * 覆盖（两个 POST 均为查询性质，按业务语义分类为只读）：
 * 1. 登录（MD5 摘要，G03 已确认形态）→ token；
 * 2. POST /fms/v1/report/systemAlarmRecord/alarmStatistics（默认窗口近 14 天 +
 *    topAgvDate=窗口最后一天 00:00:00）→ code=200 + dailyAlarmCounts/topAgvAlarms；
 *    前端同口径试算互证：faultCount=Σ(closed+unclosed)、openAlertCount=Σunclosed、
 *    closedRate/avgDuration 分母为 0 时 null；dailyAlarmCounts 覆盖日期 ⊆ 窗口；
 * 3. alarmStatistics 仅窗口（不传 topAgvDate）→ topAgvAlarms 为空（不查该维度）；
 * 4. pageSystemAlarmRecords 全量页 → records/total 结构 + 行字段形态
 *    （id/alarmLevel 枚举/isClosed 布尔/未关闭行 durationSeconds 缺失）；
 * 5. 筛选语义：isClosed=true 全部已关闭；alarmLevel=WARNING 全部该级别；
 *    isClosed=false（显式 false 有效值，防「|| undefined 吞 false」回归）；
 * 6. 无令牌对照：alarmStatistics 拒绝（记录真实拒绝形态，不作为缺陷）；
 * 7. 登出清理本轮会话。
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_TEST_USERNAME / APEX_TEST_PASSWORD）
 * 读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-p36-readonly.mjs [baseUrl]（缺省 http://localhost:5173）
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

const ALARM_STATS = '/fms/v1/report/systemAlarmRecord/alarmStatistics'
const ALARM_PAGE = '/fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords'
const LOGOUT = '/fms/v1/auth/authorize/logout'
const DEPLOY_TZ = 'Asia/Shanghai'
const FMT = 'YYYY-MM-DD HH:mm:ss'

// 默认统计窗口：近 14 个自然日（页面 initialStatRange 同口径）
const now = dayjs().tz(DEPLOY_TZ)
const winStart = now.subtract(13, 'day').startOf('day')
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
  // ---- 2. 聚合统计（默认窗口 + topAgvDate） ---------------------------------
  const statsBody = {
    startTime: winStart.format(FMT),
    endTime: winEnd.format(FMT),
    topAgvDate: winEnd.startOf('day').format(FMT),
  }
  const stats = await call('POST', ALARM_STATS, { token, body: statsBody })
  const vo = stats.payload?.data
  const daily = Array.isArray(vo?.dailyAlarmCounts) ? vo.dailyAlarmCounts : null
  const top = Array.isArray(vo?.topAgvAlarms) ? vo.topAgvAlarms : null
  const statsOk =
    stats.status === 200 && stats.payload?.code === 200 && daily !== null && top !== null
  record(
    'alarm-statistics',
    statsOk,
    `HTTP ${stats.status} code=${stats.payload?.code} dailyAlarmCounts=${daily?.length ?? 'n/a'} topAgvAlarms=${top?.length ?? 'n/a'} 窗口=${winStart.format('YYYY-MM-DD')}~${winEnd.format('YYYY-MM-DD')}`,
  )

  // 前端同口径试算互证（statistics.ts 的汇总公式）
  if (statsOk) {
    let faultCount = 0
    let openAlertCount = 0
    let closedTotal = 0
    let totalDurationSeconds = 0
    const badRows = []
    for (const day of daily) {
      const dateStr = typeof day?.date === 'string' ? day.date.slice(0, 10) : ''
      const inWindow = dateStr >= winStart.format('YYYY-MM-DD') && dateStr <= winEnd.format('YYYY-MM-DD')
      if (!inWindow) {
        badRows.push(dateStr)
        continue
      }
      const closed = day?.closedCount ?? 0
      const unclosed = day?.unclosedCount ?? 0
      faultCount += closed + unclosed
      openAlertCount += unclosed
      closedTotal += closed
      totalDurationSeconds += day?.totalDurationSeconds ?? 0
    }
    record(
      'stats-window-scope',
      badRows.length === 0,
      badRows.length === 0
        ? `dailyAlarmCounts 全部落在窗口内（${daily.length} 天）`
        : `窗口外异常下发天：${JSON.stringify(badRows)}（前端将忽略）`,
    )
    const closedRate = faultCount > 0 ? closedTotal / faultCount : null
    const avgMs = faultCount > 0 ? (totalDurationSeconds / faultCount) * 1000 : null
    record(
      'stats-kpi-summary',
      true,
      `试算（statistics.ts 同口径）：faultCount=${faultCount} openAlertCount=${openAlertCount} closedRate=${closedRate === null ? 'null(分母0)' : closedRate.toFixed(4)} avgDurationMs=${avgMs === null ? 'null(分母0)' : Math.round(avgMs)}（供 UI 对照）`,
    )
    const topSorted = top.every(
      (item, i) => i === 0 || (top[i - 1]?.alarmCount ?? 0) >= (item?.alarmCount ?? 0),
    )
    record(
      'stats-top-order',
      top.length <= 1 || topSorted,
      `topAgvAlarms ${top.length} 行${top.length && topSorted ? ' 按次数倒序' : ''}；首行 ${JSON.stringify(top[0] ?? null)}`,
    )
  }

  // ---- 3. 聚合统计：不传 topAgvDate（不查该维度） ----------------------------
  const statsNoTop = await call('POST', ALARM_STATS, {
    token,
    body: { startTime: winStart.format(FMT), endTime: winEnd.format(FMT) },
  })
  const voNoTop = statsNoTop.payload?.data
  const noTopOk =
    statsNoTop.status === 200 &&
    statsNoTop.payload?.code === 200 &&
    Array.isArray(voNoTop?.dailyAlarmCounts) &&
    (voNoTop?.topAgvAlarms ?? []).length === 0
  record(
    'alarm-statistics-no-top',
    noTopOk,
    `HTTP ${statsNoTop.status} code=${statsNoTop.payload?.code} topAgvAlarms=${JSON.stringify(voNoTop?.topAgvAlarms ?? 'n/a')}（不传 topAgvDate 预期不下发）`,
  )

  // ---- 4. 明细分页：全量页 ---------------------------------------------------
  const page1 = await call('POST', ALARM_PAGE, { token, body: { pageNo: 1, pageSize: 10 } })
  const pageData = page1.payload?.data
  const records = Array.isArray(pageData?.records) ? pageData.records : null
  const total = typeof pageData?.total === 'number' ? pageData.total : null
  const pageOk = page1.status === 200 && page1.payload?.code === 200 && records !== null
  record(
    'alarm-page',
    pageOk,
    `HTTP ${page1.status} code=${page1.payload?.code} records=${records?.length ?? 'n/a'} total=${total ?? 'n/a'}`,
  )
  if (records && records.length > 0) {
    const sample = records[0]
    const levelKnown =
      sample.alarmLevel === 'FATAL' ||
      sample.alarmLevel === 'WARNING' ||
      sample.alarmLevel === undefined ||
      sample.alarmLevel === null
    const idSafe = typeof sample.id === 'number' || typeof sample.id === 'string'
    const durationAbsentWhenOpen = sample.isClosed === false ? sample.durationSeconds === undefined || sample.durationSeconds === null : true
    record(
      'alarm-page-row-shape',
      levelKnown && idSafe && durationAbsentWhenOpen,
      `首行 id=${String(sample.id)}（${typeof sample.id}）level=${String(sample.alarmLevel)} sourceType=${String(sample.sourceType)} isClosed=${String(sample.isClosed)} durationSeconds=${String(sample.durationSeconds)}（未关闭行预期缺失=${durationAbsentWhenOpen}）`,
    )
    const withDescription = records.find((r) => r?.errorModel?.errorDescription)
    record(
      'alarm-page-description',
      true,
      withDescription
        ? `描述样本：errorDescription="${String(withDescription.errorModel.errorDescription).slice(0, 60)}" 译文 ${withDescription.errorModel.errorDescriptionTranslations?.length ?? 0} 条`
        : '本页样本无 errorDescription（真实空，页面留白）',
    )
    const withOrder = records.find((r) => r?.orderKey)
    record(
      'alarm-page-order-link',
      true,
      withOrder
        ? `关联任务样本：orderKey=${String(withOrder.orderKey)} orderName=${String(withOrder.orderName)}（导航候选）`
        : '本页样本无 orderKey（导航列留白，真实空结果）',
    )
  }

  // ---- 5. 筛选语义 -----------------------------------------------------------
  const closedPage = await call('POST', ALARM_PAGE, {
    token,
    body: { pageNo: 1, pageSize: 10, isClosed: true },
  })
  const closedRecords = Array.isArray(closedPage.payload?.data?.records)
    ? closedPage.payload.data.records
    : []
  const allClosed = closedRecords.every((r) => r.isClosed === true)
  record(
    'alarm-page-filter-closed',
    closedPage.payload?.code === 200 && allClosed,
    `isClosed=true → ${closedRecords.length} 行全部已关闭=${allClosed}`,
  )

  const openPage = await call('POST', ALARM_PAGE, {
    token,
    body: { pageNo: 1, pageSize: 10, isClosed: false },
  })
  const openRecords = Array.isArray(openPage.payload?.data?.records)
    ? openPage.payload.data.records
    : []
  const allOpen = openRecords.every((r) => r.isClosed === false)
  record(
    'alarm-page-filter-explicit-false',
    openPage.payload?.code === 200 && allOpen,
    `isClosed=false（显式 false 有效值）→ ${openRecords.length} 行全部未关闭=${allOpen}`,
  )

  const warnPage = await call('POST', ALARM_PAGE, {
    token,
    body: { pageNo: 1, pageSize: 10, alarmLevel: 'WARNING' },
  })
  const warnRecords = Array.isArray(warnPage.payload?.data?.records)
    ? warnPage.payload.data.records
    : []
  const allWarn = warnRecords.every((r) => r.alarmLevel === 'WARNING')
  record(
    'alarm-page-filter-level',
    warnPage.payload?.code === 200 && allWarn,
    `alarmLevel=WARNING → ${warnRecords.length} 行全部该级别=${allWarn}`,
  )

  // ---- 6. 无令牌对照 ---------------------------------------------------------
  const noToken = await call('POST', ALARM_STATS, { body: statsBody })
  record(
    'alarm-statistics-no-token',
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
