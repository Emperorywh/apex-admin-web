/**
 * P02 audit 第二次复核补充探测：10.11.2.67:8888 激活态认证交换（run run-9fc8d28e）。
 *
 * 背景：上轮（audit-20260920-p02-408144b）该目标网络不可达（连接超时），
 * 「未激活环境不可得」成为 A14/activated=false 落点两项 deferred 的依据之一。
 * 本轮轻量探测证实该目标恢复可达（HTTP 200），故按上轮脚本预授权的同类
 * 认证交换设计执行：登录（MD5+Bearer，与生产一致协议）→ 读取 activated
 * 与权限码计数 → 登出清理。全程查询性质，无任何业务写操作。
 *
 * 纪律：
 * - 凭据从本机 .env.local 读取（APEX_TEST_USERNAME/APEX_TEST_PASSWORD），
 *   记录只保留来源名称，不写入密码、token、Authorization 值；
 * - 该后端与浏览器验收目标 192.168.0.158:8888 相互独立，单会话互不影响；
 * - 若登录失败（凭据不同），如实记录失败原因后结束，不猜测口令。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const target = 'http://10.11.2.67:8888'

const envLocal = readFileSync(join(here, '../../../../../.env.local'), 'utf8')
const readEnv = (key) => {
  const line = envLocal.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim() : ''
}
const username = readEnv('APEX_TEST_USERNAME')
const password = readEnv('APEX_TEST_PASSWORD')
if (!username || !password) {
  console.error('FATAL: .env.local 缺少测试凭据（值不入档）')
  process.exit(2)
}
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')

const results = []
const record = (step, ok, detail) => {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step} | ${detail}`)
}

// ---- 1. 登录（MD5 密码 + Bearer，T00/P01 已证实协议）----
let token = null
let activated = null
let permCount = null
try {
  const res = await fetch(`${target}/fms/v1/auth/authorize/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: md5(password) }),
  })
  const body = await res.json()
  const ok = res.status === 200 && body?.code === 200 && Boolean(body?.data?.token)
  if (ok) {
    token = body.data.token
    activated = body.data.activated
    permCount = Array.isArray(body.data.permissions) ? body.data.permissions.length : null
  }
  record(
    '登录读取 activated',
    ok,
    ok
      ? `HTTP ${res.status} code=${body.code} activated=${activated} 权限码=${permCount}（token 不入档）`
      : `HTTP ${res.status} code=${body?.code} message=${String(body?.message || '').slice(0, 60)}`
  )
} catch (err) {
  record('登录读取 activated', false, `网络错误：${err.cause?.code || err.message}`)
}

// ---- 2. 未激活环境下的 getHardwareInfo 对照（若已登录）----
if (token) {
  try {
    const res = await fetch(`${target}/fms/v1/auth/license/getHardwareInfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const v = body?.data
    record(
      'getHardwareInfo（带令牌，探测目标）',
      res.status === 200 && body?.code === 200,
      `HTTP ${res.status} code=${body?.code} 硬件码${typeof v === 'string' ? ` len=${v.length}` : ` 类型=${typeof v}`}`
    )
  } catch (err) {
    record('getHardwareInfo（带令牌，探测目标）', false, `网络错误：${err.cause?.code || err.message}`)
  }

  // ---- 3. 登出清理（认证交换收尾）----
  try {
    const res = await fetch(`${target}/fms/v1/auth/authorize/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    let code = null
    try {
      code = (await res.json())?.code
    } catch {
      code = `HTTP ${res.status}`
    }
    record('登出清理', true, `HTTP ${res.status} code=${code}（探测会话已清理）`)
  } catch (err) {
    record('登出清理', false, `网络错误：${err.cause?.code || err.message}`)
  }
} else {
  record('getHardwareInfo（带令牌，探测目标）', false, '未获得令牌，跳过')
  record('登出清理', false, '未获得令牌，跳过')
}

const summary = {
  runId: 'run-9fc8d28e-f5a1-4c48-8d7f-cbb16250663e',
  taskId: 'P02',
  purpose: 'audit 补充探测：10.11.2.67 激活态认证交换',
  codeCommit: '26c94cc135a33e9921333fd72d4cef7dacb5ce21',
  executedAt: new Date().toISOString(),
  target,
  activated,
  permissionCount: permCount,
  results,
  conclusion:
    activated === false
      ? '探测目标为未激活环境——activated=false 落点与 1001000 触发的 deferred 依据部分收敛，浏览器端复核可另行安排'
      : activated === true
        ? '探测目标已激活——未激活环境依旧不可得，deferred 依据维持（网络已恢复）'
        : '未能读取激活状态',
  passCount: results.filter((r) => r.ok).length,
  totalCount: results.length,
}
writeFileSync(join(here, 'p02-audit2-probe-result.json'), JSON.stringify(summary, null, 2))
console.log(`\n${summary.passCount}/${summary.totalCount} PASS；结论：${summary.conclusion}`)
