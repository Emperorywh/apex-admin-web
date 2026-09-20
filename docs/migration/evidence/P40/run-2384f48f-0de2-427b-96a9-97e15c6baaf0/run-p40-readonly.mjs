/**
 * P40 服务器资源监控页：真实只读联调脚本（无业务写副作用）。
 *
 * 覆盖（GET serverResource/current 为纯状态查询，业务语义只读）：
 * 1. 无令牌对照：GET /fms/v1/serverResource/current → 记录真实拒绝形态（不作为缺陷）；
 * 2. 登录（MD5 摘要，G03 已确认形态）→ token；
 * 3. 带令牌快照查询 → code=200 + 字段形态核对（systemCpuLoad / systemMemoryUsageRate /
 *    jvmHeapUsageRate number、cpuCores 正整数、内存容量字符串、disks 数组行形态）；
 * 4. 使用率口径判定（G15 登记）：真实样本值域 0~1（比例）或 0~100（百分比），
 *    按前端 normRate 规则换算出归一化结果（供 UI 仪表数值对照）；
 * 5. 连续两次采样对照（模拟轮询节奏）：接口可重复查询、快照随时间更新；
 * 6. 登出清理本轮会话。
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_TEST_USERNAME / APEX_TEST_PASSWORD）
 * 读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-p40-readonly.mjs [baseUrl]（缺省 http://localhost:5173）
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

async function call(method, path, { token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'accept-language': 'zh-CN',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  const contentType = String(res.headers.get('content-type') ?? '')
  const payload = contentType.includes('json') ? await res.json() : null
  return { status: res.status, contentType, payload }
}

const CURRENT = '/fms/v1/serverResource/current'
const LOGIN = '/fms/v1/auth/authorize/login'
const LOGOUT = '/fms/v1/auth/authorize/logout'

/** 前端 normRate 同口径换算（resourcePolicy.ts）：缺失/非法 → null；0~1 → ×100 */
function normRate(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n >= 0 && n <= 1) return Math.min(100, Math.max(0, n * 100))
  return Math.min(100, Math.max(0, n))
}

// ---- 1. 无令牌对照（先于登录，记录真实拒绝形态） -----------------------------
const noToken = await call('GET', CURRENT)
record(
  'current-no-token',
  noToken.payload?.code !== 200,
  `HTTP ${noToken.status} code=${noToken.payload?.code} message=${String(noToken.payload?.message ?? '')}`,
)

