/**
 * T010 隔离验证 mock 后端（仅验证用，非生产代码；运行 `node mock-query-server.mjs`）。
 * 在 T007 认证 mock 基础上增加可控查询桩：
 * - GET /fms/v1/dev/query?tag=&delay=&fail=  旧协议信封；delay 毫秒后返回，fail=1 返回业务失败
 * - GET /api/v1/users                        新协议用户列表桩（把查询串回显进 username，供竞态目视断言）
 * - GET /dev/log?n=20 / POST /dev/reset      请求日志与清零
 * 账号同 T007：root/root（特权）。
 */

import http from 'node:http'
import crypto from 'node:crypto'
import { writeFileSync } from 'node:fs'

const PORT = 9389

const tree = [
  { code: 'vehicle:manage', type: 'MENU', childPermissions: [
    { code: 'vehicle-group:view', type: 'MENU', childPermissions: [] },
  ] },
]
const USERS = {
  root: { password: '63a9f0ea7bb98050796b649e85481845', token: 'token-root', activated: true, permissionsTree: tree, permissions: ['vehicle-group:add'] },
}
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')

/** 新协议用户列表桩的全局可控参数（验证慢响应/连续失败用） */
const control = { usersDelayMs: 0, usersFail: false }

const log = []
const push = (entry) => {
  log.push(entry)
  if (log.length > 2000) log.shift()
}

const server = http.createServer((req, res) => {
    const started = Date.now()
    const chunks = []
    /** 客户端是否在响应完成前中止（'aborted' 事件只在客户端中断时触发） */
    let clientAborted = false
    req.on('aborted', () => { clientAborted = true })
    req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    const url = new URL(req.url, 'http://x')
    const auth = req.headers.authorization ?? ''
    const json = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    }
    const legacy = (code, data = null, message = 'success') => json(200, { code, message, data })
    const finish = (extra = {}) => push({
      t: new Date(started).toISOString(),
      ms: Date.now() - started,
      method: req.method,
      url: req.url,
      /* 客户端中止判定：'aborted' 事件在响应完成前被客户端中断时触发；
         再以 res.destroyed 兜底（socket 断开但事件时序差异时不漏记） */
      aborted: clientAborted || res.destroyed,
      ...extra,
    })

    /* ---------- 认证（与 T007 mock 同协议） ---------- */
    if (url.pathname === '/fms/v1/auth/authorize/login' && req.method === 'POST') {
      const { username, password } = JSON.parse(body || '{}')
      const user = USERS[username]
      if (user && user.password === password) {
        return legacy(200, { token: user.token, activated: user.activated, permissionsTree: user.permissionsTree, permissions: user.permissions })
      }
      return legacy(1000005, null, '用户名或密码错误')
    }
    if (url.pathname === '/fms/v1/auth/authorize/detail' && req.method === 'GET') {
      const token = auth.replace(/^Bearer\s+/i, '')
      if (!Object.values(USERS).some((u) => u.token === token)) return legacy(1000000, null, '会话已失效')
      return legacy(200, { username: 'root', activated: true, permissionsTree: tree, permissions: USERS.root.permissions })
    }
    if (url.pathname === '/fms/v1/auth/authorize/logout' && req.method === 'POST') return legacy(200)

    /* ---------- 旧协议查询桩：tag/delay/fail 全部由请求参数控制 ---------- */
    if (url.pathname === '/fms/v1/dev/query' && req.method === 'GET') {
      const tag = url.searchParams.get('tag') ?? ''
      const delay = Number(url.searchParams.get('delay') ?? 0)
      const fail = url.searchParams.get('fail') === '1'
      return setTimeout(() => {
        finish({ kind: 'dev-query', tag, delay, fail })
        if (fail) return legacy(500101, null, '模拟业务失败')
        legacy(200, { tag, servedAt: new Date().toISOString() })
      }, delay)
    }

    /* ---------- 新协议用户列表桩：查询串回显进 username ---------- */
    if (url.pathname === '/api/v1/users' && req.method === 'GET') {
      return setTimeout(() => {
        finish({ kind: 'users', query: url.search, fail: control.usersFail })
        if (control.usersFail) return json(500, { message: '模拟服务端错误' })
        const echo = url.search || '(no-query)'
        json(200, {
          items: [{ id: '1', username: echo, displayName: '回显', email: null, status: 'ENABLED', roleCodes: [], createdAt: '', updatedAt: '' }],
          total: 1,
          page: Number(url.searchParams.get('page') ?? 1),
          pageSize: Number(url.searchParams.get('pageSize') ?? 20),
        })
      }, control.usersDelayMs)
    }

    /* ---------- 控制与日志 ---------- */
    if (url.pathname === '/dev/control' && req.method === 'POST') {
      const next = JSON.parse(body || '{}')
      if (typeof next.usersDelayMs === 'number') control.usersDelayMs = next.usersDelayMs
      if (typeof next.usersFail === 'boolean') control.usersFail = next.usersFail
      push({ kind: 'control', ...control })
      return json(200, control)
    }
    if (url.pathname === '/dev/log') {
      const n = Number(url.searchParams.get('n') ?? 30)
      return json(200, log.slice(-n))
    }
    if (url.pathname === '/dev/reset' && req.method === 'POST') {
      log.length = 0
      return json(200, { ok: true })
    }
    json(404, { message: 'not found' })
  })
})

server.listen(PORT, () => console.log(`T010 mock on :${PORT}`))

process.on('SIGINT', () => {
  writeFileSync(new URL('./mock-query-server-log.jsonl', import.meta.url), log.map((l) => JSON.stringify(l)).join('\n'))
  process.exit(0)
})
