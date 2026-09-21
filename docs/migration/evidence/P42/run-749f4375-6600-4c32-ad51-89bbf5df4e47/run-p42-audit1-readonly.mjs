/**
 * P42 audit 第一次复核真实只读复测脚本（run run-749f4375，代码基线 4a922cb）。
 *
 * P42 兜底错误页无业务接口，本脚本验证与页面行为相关的真实前提：
 * - dev 同源代理链路可达（浏览器验收同通道）：getHardwareInfo 无令牌；
 * - 代理与直连后端一致性对照；
 * - 真实登录（MD5+Bearer）读取 activated/权限码，断言 dashboard-realtime:view
 *   在权限集合中（P42「首页」按钮落点解析的前提：P34 后落点应为 /dashboard
 *   而非交付轮实测时的 /no-permission——本轮浏览器复测该行为变更分支）；
 * - 登出清理：curl 会话立即释放，为浏览器单会话验证让路（后端 root 单会话）。
 *
 * 纪律：凭据从本机 .env.local 读取（仅记录来源名称）；token/Authorization、
 * 密码不写入结果；全程查询性质 + 会话自身登出，无任何业务写操作。
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

// ---- 1. 代理链路可达（无令牌查询）----
const hwProxy = await getJson(`${devBase}/fms/v1/auth/license/getHardwareInfo`)
const hwProxyOk =
  hwProxy.httpStatus === 200 &&
  hwProxy.body?.code === 200 &&
  typeof hwProxy.body?.data === 'string' &&
  hwProxy.body.data.length > 0
record(
  'getHardwareInfo 经 dev 代理（无令牌）',
  hwProxyOk,
  `HTTP ${hwProxy.httpStatus} code=${hwProxy.body?.code} 硬件码 ${
    typeof hwProxy.body?.data === 'string'
      ? `len=${hwProxy.body.data.length} sha256_8=${createHash('sha256').update(hwProxy.body.data, 'utf8').digest('hex').slice(0, 8)}`
      : `类型=${typeof hwProxy.body?.data}`
  }`
)

// ---- 2. 直连后端一致性对照 ----
const hwDirect = legacyTarget
  ? await getJson(`${legacyTarget}/fms/v1/auth/license/getHardwareInfo`)
  : null
const hwDirectOk = hwDirect && hwDirect.httpStatus === 200 && hwDirect.body?.code === 200
const hwConsistent = hwProxyOk && hwDirectOk && hwDirect.body.data === hwProxy.body.data
record(
  'getHardwareInfo 直连后端对照',
  Boolean(hwDirectOk && hwConsistent),
  hwDirect
    ? `HTTP ${hwDirect.httpStatus} code=${hwDirect.body?.code} 与代理一致=${hwConsistent}`
    : '未读取到 APEX_DEV_LEGACY_TARGET，跳过'
)

// ---- 3. 真实登录读取落点前提（经 dev 代理，同浏览器通道） ----
const username = readEnv('APEX_TEST_USERNAME')
const password = readEnv('APEX_TEST_PASSWORD')
if (!username || !password) {
  console.error('FATAL: .env.local 缺少测试凭据（值不入档）')
  record('真实登录读取落点前提', false, '缺少凭据来源，跳过')
} else {
  let token = null
  try {
    const res = await fetch(`${devBase}/fms/v1/auth/authorize/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: md5(password) }),
    })
    const body = await res.json()
    const ok = res.status === 200 && body?.code === 200 && Boolean(body?.data?.token)
    if (ok) {
      token = body.data.token
      const perms = Array.isArray(body.data.permissions) ? body.data.permissions : []
      const hasDashboard = perms.includes('dashboard-realtime:view')
      record(
        '真实登录读取 activated/权限码',
        true,
        `HTTP ${res.status} code=${body.code} activated=${body.data.activated} 权限码=${perms.length} permissionsTree=${Array.isArray(body.data.permissionsTree) ? body.data.permissionsTree.length : 'N/A'}（token 不入档）`
      )
      record(
        '落点前提：dashboard-realtime:view 在权限集合',
        hasDashboard,
        hasDashboard
          ? '包含 → resolveLandingPath 落 /dashboard（P34 后行为，替代交付轮 /no-permission 分支）'
          : '不包含 → 落点将回落首个可用业务页或 /no-permission，浏览器阶段核实'
      )
    } else {
      record(
        '真实登录读取 activated/权限码',
        false,
        `HTTP ${res.status} code=${body?.code} message=${String(body?.message || '').slice(0, 60)}`
      )
    }
  } catch (err) {
    record('真实登录读取 activated/权限码', false, `网络错误：${err.cause?.code || err.message}`)
  }

  // ---- 4. 登出清理（释放 curl 会话，保证浏览器单会话）----
  if (token) {
    try {
      const res = await fetch(`${devBase}/fms/v1/auth/authorize/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      let code = null
      try {
        code = (await res.json())?.code
      } catch {
        code = `HTTP ${res.status}`
      }
      record('登出清理（释放探测会话）', true, `HTTP ${res.status} code=${code}`)
    } catch (err) {
      record('登出清理（释放探测会话）', false, `网络错误：${err.cause?.code || err.message}`)
    }
  } else {
    record('登出清理（释放探测会话）', false, '未获得令牌，跳过')
  }
}

const summary = {
  runId: 'run-749f4375-6600-4c32-ad51-89bbf5df4e47',
  taskId: 'P42',
  purpose: 'audit（第一次复核）',
  codeCommit: '4a922cb6cdcece4a52dfa5716a92f8cbd544d51b',
  executedAt: new Date().toISOString(),
  channel: `${devBase}（Vite dev 同源代理）→ ${legacyTarget || 'N/A'}`,
  results,
  passCount: results.filter((r) => r.ok).length,
  totalCount: results.length,
}
writeFileSync(join(here, 'p42-audit1-readonly-result.json'), JSON.stringify(summary, null, 2))
console.log(`\n${summary.passCount}/${summary.totalCount} PASS；结果写入 p42-audit1-readonly-result.json`)