// ---- 2. 登录 ----------------------------------------------------------------
const md5 = createHash('md5').update(password).digest('hex')
const loginRes = await fetch(`${base}${LOGIN}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'accept-language': 'zh-CN' },
  body: JSON.stringify({ username, password: md5 }),
})
const loginPayload = await loginRes.json()
const loginOk =
  loginRes.status === 200 &&
  loginPayload?.code === 200 &&
  typeof loginPayload?.data?.token === 'string' &&
  loginPayload.data.token !== ''
record('login', loginOk, `HTTP ${loginRes.status} code=${loginPayload?.code} activated=${loginPayload?.data?.activated}`)
if (!loginOk) process.exit(1)
const token = loginPayload.data.token

try {
  // ---- 3. 带令牌快照查询 + 字段形态核对 --------------------------------------
  const snap1 = await call('GET', CURRENT, { token })
  const data = snap1.payload?.data
  const snapOk = snap1.status === 200 && snap1.payload?.code === 200 && data !== null && data !== undefined
  record(
    'current-with-token',
    snapOk,
    `HTTP ${snap1.status} code=${snap1.payload?.code} hasData=${Boolean(data)} timestamp=${snap1.payload?.timestamp ?? 'n/a'}`,
  )

  if (snapOk) {
    // 数值字段形态：三个使用率应可转 number（缺失亦如实记录——页面显示「--」不补 0）
    const rateFields = ['systemCpuLoad', 'systemMemoryUsageRate', 'jvmHeapUsageRate']
    const rateDetail = rateFields.map((f) => {
      const v = data[f]
      return `${f}=${v === undefined ? 'missing' : JSON.stringify(v)} → normRate=${normRate(v) === null ? 'null(不可计算)' : normRate(v).toFixed(1)}%`
    })
    const ratesNumeric = rateFields.every((f) => data[f] === undefined || typeof data[f] === 'number')
    // 口径判定：0~1 视为比例 ×100；>1 视为百分数（G15 登记，供 UI 对照）
    const allInRange = rateFields.every((f) => {
      const v = data[f]
      return v === undefined || v === null || (typeof v === 'number' && v >= 0 && v <= 100)
    })
    record(
      'rate-fields-shape',
      ratesNumeric && allInRange,
      `${rateDetail.join('；')}；口径=0~100 百分比域内=${allInRange}（G15：前端双口径兼容，真实样本如上）`,
    )

    // cpuCores：正整数或缺失
    const coresOk =
      data.cpuCores === undefined ||
      data.cpuCores === null ||
      (Number.isInteger(data.cpuCores) && data.cpuCores > 0)
    record('cpu-cores', coresOk, `cpuCores=${data.cpuCores === undefined ? 'missing' : data.cpuCores}`)

    // 容量字段：后端格式化字符串（如「15.6 GB」），页面透传不做换算
    const memFields = ['systemMemoryTotal', 'systemMemoryUsed', 'systemMemoryFree', 'jvmHeapMax', 'jvmHeapUsed']
    const memDetail = memFields.map((f) => `${f}=${data[f] === undefined ? 'missing' : JSON.stringify(data[f])}`).join(' ')
    const memStrLike = memFields.every((f) => data[f] === undefined || data[f] === null || typeof data[f] === 'string')
    record('memory-capacity-strings', memStrLike, `${memDetail}（后端格式化字符串，前端透传）`)

    // disks：数组行形态
    const disks = data.disks
    const disksIsArray = disks === undefined || disks === null || Array.isArray(disks)
    const badRows = Array.isArray(disks)
      ? disks.filter(
          (d) =>
            (d.usageRate !== undefined && d.usageRate !== null && typeof d.usageRate !== 'number') ||
            (d.total !== undefined && d.total !== null && typeof d.total !== 'string') ||
            (d.mountPath === undefined && d.device === undefined),
        )
      : []
    record(
      'disks-shape',
      disksIsArray && badRows.length === 0,
      `disks=${Array.isArray(disks) ? `${disks.length} 行` : JSON.stringify(disks ?? null)} 非法行=${badRows.length}；首行 ${JSON.stringify(disks?.[0] ?? null)}；usageRate 归一化=${Array.isArray(disks) ? disks.map((d) => normRate(d.usageRate) === null ? 'null' : normRate(d.usageRate).toFixed(1)).join(',') : 'n/a'}%`,
    )
  }

  // ---- 4. 连续两次采样对照（模拟可见轮询的可重复查询） ------------------------
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const snap2 = await call('GET', CURRENT, { token })
  const bothOk =
    snap2.status === 200 && snap2.payload?.code === 200 && snap2.payload?.data != null
  const changed = JSON.stringify(snap1.payload?.data ?? null) !== JSON.stringify(snap2.payload?.data ?? null)
  record(
    'current-repeat-sample',
    bothOk,
    `第二次 HTTP ${snap2.status} code=${snap2.payload?.code} 快照内容变化=${changed}（可重复查询${changed ? '、快照随时间更新' : '、样本瞬时一致'}）`,
  )
} finally {
  // ---- 5. 登出清理 -----------------------------------------------------------
  const logout = await fetch(`${base}${LOGOUT}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  })
  let logoutCode = null
  try {
    logoutCode = (await logout.json())?.code
  } catch {}
  record('logout', logout.status === 200, `HTTP ${logout.status} code=${logoutCode}`)
}

const ok = checks.every((c) => c.ok)
const result = { ok, checkedAt: new Date().toISOString(), base, checks }
writeFileSync(new URL('./readonly-result.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ ok, total: checks.length }))
if (!ok) process.exit(2)
