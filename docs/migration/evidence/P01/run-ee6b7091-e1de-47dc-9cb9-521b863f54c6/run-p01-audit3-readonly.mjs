/**
 * P01 audit 复核轮（run-ee6b7091，基线 a0a1071（第三次复核））：登录链路真实复测（无业务写副作用）。
 *
 * 与上轮（run-0142d6d6）的差异：bbe05cb..a0a1071 唯一 src 变更为 routeAccess.ts
 * （57ce7ba P41-audit-1：resolveSafeRedirectPath 显式拒绝 no-permission 回跳），不影响本脚本覆盖的
 * 登录链路与接口通道；8 项复测（错误凭据/正确凭据 MD5/品牌列表/登录背景
 * 文件位回退条件/落点权限前提/带令牌只读/无令牌对照/登出清理）全部重跑。
 * 脚本逻辑与上轮完全一致（无接口层变更），结果直接对比上轮。
 
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_DEV_LEGACY_TARGET /
 * APEX_TEST_USERNAME / APEX_TEST_PASSWORD）读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-p01-audit2-readonly.mjs [baseUrl]
 *   baseUrl 缺省 http://localhost:5173（Vite dev server 同源代理，/fms 直通目标）。
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..')

// ---- 读取本机环境配置（不回显值） ------------------------------------------
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const target = env.APEX_DEV_LEGACY_TARGET
const username = env.APEX_TEST_USERNAME
const password = env.APEX_TEST_PASSWORD
if (!target || !username || !password) {
  console.error(JSON.stringify({ ok: false, reason: '缺少 .env.local 配置（target/username/password）' }))
  process.exit(1)
}

const base = process.argv[2] ?? 'http://localhost:5173'
const checks = []
function record(step, ok, detail) {
  checks.push({ step, ok, detail })
  console.error(`${ok ? 'PASS' : 'FAIL'} ${step}: ${detail}`)
}

/** 业务请求封装：除登录/登出外均为只读或无副作用请求 */
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

// ---- 1. 错误凭据（P01 专项：真实错误反馈，不得放行/不得伪造成功） --------------
// 密码取真实密码 + 后缀（保证 MD5 值不同且几乎不可能碰中），用户名真实存在，
// 用于区分「凭据错误」与「用户不存在」两种后端语义；P01 只要求按真实结果反馈。
const md5Wrong = createHash('md5').update(`${password}#audit-wrong`).digest('hex')
const bad = await call('POST', '/fms/v1/auth/authorize/login', {
  body: { username, password: md5Wrong },
})
const badOk = bad.status === 200 && bad.payload?.code !== 200 && !!bad.payload?.message
record(
  'login-wrong-credentials',
  badOk,
  `HTTP ${bad.status} code=${bad.payload?.code} message=${bad.payload?.message}`,
)

// ---- 2. 正确凭据（MD5 摘要，G03 确认形态）：activated + 权限码齐备 --------------
const md5 = createHash('md5').update(password).digest('hex')
const login = await call('POST', '/fms/v1/auth/authorize/login', {
  body: { username, password: md5 },
})
const loginOk =
  login.status === 200 &&
  login.payload?.code === 200 &&
  login.payload?.data?.activated === true &&
  typeof login.payload?.data?.token === 'string' &&
  login.payload.data.token !== '' &&
  Array.isArray(login.payload?.data?.permissions) &&
  login.payload.data.permissions.length > 0
record(
  'login-md5-correct',
  loginOk,
  `HTTP ${login.status} code=${login.payload?.code} activated=${login.payload?.data?.activated} permCodes=${Array.isArray(login.payload?.data?.permissions) ? login.payload.data.permissions.length : 0}`,
)
if (!loginOk) process.exit(1)
const token = login.payload.data.token
const perms = login.payload.data.permissions

// ---- 3. 品牌列表（登录页品牌通道 owner 接口，P27 共用） -------------------------
const logos = await call('GET', '/fms/v1/systemLogos', { token })
const logosOk = logos.status === 200 && logos.payload?.code === 200
record(
  'system-logos-list',
  logosOk,
  `HTTP ${logos.status} code=${logos.payload?.code} items=${Array.isArray(logos.payload?.data) ? logos.payload.data.length : 'n/a'}`,
)

// ---- 4. 登录背景文件位（当前环境未上传 → 期望失败而非伪图；登录页据此回退默认壁纸）
const bg = await call('GET', '/fms/v1/systemLogos/loginBackground/file', { token })
const bgOk = bg.status !== 200 || !String(bg.contentType).includes('image/')
record(
  'login-background-absent-fallback-condition',
  bgOk,
  `HTTP ${bg.status} contentType=${bg.contentType || 'n/a'}`,
)

// ---- 5. 落点前提：dashboard-realtime:view 在登录权限码内（/dashboard 同码，D29） ----
// /dashboard 节点 P34 交付后解除 pending，守卫 resolveLandingPath 对有权限用户
// 以本页作为登录落点；本项核查该前提在真实返回中成立（浏览器落点实测另记录）。
const dashPermOk = perms.includes('dashboard-realtime:view')
record(
  'dashboard-landing-permission-present',
  dashPermOk,
  `dashboard-realtime:view ${dashPermOk ? '在' : '不在'} ${perms.length} 个权限码中`,
)

// ---- 6. 带令牌只读（验证 token 真实可用；同 T00 audit 口径的 pageUsers） ----------
const users = await call('GET', '/fms/v1/auth/user/pageUsers?pageNo=1&pageSize=1', { token })
const usersOk =
  users.status === 200 && users.payload?.code === 200 && Array.isArray(users.payload?.data?.records)
record(
  'token-readonly-pageusers',
  usersOk,
  `HTTP ${users.status} code=${users.payload?.code} total=${users.payload?.data?.total ?? 'n/a'}`,
)

// ---- 6b. 对照：无令牌同接口应返回会话失效 1000000（认证守卫语义） ----------------
const anon = await call('GET', '/fms/v1/auth/user/pageUsers?pageNo=1&pageSize=1')
const anonOk = anon.status === 200 && anon.payload?.code === 1000000
record('token-readonly-anon-contrast', anonOk, `HTTP ${anon.status} code=${anon.payload?.code}`)

// ---- 7. 登出（尽力通知，清理本轮会话，不留活令牌） ------------------------------
const out = await call('POST', '/fms/v1/auth/authorize/logout', { token })
record('logout', out.status === 200, `HTTP ${out.status} code=${out.payload?.code}`)

const ok = checks.every((c) => c.ok)
const summary = {
  ok,
  proxyTarget: target,
  checks,
  checkedAt: new Date().toISOString(),
  note: '输出不含密码与 token；除登录/登出外无写请求。',
}
console.log(JSON.stringify(summary, null, 2))
process.exit(ok ? 0 : 1)
