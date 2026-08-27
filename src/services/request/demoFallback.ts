/**
 * DEV 演示回退后端：仅在 `import.meta.env.DEV` 且真实后端网络不可达时启用，
 * 提供与真实协议一致（/api/v1、raw JSON、problem+json、分页 sort 单参数、
 * active/disabled、Cookie refreshToken 语义）的内存实现，
 * 保证模板离线开箱可演示。生产构建不打包任何回退逻辑。
 */

import type { AxiosRequestConfig } from 'axios'
import { DEFAULT_PAGE_SIZE } from '@/services/request/request.constants'
import type { EntityStatus } from '@/services/request/request.types'

export interface DemoFallbackResult {
  status: number
  data: unknown
  /** status >= 400 时的 problem+json 字段 */
  code?: string
  title?: string
  detail?: string
}

const DEMO_LATENCY_MS = 120

/* -------------------------------------------------------------------------- */
/* 内存种子数据                                                                 */
/* -------------------------------------------------------------------------- */

interface DemoUser {
  id: string
  username: string
  displayName: string
  email: string | null
  status: EntityStatus
  roleCodes: string[]
  createdAt: string
  updatedAt: string
}

interface DemoRole {
  id: string
  code: string
  name: string
  description: string | null
  status: EntityStatus
  createdAt: string
  updatedAt: string
}

interface DemoMenu {
  id: string
  parentId: string | null
  name: string
  path: string
  icon: string | null
  sort: number
  status: EntityStatus
  createdAt: string
  updatedAt: string
}

