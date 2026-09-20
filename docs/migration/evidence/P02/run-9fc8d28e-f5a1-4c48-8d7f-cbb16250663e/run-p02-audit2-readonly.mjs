/**
 * P02 audit 第二次复核真实只读复测脚本（run run-9fc8d28e，代码基线 26c94cc）。
 *
 * 范围纪律：
 * - 仅查询性质请求：GET getHardwareInfo（无副作用、无令牌即可，不触碰登录会话——
 *   浏览器 UI 验收已先行完成，root 单会话不被脚本干扰）；
 * - 10.11.2.67:8888 激活态探测仅做短超时 TCP 级轻量探测（5s），用于确认
 *   「未激活环境不可得」这一 deferred 依据在当前轮仍成立；条件未变化时
 *   不重复上轮的完整登录探测（AGENTS §5：阻塞未变化只做最小只读探测）；
 * - 凭据不读取、不入档；硬件码真实值不写入结果（仅记长度与哈希前 8 位）。
 *
 * 用法：node run-p02-audit2-readonly.mjs [devBaseUrl]
 *   devBaseUrl 默认 http://localhost:5173（用户常驻 dev server 的同源代理）
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const devBase = process.argv[2] || 'http://localhost:5173'

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

// 硬件码摘要：只暴露长度与 SHA-256 前 8 位，值不入档
const hwDigest = (v) =>
  typeof v === 'string' && v.length > 0
    ? `len=${v.length} sha256_8=${createHash('sha256').update(v, 'utf8').digest('hex').slice(0, 8)}`
    : `invalid(${typeof v})`

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

// ---- 2. 硬件码只读（直连联调后端，与代理一致性对照）----
const envLocal = readFileSync(join(here, '../../../../../.env.local'), 'utf8')
const readEnv = (key) => {
  const line = envLocal.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim() : ''
}
const legacyTarget = readEnv('APEX_DEV_LEGACY_TARGET')
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

// ---- 3. 10.11.2.67:8888 激活态轻量探测（条件未变化的最小只读探测）----
const probeTarget = 'http://10.11.2.67:8888'
let probeSummary = '未执行'
try {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  const t0 = Date.now()
  const res = await fetch(`${probeTarget}/fms/v1/auth/license/getHardwareInfo`, {
    signal: ctrl.signal,
  })
  clearTimeout(timer)
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = { _raw: text.slice(0, 120) }
  }
  probeSummary = `可达：HTTP ${res.status} code=${body?.code}（${Date.now() - t0}ms）`
  record('10.11.2.67 激活态探测', false, `本轮变为可达：${probeSummary}——未激活环境 deferred 依据需要重新评估`)
} catch (err) {
  probeSummary = `不可达：${err.name === 'AbortError' ? '连接超时(5s)' : err.cause?.code || err.message}`
  record('10.11.2.67 激活态探测', true, `${probeSummary}——与上轮一致，未激活环境 deferred 依据维持`)
}

const summary = {
  runId: 'run-9fc8d28e-f5a1-4c48-8d7f-cbb16250663e',
  taskId: 'P02',
  purpose: 'audit（第二次复核）',
  codeCommit: '26c94cc135a33e9921333fd72d4cef7dacb5ce21',
  executedAt: new Date().toISOString(),
  channel: `${devBase}（Vite dev 同源代理）→ ${legacyTarget || 'N/A'}；探测目标 ${probeTarget}`,
  results,
  probeSummary,
  passCount: results.filter((r) => r.ok).length,
  totalCount: results.length,
}
writeFileSync(join(here, 'p02-audit2-readonly-result.json'), JSON.stringify(summary, null, 2))
console.log(`\n${summary.passCount}/${summary.totalCount} PASS；结果写入 p02-audit2-readonly-result.json`)
