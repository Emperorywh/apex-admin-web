/**
 * T007 隔离验证 mock 后端（仅验证用，非生产代码；运行 `node mock-t007.mjs`）。
 * 提供 /fms/v1/auth/authorize/{login,detail,logout}，账号：
 * - root/root       特权账号（isRootUser 短路放行全部页面）
 * - op/op           普通账号：仅 车辆分组 + overview:view(暂缓) + auth:user:view(特权专属页码)
 * - viewer/viewer   仅持暂缓权限：只有 overview:view，用于 P41 deferred-only 文案分支
 */

import http from 'node:http'
import crypto from 'node:crypto'
import { writeFileSync } from 'node:fs'

const PORT = 9388

const tree = (nodes) => nodes

const ROOT_TREE = tree([
  { code: 'vehicle:manage', type: 'MENU', childPermissions: [
    { code: 'vehicle-group:view', type: 'MENU', childPermissions: [] },
  ] },
])
const ROOT_PERMS = ['vehicle-group:add']

const OP_TREE = tree([
  { code: 'vehicle:manage', type: 'MENU', childPermissions: [
    { code: 'vehicle-group:view', type: 'MENU', childPermissions: [] },
  ] },
  { code: 'overview:view', type: 'MENU', childPermissions: [] },
  { code: 'auth:manage', type: 'MENU', childPermissions: [
    { code: 'auth:user:view', type: 'MENU', childPermissions: [] },
  ] },
])
const OP_PERMS = ['vehicle-group:add']

// 仅持暂缓模块权限：入口解析应落 /no-permission?scope=deferred-only（P41 区分文案）
const VIEWER_TREE = tree([
  { code: 'vehicle:manage', type: 'MENU', childPermissions: [
    { code: 'overview:view', type: 'MENU', childPermissions: [] },
  ] },
])
const VIEWER_PERMS = []

const USERS = {
  root: { password: '63a9f0ea7bb98050796b649e85481845', token: 'token-root', activated: true, permissionsTree: ROOT_TREE, permissions: ROOT_PERMS },
  op: { password: '11d8c28a64490a987612f2332502467f', token: 'token-op', activated: true, permissionsTree: OP_TREE, permissions: OP_PERMS },
  viewer: { password: '4b2a1529867b8d697685b1722ccd0149', token: 'token-viewer', activated: true, permissionsTree: VIEWER_TREE, permissions: VIEWER_PERMS },
}

/** 密码协议为 32 位小写 MD5（T005 已对齐源实现） */
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')

const log = []

const server = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    const auth = req.headers.authorization ?? ''
    log.push({ t: new Date().toISOString(), method: req.method, url: req.url, auth, body })
    const json = (code, data = null, message = 'success') => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code, message, data }))
    }
    if (req.url === '/fms/v1/auth/authorize/login' && req.method === 'POST') {
      const { username, password } = JSON.parse(body || '{}')
      const user = USERS[username]
      if (user && user.password === password) {
        return json(200, { token: user.token, activated: user.activated, permissionsTree: user.permissionsTree, permissions: user.permissions })
      }
      return json(1000005, null, '用户名或密码错误')
    }
    if (req.url === '/fms/v1/auth/authorize/detail' && req.method === 'GET') {
      const token = auth.replace(/^Bearer\s+/i, '')
      const user = Object.values(USERS).find((u) => u.token === token)
      if (!user) return json(1000000, null, '会话已失效')
      return json(200, { username: Object.keys(USERS).find((k) => USERS[k] === user), activated: user.activated, permissionsTree: user.permissionsTree, permissions: user.permissions })
    }
    if (req.url === '/fms/v1/auth/authorize/logout' && req.method === 'POST') {
      return json(200)
    }
    if (req.url === '/__log') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(log.slice(-30)))
      return
    }
    json(404, null, 'not found')
  })
})

server.listen(PORT, () => console.log(`T007 mock on :${PORT}`))

process.on('SIGINT', () => {
  writeFileSync('mock-t007-log.jsonl', log.map((l) => JSON.stringify(l)).join('\n'))
  process.exit(0)
})
