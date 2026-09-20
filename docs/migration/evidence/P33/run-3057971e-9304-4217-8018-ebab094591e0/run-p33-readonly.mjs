/**
 * P33 任务统计：真实只读联调脚本（无业务写副作用）。
 *
 * 覆盖（查询性质 POST 按业务语义分类为只读统计查询）：
 * 1. 登录（MD5 摘要，G03 已确认形态）→ token/activated；
 * 2. POST /fms/v1/report/orderStatisticsReport/orderQuantityStatistics 默认参数
 *    （startTime/endTime 空串=不限，等价旧实现初始条件）→ code=200 + 数组；
 * 3. 同接口带筛选（orderTypes/orderStates 收敛）→ code=200，且返回行的
 *    类型/状态取值均落在筛选集合内（等价性抽查）；
 * 4. POST /fms/v1/report/orderStatisticsReport/orderEfficiencyStatistics 默认参数
 *    → code=200 + 数组，行结构三平均值（秒）+ 类型；数值非负抽查；
 * 5. GET /fms/v1/dispatcher/vehicle/getSimpleVehicles（共享选项契约）→ code=200；
 * 6. 无令牌对照：统计接口拒绝（记录真实拒绝形态，不作为缺陷）；
 * 7. 登出清理本轮会话。
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_DEV_LEGACY_TARGET /
 * APEX_TEST_USERNAME / APEX_TEST_PASSWORD）读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-p33-readonly.mjs [baseUrl]（缺省 http://localhost:5173）
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

const QUANTITY = '/fms/v1/report/orderStatisticsReport/orderQuantityStatistics'
const EFFICIENCY = '/fms/v1/report/orderStatisticsReport/orderEfficiencyStatistics'
const SIMPLE_VEHICLES = '/fms/v1/dispatcher/vehicle/getSimpleVehicles'

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

// ---- 2. 数量统计：默认参数（旧初始条件等价：时间空串、无集合字段） ------------
const q0 = await call('POST', QUANTITY, { token, body: { startTime: '', endTime: '' } })
const q0rows = Array.isArray(q0.payload?.data) ? q0.payload.data : null
const q0ok = q0.status === 200 && q0.payload?.code === 200 && q0rows !== null
record(
  'quantity-default',
  q0ok,
  `HTTP ${q0.status} code=${q0.payload?.code} rows=${q0rows?.length ?? 'n/a'}`,
)

// ---- 3. 数量统计：带筛选（类型 WORK + 状态 SUCCEEDED），返回行应落在筛选内 ----
const q1 = await call('POST', QUANTITY, {
  token,
  body: { startTime: '', endTime: '', orderTypes: ['WORK'], orderStates: ['SUCCEEDED'] },
})
const q1rows = Array.isArray(q1.payload?.data) ? q1.payload.data : null
const q1ok =
  q1.status === 200 &&
  q1.payload?.code === 200 &&
  q1rows !== null &&
  q1rows.every((r) => r.orderType === 'WORK' && r.orderState === 'SUCCEEDED') &&
  q1rows.every((r) => typeof r.number === 'number' && Number.isInteger(r.number) && r.number >= 0)
record(
  'quantity-filtered-equivalence',
  q1ok,
  `HTTP ${q1.status} code=${q1.payload?.code} rows=${q1rows?.length ?? 'n/a'} types=${[...new Set((q1rows ?? []).map((r) => r.orderType))].join('|')} states=${[...new Set((q1rows ?? []).map((r) => r.orderState))].join('|')}`,
)

// ---- 4. 效率统计：默认参数（契约无 orderStates，body 仅时间/类型/车辆） --------
const e0 = await call('POST', EFFICIENCY, { token, body: { startTime: '', endTime: '' } })
const e0rows = Array.isArray(e0.payload?.data) ? e0.payload.data : null
const e0ok =
  e0.status === 200 &&
  e0.payload?.code === 200 &&
  e0rows !== null &&
  e0rows.every(
    (r) =>
      typeof r.orderType === 'string' &&
      [r.orderAverageTime, r.orderAverageExecutionTime, r.orderAverageWaitTime].every(
        (v) => v === undefined || v === null || (typeof v === 'number' && v >= 0),
      ),
  )
record(
  'efficiency-default',
  e0ok,
  `HTTP ${e0.status} code=${e0.payload?.code} rows=${e0rows?.length ?? 'n/a'} types=${[...new Set((e0rows ?? []).map((r) => r.orderType))].join('|')}`,
)

// ---- 5. 效率统计：带类型筛选（WORK），返回行类型应收敛 ------------------------
const e1 = await call('POST', EFFICIENCY, {
  token,
  body: { startTime: '', endTime: '', orderTypes: ['WORK'] },
})
const e1rows = Array.isArray(e1.payload?.data) ? e1.payload.data : null
const e1ok =
  e1.status === 200 &&
  e1.payload?.code === 200 &&
  e1rows !== null &&
  e1rows.every((r) => r.orderType === 'WORK')
record(
  'efficiency-filtered-equivalence',
  e1ok,
  `HTTP ${e1.status} code=${e1.payload?.code} rows=${e1rows?.length ?? 'n/a'} types=${[...new Set((e1rows ?? []).map((r) => r.orderType))].join('|')}`,
)

// ---- 6. 车辆选项（共享契约，图表筛选下拉消费） --------------------------------
const v = await call('GET', SIMPLE_VEHICLES, { token })
const vrows = Array.isArray(v.payload?.data) ? v.payload.data : null
const vOk = v.status === 200 && v.payload?.code === 200 && vrows !== null
record('simple-vehicles', vOk, `HTTP ${v.status} code=${v.payload?.code} items=${vrows?.length ?? 'n/a'}`)

// ---- 7. 无令牌对照（记录真实拒绝形态；统计接口受认证保护） ---------------------
const anon = await call('POST', QUANTITY, { body: { startTime: '', endTime: '' } })
const anonOk = anon.status !== 200 || anon.payload?.code !== 200
record(
  'quantity-no-token-rejected',
  anonOk,
  `HTTP ${anon.status} code=${anon.payload?.code} message=${anon.payload?.message ?? ''}`,
)

// ---- 8. 登出（清理本轮会话） --------------------------------------------------
const out = await call('POST', '/fms/v1/auth/authorize/logout', { token })
record('logout', out.status === 200, `HTTP ${out.status} code=${out.payload?.code}`)

const ok = checks.every((c) => c.ok)
const summary = {
  ok,
  taskId: 'P33',
  runId: process.env.APEX_RUN_ID ?? 'run-p33-readonly',
  checkedAt: new Date().toISOString(),
  baseUrl: base,
  checks,
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'readonly-result.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
process.exit(ok ? 0 : 1)
