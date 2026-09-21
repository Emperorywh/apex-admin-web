/**
 * P02 audit 第三次复核真实只读复测脚本（run run-c7d53b59，代码基线 59b5434）。
 *
 * 与上轮（run-9fc8d28e）同口径，合并两类探测：
 * - getHardwareInfo 无令牌经 dev 同源代理 + 直连 192.168.0.158:8888 对照一致
 *   （对浏览器验收目标只做无令牌查询，不触碰登录会话）；
 * - 10.11.2.67:8888 上轮已恢复可达且实测 activated=true（已激活联调后端），
 *   本轮按同样预授权的认证交换复测：登录（MD5+Bearer）→ 带令牌 getHardwareInfo
 *   → 登出清理。全程查询性质，无任何业务写操作。
 *
 * 纪律：凭据从本机 .env.local 读取（仅记录来源名称）；硬件码真实值不入档
 * （仅长度与 SHA-256 前 8 位）；token/Authorization 值不写入结果。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const devBase = process.argv[2] || 'http://localhost:5173'

const envLocal = readFileSync(join(here, '../../../../../.env.local'), 'utf8')
const readEnv = (key) => {
  const line = envLocal.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim() : ''
}
const legacyTarget = readEnv('APEX_DEV_LEGACY_TARGET')
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')

// 硬件码摘要：只暴露长度与 SHA-256 前 8 位，值不入档
const hwDigest = (v) =>
  typeof v === 'string' && v.length > 0
    ? `len=${v.length} sha256_8=${createHash('sha256').update(v, 'utf8').digest('hex').slice(0, 8)}`
    : `invalid(${typeof v})`

const results = []
const record = (step, ok, detail) => {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step} | ${detail}`)
}

const getJson = async (url, headers = {}) => {
  const res = await fetch(url, { headers })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = { _raw: text.slice(0, 200) }
  }
  return { httpStatus: res.status, body }
}

// ---- 1. 硬件码只读（经 dev 同源代理，无令牌）----
const hwProxy = await getJson(`${devBase}/fms/v1/auth/license/getHardwareInfo`)
const hwProxyOk =
  hwProxy.httpStatus === 200 &&
  hwProxy.body?.code === 200 &&
  typeof hwProxy.body?.data === 'string' &&
  hwProxy.body.data.length > 0
record(
  'getHardwareInfo 经 dev 代理（无令牌）',
  hwProxyOk,
  `HTTP ${hwProxy.httpStatus} code=${hwProxy.body?.code} ${hwDigest(hwProxy.body?.data)}`
)

// ---- 2. 硬件码只读（直连联调后端 192.168.0.158，与代理一致性对照）----
const hwDirect = legacyTarget
  ? await getJson(`${legacyTarget}/fms/v1/auth/license/getHardwareInfo`)
  : null
const hwDirectOk = hwDirect && hwDirect.httpStatus === 200 && hwDirect.body?.code === 200
const hwConsistent = hwProxyOk && hwDirectOk && hwDirect.body.data === hwProxy.body.data
record(
  'getHardwareInfo 直连后端对照',
  Boolean(hwDirectOk && hwConsistent),
  hwDirect
    ? `HTTP ${hwDirect.httpStatus} code=${hwDirect.body?.code} 与代理一致=${hwConsistent} ${hwDigest(hwDirect.body?.data)}`
    : '未读取到 APEX_DEV_LEGACY_TARGET，跳过'
)

// ---- 3. 10.11.2.67 激活态认证交换（独立后端，登录→带令牌只读→登出）----
const probeTarget = 'http://10.11.2.67:8888'
const username = readEnv('APEX_TEST_USERNAME')
const password = readEnv('APEX_TEST_PASSWORD')
if (!username || !password) {
  console.error('FATAL: .env.local 缺少测试凭据（值不入档）')
  record('10.11.2.67 认证交换', false, '缺少凭据来源，跳过')
} else {
  let token = null
  let activated = null
  let permCount = null
  try {
    const res = await fetch(`${probeTarget}/fms/v1/auth/authorize/login`, {
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
      '10.11.2.67 登录读取 activated',
      ok,
      ok
        ? `HTTP ${res.status} code=${body.code} activated=${activated} 权限码=${permCount}（token 不入档）`
        : `HTTP ${res.status} code=${body?.code} message=${String(body?.message || '').slice(0, 60)}`
    )
  } catch (err) {
    record('10.11.2.67 登录读取 activated', false, `网络错误：${err.cause?.code || err.message}`)
  }

  if (token) {
    try {
      const res = await fetch(`${probeTarget}/fms/v1/auth/license/getHardwareInfo`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      const v = body?.data
      record(
        '10.11.2.67 getHardwareInfo（带令牌）',
        res.status === 200 && body?.code === 200,
        `HTTP ${res.status} code=${body?.code} 硬件码${typeof v === 'string' ? ` len=${v.length} sha256_8=${createHash('sha256').update(v, 'utf8').digest('hex').slice(0, 8)}` : ` 类型=${typeof v}`}`
      )
    } catch (err) {
      record('10.11.2.67 getHardwareInfo（带令牌）', false, `网络错误：${err.cause?.code || err.message}`)
    }
    try {
      const res = await fetch(`${probeTarget}/fms/v1/auth/authorize/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      let code = null
      try {
        code = (await res.json())?.code
      } catch {
        code = `HTTP ${res.status}`
      }
      record('10.11.2.67 登出清理', true, `HTTP ${res.status} code=${code}（探测会话已清理）`)
    } catch (err) {
      record('10.11.2.67 登出清理', false, `网络错误：${err.cause?.code || err.message}`)
    }
  } else {
    record('10.11.2.67 getHardwareInfo（带令牌）', false, '未获得令牌，跳过')
    record('10.11.2.67 登出清理', false, '未获得令牌，跳过')
  }
}

const summary = {
  runId: 'run-c7d53b59-d130-42e0-81df-7766f8c5b242',
  taskId: 'P02',
  purpose: 'audit（第三次复核）',
  codeCommit: '59b5434dbc8e46369b5677a9ea1144ec576f80fe',
  executedAt: new Date().toISOString(),
  channel: `${devBase}（Vite dev 同源代理）→ ${legacyTarget || 'N/A'}；认证交换目标 ${probeTarget}`,
  results,
  passCount: results.filter((r) => r.ok).length,
  totalCount: results.length,
}
writeFileSync(join(here, 'p02-audit3-readonly-result.json'), JSON.stringify(summary, null, 2))
console.log(`\n${summary.passCount}/${summary.totalCount} PASS；结果写入 p02-audit3-readonly-result.json`)
