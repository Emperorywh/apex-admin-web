/**
 * T011 隔离验证 mock 后端（仅验证用，非生产代码；运行 `node mock-task-server.mjs`）。
 * 在 T010 认证/查询桩基础上增加写入与上传桩：
 * - POST /fms/v1/dev/write?tag=&delay=&fail=   写入桩：delay 毫秒后返回信封；fail=1 业务失败
 * - POST /fms/v1/dev/upload?mode=&delay=       上传桩：mode=ok|fail|html|http500；delay=响应前延迟
 * - POST /fms/v1/dev/upload?noread=1           不读请求体不响应：制造上传停滞（客户端停滞检测应中止）
 * - GET /dev/log?n= / POST /dev/reset          请求日志与清零
 * 账号同 T007/T010：root/root（特权）。
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
  let receivedBytes = 0
  req.on('aborted', () => { clientAborted = true })
  req.on('data', (c) => { chunks.push(c); receivedBytes += c.length })
  req.on('error', () => { clientAborted = true })
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
      bytes: receivedBytes,
      aborted: clientAborted || res.destroyed,
      ...extra,
    })

    /* ---------- 认证（与 T007/T010 mock 同协议） ---------- */
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

    /* ---------- 写入桩：delay 后返回信封；fail=1 业务失败；never=1 永不响应 ---------- */
    if (url.pathname === '/fms/v1/dev/write' && req.method === 'POST') {
      const tag = url.searchParams.get('tag') ?? ''
      const delay = Number(url.searchParams.get('delay') ?? 0)
      const fail = url.searchParams.get('fail') === '1'
      if (url.searchParams.get('never') === '1') {
        // 永不响应：客户端 JSON 超时（15 秒）触发，验证「丢回执 → 待确认」；
        // 客户端超时中止连接时经 close 记录 aborted
        req.on('close', () => finish({ kind: 'dev-write-never', tag }))
        return
      }
      return setTimeout(() => {
        finish({ kind: 'dev-write', tag, delay, fail })
        if (fail) return legacy(500101, null, '模拟业务失败')
        legacy(200, { tag, ok: true })
      }, delay)
    }

    /* ---------- 上传桩 ---------- */
    if (url.pathname === '/fms/v1/dev/upload' && req.method === 'POST') {
      const mode = url.searchParams.get('mode') ?? 'ok'
      const delay = Number(url.searchParams.get('delay') ?? 0)
      if (url.searchParams.get('stallMid') === '1') {
        // 真实停滞模拟：读取约 1MB 后 req.pause() 停止读 socket——TCP 窗口
        // 填满后浏览器上传真实阻塞在请求体中途，客户端停滞检测应中止；
        // 已有部分字节发往后端 → 业务结果待确认
        req.on('data', () => {
          if (receivedBytes > 1_000_000) req.pause()
        })
        req.on('close', () => finish({ kind: 'dev-upload-stallmid', mode }))
        return
      }
      if (url.searchParams.get('noread') === '1') {
        // 不读请求体不响应：浏览器会整体缓冲小/中文件，停滞未必可见，
        // 保留作对照（真实停滞用 stallMid=1）
        req.on('close', () => finish({ kind: 'dev-upload-stall', mode }))
        return
      }
      return setTimeout(() => {
        finish({ kind: 'dev-upload', mode, delay })
        if (mode === 'fail') return legacy(500102, null, '模拟上传业务失败')
        if (mode === 'html') {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          return res.end('<html><body>gateway fallback</body></html>')
        }
        if (mode === 'http500') return json(500, { message: '模拟网关错误' })
        return legacy(200, { uploaded: true, receivedBytes })
      }, delay)
    }

    /* ---------- 控制与日志 ---------- */
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

server.listen(PORT, () => console.log(`T011 mock on :${PORT}`))

process.on('SIGINT', () => {
  writeFileSync(new URL('./mock-task-server-log.jsonl', import.meta.url), log.map((l) => JSON.stringify(l)).join('\n'))
  process.exit(0)
})
