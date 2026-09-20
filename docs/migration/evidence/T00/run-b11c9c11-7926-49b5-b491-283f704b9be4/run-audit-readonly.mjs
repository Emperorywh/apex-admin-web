/**
 * T00 audit 复核轮：真实登录 + 带令牌授权只读复测（无任何写副作用）。
 *
 * 目的：T00 冻结（2026-09-17）后请求层/认证相关公共文件经 P01–P20 授权扩展，
 * 旧哈希证据不能直接沿用（TASKS §2.4）；本脚本在当前代码基线的 dev 代理链路上
 * 复测 G03/G17 关闭结论仍然成立：MD5 登录成功、Bearer 被识别、带令牌只读 code=200。
 *
 * 凭据仅从本机既有安全来源 `.env.local`（APEX_DEV_LEGACY_TARGET /
 * APEX_TEST_USERNAME / APEX_TEST_PASSWORD）读取；本脚本与输出均不含密码与 token。
 *
 * 用法：node run-audit-readonly.mjs [baseUrl]
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

/** 业务请求封装：只读场景，全部 GET 除登录/登出外无副作用 */
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

// ---- 1. 登录（MD5 摘要，G03 确认的必需形态） --------------------------------
const md5 = createHash('md5').update(password).digest('hex')
const login = await call('POST', '/fms/v1/auth/authorize/login', {
  body: { username, password: md5 },
})
const loginOk =
  login.status === 200 &&
  login.payload?.code === 200 &&
  login.payload?.data?.activated === true &&
  typeof login.payload?.data?.token === 'string' &&
  login.payload.data.token !== ''
record(
  'login-md5',
  loginOk,
  `HTTP ${login.status} code=${login.payload?.code} activated=${login.payload?.data?.activated} userFields=${login.payload?.data?.user ? Object.keys(login.payload.data.user).length : 0} permCodes=${Array.isArray(login.payload?.data?.permissions) ? login.payload.data.permissions.length : 0}`,
)
if (!loginOk) process.exit(1)
const token = login.payload.data.token
const activated = login.payload.data.activated

// ---- 2. 带令牌授权只读（pageUsers，仅查询） ---------------------------------
const pageUsers = await call('GET', '/fms/v1/auth/user/pageUsers?pageNo=1&pageSize=1', { token })
const records = pageUsers.payload?.data?.records
const roOk =
  pageUsers.status === 200 && pageUsers.payload?.code === 200 && Array.isArray(records)
record(
  'page-users-with-token',
  roOk,
  `HTTP ${pageUsers.status} code=${pageUsers.payload?.code} records=${Array.isArray(records) ? records.length : 'n/a'} total=${pageUsers.payload?.data?.total ?? 'n/a'}`,
)

// ---- 3. 对照：无令牌同接口应返回会话失效 1000000 ------------------------------
const anon = await call('GET', '/fms/v1/auth/user/pageUsers?pageNo=1&pageSize=1')
const anonOk = anon.status === 200 && anon.payload?.code === 1000000
record('page-users-anon-contrast', anonOk, `HTTP ${anon.status} code=${anon.payload?.code}`)

// ---- 4. 公开接口不受激活限制（systemLogos 带令牌 code=200） -------------------
const logos = await call('GET', '/fms/v1/systemLogos', { token })
const logosOk = logos.status === 200 && logos.payload?.code === 200
record('system-logos-public', logosOk, `HTTP ${logos.status} code=${logos.payload?.code}`)

// ---- 5. 登出（尽力通知，清理本轮会话，不留活令牌） ----------------------------
const out = await call('POST', '/fms/v1/auth/authorize/logout', { token })
record('logout', out.status === 200, `HTTP ${out.status} code=${out.payload?.code}`)

const ok = checks.every((c) => c.ok)
const summary = {
  ok,
  proxyTarget: target,
  activated,
  checks,
  checkedAt: new Date().toISOString(),
  note: '输出不含密码与 token；pageUsers 仅 pageSize=1 只读查询。',
}
console.log(JSON.stringify(summary, null, 2))
process.exit(ok ? 0 : 1)
