/**
 * P02 audit 真实只读复测脚本（run audit-20260920-p02-408144b）。
 *
 * 范围纪律：
 * - 仅查询性质请求：GET getHardwareInfo（无副作用、无令牌即可）；
 * - 10.11.2.67:8888 激活态探测为登录/登出认证交换（D32 允许的认证链路验证，
 *   非业务写操作），用于判断「未激活环境」deferred 项是否可在本轮收敛；
 * - 不触碰 192.168.0.158:8888 的登录（该后端留给浏览器 UI 验收使用，
 *   root 单会话，脚本登录会踢用户浏览器会话）；
 * - 凭据从本机 .env.local 读取（APEX_TEST_USERNAME/APEX_TEST_PASSWORD），
 *   记录只保留来源名称，不写入密码、token 或 Authorization 值。
 *
 * 用法：node run-p02-audit-readonly.mjs [devBaseUrl]
 *   devBaseUrl 默认 http://localhost:5173（用户常驻 dev server 的同源代理）
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const devBase = process.argv[2] || 'http://localhost:5173'

// ---- 凭据读取（仅本机安全来源，值不入结果） ----
const envLocal = readFileSync(join(here, '../../../../../.env.local'), 'utf8')
const readEnv = (key) => {
  const line = envLocal.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim() : ''
}
const username = readEnv('APEX_TEST_USERNAME')
const password = readEnv('APEX_TEST_PASSWORD')
if (!username || !password) {
  console.error('FATAL: .env.local 缺少测试凭据（不在此提示具体键值）')
  process.exit(2)
}
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')

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

// ---- 1. 硬件码只读（经 dev 代理，无令牌）----
const hwProxy = await getJson(`${devBase}/fms/v1/auth/license/getHardwareInfo`)
const hwProxyOk = hwProxy.httpStatus === 200 && hwProxy.body?.code === 200 && typeof hwProxy.body?.data === 'string' && hwProxy.body.data.length > 0
record(
  'getHardwareInfo 经 dev 代理（无令牌）',
  hwProxyOk,
  `HTTP ${hwProxy.httpStatus} code=${hwProxy.body?.code} 硬件码长度=${typeof hwProxy.body?.data === 'string' ? hwProxy.body.data.length : 'N/A'}（值不入档）`
)

// ---- 2. 硬件码只读（直连联调后端，与代理一致性对照）----
const legacyTarget = readEnv('APEX_DEV_LEGACY_TARGET')
const hwDirect = legacyTarget ? await getJson(`${legacyTarget}/fms/v1/auth/license/getHardwareInfo`) : null
const hwDirectOk = hwDirect && hwDirect.httpStatus === 200 && hwDirect.body?.code === 200
const hwConsistent = hwProxyOk && hwDirectOk && hwDirect.body.data === hwProxy.body.data
record(
  'getHardwareInfo 直连后端对照',
  hwDirectOk && hwConsistent,
  hwDirect ? `HTTP ${hwDirect.httpStatus} code=${hwDirect.body?.code} 与代理结果一致=${hwConsistent}` : '未读取到 APEX_DEV_LEGACY_TARGET，跳过'
)

// ---- 3. 10.11.2.67:8888 激活态探测（认证交换：登录→读 activated→登出清理）----
const probeTarget = 'http://10.11.2.67:8888'
let probeSummary = '未执行'
try {
  const login = await fetch(`${probeTarget}/fms/v1/auth/authorize/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': 'zh-CN' },
    body: JSON.stringify({ username, password: md5(password) }),
  })
  const loginBody = await login.json().catch(() => null)
  const loginOk = login.status === 200 && loginBody?.code === 200
  const activated = loginBody?.data?.activated
  const permCount = Array.isArray(loginBody?.data?.permissions) ? loginBody.data.permissions.length : 0
  record(
    '10.11.2.67 激活态探测（登录）',
    loginOk,
    `HTTP ${login.status} code=${loginBody?.code} activated=${activated} 权限码数=${permCount}${loginOk ? '' : ` message=${String(loginBody?.message).slice(0, 60)}`}`
  )
  if (loginOk && typeof loginBody?.data?.token === 'string' && loginBody.data.token) {
    // 登出清理本轮探测会话（不保留令牌；值不入档）
    const out = await fetch(`${probeTarget}/fms/v1/auth/authorize/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginBody.data.token}` },
      body: '{}',
    })
    const outBody = await out.json().catch(() => null)
    record('10.11.2.67 探测会话登出清理', out.status === 200 && outBody?.code === 200, `HTTP ${out.status} code=${outBody?.code}`)
    probeSummary = `activated=${activated}`
  } else {
    probeSummary = `login code=${loginBody?.code}`
  }
} catch (e) {
  record('10.11.2.67 激活态探测（登录）', false, `网络异常：${e?.cause?.code || e?.message}`)
  probeSummary = 'unreachable'
}

// ---- 结果落盘（不含凭据/token/硬件码原值）----
const summary = {
  generatedAt: new Date().toISOString(),
  devBase,
  legacyTargetConfigured: Boolean(legacyTarget),
  probeBackend: probeTarget,
  probeSummary,
  allPassed: results.every((r) => r.ok),
  results,
}
writeFileSync(join(here, 'p02-readonly-result.json'), JSON.stringify(summary, null, 2), 'utf8')
console.log(`\nSUMMARY: allPassed=${summary.allPassed} probe=${probeSummary}`)
process.exit(summary.allPassed ? 0 : 1)