const iso = (dayOffset: number, hour = 9, minute = 30) => {
  const d = new Date(Date.now() - dayOffset * 86_400_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

let idSeq = 100
const nextId = (prefix: string) => `${prefix}_${String(++idSeq).padStart(3, '0')}`

const demoRoles: DemoRole[] = [
  { id: 'role_001', code: 'super_admin', name: '超级管理员', description: '拥有全部权限', status: 'active', createdAt: iso(90), updatedAt: iso(3) },
  { id: 'role_002', code: 'ops_admin', name: '运营管理员', description: '运营域读写', status: 'active', createdAt: iso(60), updatedAt: iso(5) },
  { id: 'role_003', code: 'biz_operator', name: '业务操作员', description: '业务域只读加部分写入', status: 'disabled', createdAt: iso(45), updatedAt: iso(12) },
  { id: 'role_004', code: 'viewer', name: '访客', description: '只读访问', status: 'active', createdAt: iso(30), updatedAt: iso(8) },
]

const demoUsers: DemoUser[] = [
  { id: 'usr_001', username: 'admin', displayName: '杨文华', email: 'admin@corp.com', status: 'active', roleCodes: ['super_admin'], createdAt: iso(90), updatedAt: iso(1) },
  { id: 'usr_002', username: 'zhangwei', displayName: '张伟', email: 'zhangwei@corp.com', status: 'active', roleCodes: ['ops_admin'], createdAt: iso(60), updatedAt: iso(2) },
  { id: 'usr_003', username: 'liling', displayName: '李玲', email: 'liling@corp.com', status: 'active', roleCodes: ['biz_operator'], createdAt: iso(55), updatedAt: iso(4) },
  { id: 'usr_004', username: 'wangfang', displayName: '王芳', email: 'wangfang@corp.com', status: 'disabled', roleCodes: ['viewer'], createdAt: iso(40), updatedAt: iso(6) },
  { id: 'usr_005', username: 'chenjie', displayName: '陈杰', email: 'chenjie@corp.com', status: 'active', roleCodes: ['viewer'], createdAt: iso(33), updatedAt: iso(7) },
  { id: 'usr_006', username: 'liuyang', displayName: '刘洋', email: null, status: 'active', roleCodes: [], createdAt: iso(20), updatedAt: iso(9) },
  { id: 'usr_007', username: 'zhaomin', displayName: '赵敏', email: 'zhaomin@corp.com', status: 'active', roleCodes: ['ops_admin'], createdAt: iso(15), updatedAt: iso(10) },
  { id: 'usr_008', username: 'sunlei', displayName: '孙磊', email: null, status: 'disabled', roleCodes: ['viewer'], createdAt: iso(10), updatedAt: iso(11) },
]

const demoMenus: DemoMenu[] = [
  { id: 'mnu_001', parentId: null, name: '工作台', path: '/dashboard', icon: 'layout-dashboard', sort: 1, status: 'active', createdAt: iso(80), updatedAt: iso(2) },
  { id: 'mnu_002', parentId: null, name: '系统管理', path: '/system', icon: 'settings', sort: 2, status: 'active', createdAt: iso(80), updatedAt: iso(2) },
  { id: 'mnu_003', parentId: 'mnu_002', name: '用户管理', path: '/system/user', icon: 'users', sort: 1, status: 'active', createdAt: iso(80), updatedAt: iso(2) },
  { id: 'mnu_004', parentId: 'mnu_002', name: '角色管理', path: '/system/role', icon: 'shield', sort: 2, status: 'active', createdAt: iso(80), updatedAt: iso(2) },
  { id: 'mnu_005', parentId: 'mnu_002', name: '菜单管理', path: '/system/menu', icon: 'list-tree', sort: 3, status: 'active', createdAt: iso(80), updatedAt: iso(2) },
]

/** 最近一次演示登录的用户名；默认 admin */
let demoCurrentUsername = 'admin'

const demoTokenCounter = { value: 0 }

/* -------------------------------------------------------------------------- */
/* 通用工具                                                                    */
/* -------------------------------------------------------------------------- */

interface ParsedUrl {
  path: string
  query: URLSearchParams
}

function parseUrl(config: AxiosRequestConfig): ParsedUrl {
  const raw = (config.url ?? '').replace(/^\//, '')
  const [path, search = ''] = raw.split('?')
  return { path, query: new URLSearchParams(search) }
}

function paginate<T>(items: T[], query: URLSearchParams): { items: T[]; total: number; page: number; pageSize: number; pages: number } {
  const page = Math.max(1, Number(query.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize') ?? DEFAULT_PAGE_SIZE)))
  const total = items.length
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** sort 单参数协议：逗号分隔 camelCase 字段，'-' 前缀降序 */
function sortByFields<T extends Record<string, unknown>>(items: T[], sort: string | null): T[] {
  if (!sort) return [...items]
  const specs = sort
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith('-') ? { field: part.slice(1), dir: -1 } : { field: part, dir: 1 }))
  const sorted = [...items]
  sorted.sort((a, b) => {
    for (const { field, dir } of specs) {
      const va = a[field]
      const vb = b[field]
      if (va === vb) continue
      const cmp = va == null || vb == null
        ? va == null ? -1 : 1
        : String(va).localeCompare(String(vb), 'zh-Hans-CN', { numeric: true })
      return cmp * dir
    }
    return 0
  })
  return sorted
}

function notFound(title: string): DemoFallbackResult {
  return { status: 404, data: null, code: 'COMMON.NOT_FOUND', title, detail: '演示数据中不存在该资源' }
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), DEMO_LATENCY_MS))
}

const currentUser = () => demoUsers.find((u) => u.username === demoCurrentUsername) ?? demoUsers[0]

/* -------------------------------------------------------------------------- */
/* 路由表                                                                      */
/* -------------------------------------------------------------------------- */

type Handler = (ctx: {
  params: string[]
  query: URLSearchParams
  body: Record<string, unknown>
  config: AxiosRequestConfig
}) => DemoFallbackResult | null

const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  /* ---------------- auth ---------------- */
  {
    method: 'POST',
    pattern: /^auth\/login$/,
    handler: ({ body }) => {
      const username = String(body.username ?? '')
      const user = demoUsers.find((u) => u.username === username)
      if (!user) return { status: 401, data: null, code: 'AUTH.INVALID_CREDENTIALS', title: '用户名或密码错误' }
      demoCurrentUsername = username
      demoTokenCounter.value += 1
      return { status: 200, data: { accessToken: `demo-token-${demoTokenCounter.value}`, tokenType: 'Bearer' } }
    },
  },
  {
    method: 'POST',
    pattern: /^auth\/refresh$/,
    handler: () => {
      demoTokenCounter.value += 1
      return { status: 200, data: { accessToken: `demo-token-${demoTokenCounter.value}`, tokenType: 'Bearer' } }
    },
  },
  { method: 'POST', pattern: /^auth\/logout$/, handler: () => ({ status: 204, data: null }) },

  /* ---------------- me / profile ---------------- */
  {
    method: 'GET',
    pattern: /^users\/me$/,
    handler: () => {
      const user = currentUser()
      return {
        status: 200,
        data: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          roles: user.roleCodes.map((code) => ({
            code,
            name: demoRoles.find((role) => role.code === code)?.name ?? code,
          })),
        },
      }
    },
  },
  {
    method: 'PUT',
    pattern: /^users\/me$/,
    handler: ({ body }) => {
      const user = currentUser()
      if (typeof body.displayName === 'string' && body.displayName) user.displayName = body.displayName
      user.email = body.email === null ? null : typeof body.email === 'string' ? body.email : user.email
      user.updatedAt = new Date().toISOString()
      return { status: 200, data: stripUser(user) }
    },
  },

  /* ---------------- users ---------------- */
  {
    method: 'GET',
    pattern: /^users$/,
    handler: ({ query }) => {
      let items = [...demoUsers]
      const status = query.get('status')
      if (status === 'active' || status === 'disabled') items = items.filter((u) => u.status === status)
      items = sortByFields(items as unknown as Record<string, unknown>[], query.get('sort')) as unknown as DemoUser[]
      return { status: 200, data: paginate(items.map(stripUser), query) }
    },
  },
  {
    method: 'POST',
    pattern: /^users$/,
    handler: ({ body }) => {
      const username = String(body.username ?? '')
      if (demoUsers.some((u) => u.username === username)) {
        return { status: 409, data: null, code: 'USER.DUPLICATE_USERNAME', title: '用户名已存在' }
      }
      const now = new Date().toISOString()
      const user: DemoUser = {
        id: nextId('usr'),
        username,
        displayName: String(body.displayName ?? username),
        email: body.email ? String(body.email) : null,
        status: 'active',
        roleCodes: Array.isArray(body.roleCodes) ? (body.roleCodes as string[]) : [],
        createdAt: now,
        updatedAt: now,
      }
      demoUsers.unshift(user)
      return { status: 201, data: stripUser(user) }
    },
  },
  {
    method: 'GET',
    pattern: /^users\/([^/]+)$/,
    handler: ({ params }) => {
      const user = demoUsers.find((u) => u.id === params[0] || u.username === params[0])
      return user ? { status: 200, data: stripUser(user) } : notFound('用户不存在')
    },
  },
  {
    method: 'PUT',
    pattern: /^users\/([^/]+)$/,
    handler: ({ params, body }) => {
      const user = demoUsers.find((u) => u.id === params[0])
      if (!user) return notFound('用户不存在')
      if (typeof body.displayName === 'string') user.displayName = body.displayName
      user.email = body.email === null ? null : typeof body.email === 'string' ? body.email : user.email
      if (Array.isArray(body.roleCodes)) user.roleCodes = body.roleCodes as string[]
      user.updatedAt = new Date().toISOString()
      return { status: 200, data: stripUser(user) }
    },
  },
  {
    method: 'DELETE',
    pattern: /^users\/([^/]+)$/,
    handler: ({ params }) => {
      const index = demoUsers.findIndex((u) => u.id === params[0])
      if (index < 0) return notFound('用户不存在')
      const [removed] = demoUsers.splice(index, 1)
      if (removed.username === demoCurrentUsername) demoCurrentUsername = 'admin'
      return { status: 204, data: null }
    },
  },
  {
    method: 'POST',
    pattern: /^users\/([^/]+)\/(enable|disable)$/,
    handler: ({ params }) => {
      const user = demoUsers.find((u) => u.id === params[0])
      if (!user) return notFound('用户不存在')
      user.status = params[1] === 'enable' ? 'active' : 'disabled'
      user.updatedAt = new Date().toISOString()
      return { status: 204, data: null }
    },
  },
  {
    method: 'GET',
    pattern: /^users\/([^/]+)\/roles$/,
    handler: ({ params }) => {
      const user = demoUsers.find((u) => u.id === params[0])
      if (!user) return notFound('用户不存在')
      const roleIds = demoRoles.filter((r) => user.roleCodes.includes(r.code)).map((r) => r.id)
      return { status: 200, data: { user_id: user.id, role_ids: roleIds } }
    },
  },
  {
    method: 'PUT',
    pattern: /^users\/([^/]+)\/roles$/,
    handler: ({ params, body }) => {
      const user = demoUsers.find((u) => u.id === params[0])
      if (!user) return notFound('用户不存在')
      const codes = Array.isArray(body.roleCodes) ? (body.roleCodes as string[]) : []
      user.roleCodes = codes.filter((code) => demoRoles.some((r) => r.code === code))
      user.updatedAt = new Date().toISOString()
      const roleIds = demoRoles.filter((r) => user.roleCodes.includes(r.code)).map((r) => r.id)
      return { status: 200, data: { user_id: user.id, role_ids: roleIds } }
    },
  },

  /* ---------------- roles ---------------- */
  {
    method: 'GET',
    pattern: /^roles$/,
    handler: ({ query }) => {
      let items = [...demoRoles]
      const status = query.get('status')
      if (status === 'active' || status === 'disabled') items = items.filter((r) => r.status === status)
      items = sortByFields(items as unknown as Record<string, unknown>[], query.get('sort')) as unknown as DemoRole[]
      return { status: 200, data: paginate(items.map(stripRole), query) }
    },
  },
  {
    method: 'POST',
    pattern: /^roles$/,
    handler: ({ body }) => {
      const code = String(body.code ?? '')
      if (demoRoles.some((r) => r.code === code)) {
        return { status: 409, data: null, code: 'ROLE.DUPLICATE_CODE', title: '角色编码已存在' }
      }
      const now = new Date().toISOString()
      const role: DemoRole = {
        id: nextId('role'),
        code,
        name: String(body.name ?? code),
        description: body.description ? String(body.description) : null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      demoRoles.unshift(role)
      return { status: 201, data: stripRole(role) }
    },
  },
  {
    method: 'GET',
    pattern: /^roles\/([^/]+)$/,
    handler: ({ params }) => {
      const role = demoRoles.find((r) => r.id === params[0] || r.code === params[0])
      if (!role) return notFound('角色不存在')
      const memberCount = demoUsers.filter((u) => u.roleCodes.includes(role.code)).length
      return { status: 200, data: { ...stripRole(role), memberCount } }
    },
  },
  {
    method: 'PUT',
    pattern: /^roles\/([^/]+)$/,
    handler: ({ params, body }) => {
      const role = demoRoles.find((r) => r.id === params[0])
      if (!role) return notFound('角色不存在')
      if (typeof body.name === 'string') role.name = body.name
      role.description = body.description === null ? null : typeof body.description === 'string' ? body.description : role.description
      role.updatedAt = new Date().toISOString()
      return { status: 200, data: stripRole(role) }
    },
  },
  {
    method: 'DELETE',
    pattern: /^roles\/([^/]+)$/,
    handler: ({ params }) => {
      const index = demoRoles.findIndex((r) => r.id === params[0])
      if (index < 0) return notFound('角色不存在')
      demoRoles.splice(index, 1)
      return { status: 204, data: null }
    },
  },
  {
    method: 'POST',
    pattern: /^roles\/([^/]+)\/(enable|disable)$/,
    handler: ({ params }) => {
      const role = demoRoles.find((r) => r.id === params[0])
      if (!role) return notFound('角色不存在')
      role.status = params[1] === 'enable' ? 'active' : 'disabled'
      role.updatedAt = new Date().toISOString()
      return { status: 204, data: null }
    },
  },

  /* ---------------- menus ---------------- */
  {
    method: 'GET',
    pattern: /^menus$/,
    handler: () => ({ status: 200, data: demoMenus.map((m) => ({ ...m })) }),
  },
  {
    method: 'POST',
    pattern: /^menus$/,
    handler: ({ body }) => {
      const now = new Date().toISOString()
      const menu: DemoMenu = {
        id: nextId('mnu'),
        parentId: body.parentId ? String(body.parentId) : null,
        name: String(body.name ?? ''),
        path: String(body.path ?? '/'),
        icon: body.icon ? String(body.icon) : null,
        sort: Number(body.sort ?? 0),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      demoMenus.push(menu)
      return { status: 201, data: { ...menu } }
    },
  },
  {
    method: 'PUT',
    pattern: /^menus\/([^/]+)$/,
    handler: ({ params, body }) => {
      const menu = demoMenus.find((m) => m.id === params[0])
      if (!menu) return notFound('菜单不存在')
      if (typeof body.name === 'string') menu.name = body.name
      if (typeof body.path === 'string') menu.path = body.path
      menu.icon = body.icon === null ? null : typeof body.icon === 'string' ? body.icon : menu.icon
      if (body.sort !== undefined) menu.sort = Number(body.sort)
      menu.updatedAt = new Date().toISOString()
      return { status: 200, data: { ...menu } }
    },
  },
  {
    method: 'DELETE',
    pattern: /^menus\/([^/]+)$/,
    handler: ({ params }) => {
      const index = demoMenus.findIndex((m) => m.id === params[0])
      if (index < 0) return notFound('菜单不存在')
      demoMenus.splice(index, 1)
      return { status: 204, data: null }
    },
  },
  {
    method: 'PUT',
    pattern: /^menus\/([^/]+)\/hierarchy$/,
    handler: ({ params, body }) => {
      const menu = demoMenus.find((m) => m.id === params[0])
      if (!menu) return notFound('菜单不存在')
      menu.parentId = body.parentId ? String(body.parentId) : null
      menu.sort = Number(body.sort ?? menu.sort)
      menu.updatedAt = new Date().toISOString()
      return { status: 200, data: { ...menu } }
    },
  },
]

function stripUser(user: DemoUser) {
  return { ...user }
}

function stripRole(role: DemoRole) {
  return { ...role }
}

/* -------------------------------------------------------------------------- */
/* 入口                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 尝试用内存数据应答请求；无匹配路由时返回 null（继续走真实错误路径）。
 */
export async function tryDemoFallback(config: AxiosRequestConfig): Promise<DemoFallbackResult | null> {
  const method = (config.method ?? 'get').toLowerCase()
  const { path, query } = parseUrl(config)
  const body = (config.data ? JSON.parse(String(config.data)) : {}) as Record<string, unknown>
  for (const route of routes) {
    if (route.method.toLowerCase() !== method) continue
    const match = route.pattern.exec(path)
    if (!match) continue
    const result = route.handler({ params: match.slice(1), query, body, config })
    if (result) return delay(result)
  }
  return null
}
