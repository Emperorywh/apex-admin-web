/**
 * demo adapter（规格 §13.2）：以与真实接口相同的 HTTP/envelope/errorCode 契约（规格 §7.1/§14.4）
 * 实现受支持端点——登录（密码任意）、GET profile、refresh（token 过期与旋转）、logout、用户 CRUD。
 *
 * - 形态是 axios adapter：由 demo 运行时经 configureRequestAdapter 注册，主实例与 refresh 专用实例
 *   共用同一选择结果，因此 401 刷新单飞同样落在 demo 契约上（§20 闸门 ⑤ 结论产品化）；
 * - token 无状态自校验（前缀.用户名.到期时间戳），整页刷新后持久化的 token 依旧可验证；
 *   refreshToken 以内存旋转时间戳实现旋转失效（每次 refresh/logout 递增，旧 token 立即不可用）；
 * - CRUD 修改内存数据集并同步版本化快照（demoData.ts）；
 * - 写端点按 §5.3 权限矩阵拒绝越权（viewer 写操作返回 403 AUTH_FORBIDDEN）；
 * - 未注册端点返回 404 RESOURCE_NOT_FOUND，随后续页面任务在本文件路由表处扩展。
 *
 * 本文件属于可整体剔除的 src/demo/（规格 §13.3）；DTO 一律 import type 引用 services 权威定义。
 */
import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import dayjs from 'dayjs'
import { DASHBOARD_DATE_FORMAT, DASHBOARD_ENDPOINTS } from '@/constants/dashboard/dashboard.constants'
import { AUTH_ENDPOINTS, PASSWORD_MIN_LENGTH } from '@/constants/auth/auth.constants'
import { PROFILE_ENDPOINTS } from '@/constants/profile/profile.constants'
import {
  API_ERROR_CODES,
  API_SUCCESS_CODE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  PAGE_DEFAULT,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  SORT_ORDERS,
  type SortOrder,
} from '@/constants/request.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { ADMIN_ROLE_CODE } from '@/constants/system/role/role.constants'
import { USER_EMAIL_PATTERN, USER_ENDPOINTS, USER_KEYWORD_FIELDS, USER_SORT_FIELDS } from '@/constants/system/user/user.constants'
import { hasPermissionCode } from '@/store/permissions'
import type {
  LoginResponseDto,
  RefreshTokensRequestDto,
  RefreshTokensResponseDto,
} from '@/services/auth/auth.service.types'
import type { ApiErrorCode } from '@/constants/request.constants'
import type { ProfileData } from '@/types/auth/auth.types'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import type { PageResult, User } from '@/types/system/user/user.types'
import {
  DEMO_ACCESS_TOKEN_PREFIX,
  DEMO_ACCESS_TOKEN_TTL_MS,
  DEMO_REFRESH_TOKEN_PREFIX,
  DEMO_REFRESH_TOKEN_TTL_MS,
  DEMO_USER_ID_PREFIX,
  findDemoAccount,
  type DemoAccount,
} from '../demo.constants'
import { ensureDemoDataset, persistDemoSnapshot, resetDemoDataset } from '../demoData'
import { DEMO_SEED_ROLES } from '../fixtures/demoSeedData'

// ── 契约辅助：成功/失败 envelope 与端点错误 ────────────────────────────────────────

/** 失败 envelope 的 details 固定形状（规格 §14.4） */
interface DemoFieldIssue {
  field: string
  message: string
}

/** 端点错误：handler 抛出，由 adapter 统一转换为携带失败 envelope 的 AxiosError */
class DemoEndpointError extends Error {
  readonly status: number
  readonly errorCode: ApiErrorCode
  readonly fieldIssues: DemoFieldIssue[]

  constructor(status: number, errorCode: ApiErrorCode, message: string, fieldIssues: DemoFieldIssue[] = []) {
    super(message)
    this.name = 'DemoEndpointError'
    this.status = status
    this.errorCode = errorCode
    this.fieldIssues = fieldIssues
  }
}

/** 成功响应载荷（规格 §7.1：code 固定 0，data 必须存在） */
interface DemoEndpointOutput {
  status: number
  data: unknown
}

function ok(data: unknown): DemoEndpointOutput {
  return { status: 200, data: { code: API_SUCCESS_CODE, message: 'ok', data } }
}

function endpointError(error: DemoEndpointError): DemoEndpointOutput {
  return {
    status: error.status,
    data: {
      code: error.status,
      message: error.message,
      data: null,
      errorCode: error.errorCode,
      ...(error.fieldIssues.length > 0
        ? { details: { fields: error.fieldIssues } }
        : {}),
    },
  }
}

/** 字段校验累积器：任一字段非法即统一抛 400 VALIDATION_FAILED（规格 §14.4） */
class FieldValidator {
  private readonly issues: DemoFieldIssue[] = []

  requireString(source: Record<string, unknown>, field: string): string {
    const value = source[field]
    if (typeof value !== 'string' || value.length === 0) {
      this.issues.push({ field, message: `${field} 必须是非空字符串` })
      return ''
    }
    return value
  }

  requireEnum<T extends string>(source: Record<string, unknown>, field: string, allowed: readonly T[]): T {
    const value = source[field]
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      this.issues.push({ field, message: `${field} 必须是 ${allowed.join(' | ')} 之一` })
      return allowed[0]
    }
    return value as T
  }

  optionalString(source: Record<string, unknown>, field: string): string | undefined {
    const value = source[field]
    if (value === undefined) {
      return undefined
    }
    if (typeof value !== 'string') {
      this.issues.push({ field, message: `${field} 必须是字符串` })
      return undefined
    }
    return value
  }

  requireStringArray(source: Record<string, unknown>, field: string): string[] {
    const value = source[field]
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      this.issues.push({ field, message: `${field} 必须是字符串数组` })
      return []
    }
    return value as string[]
  }

  add(field: string, message: string): void {
    this.issues.push({ field, message })
  }

  throwIfInvalid(): void {
    if (this.issues.length > 0) {
      throw new DemoEndpointError(400, API_ERROR_CODES.VALIDATION_FAILED, '请求参数校验失败', this.issues)
    }
  }
}

// ── token 运行态：签发、无状态校验与旋转失效 ──────────────────────────────────────

/** 全量失效标记与按账号失效集合（测试专用控制器写入） */
let allAccessTokensInvalidated = false
let allRefreshTokensInvalidated = false
const invalidatedAccessAccounts = new Set<string>()
const invalidatedRefreshAccounts = new Set<string>()

/** 每账号 refreshToken 最小有效签发时间戳：refresh 旋转与 logout 时递增，旧 token 全部失效 */
const refreshRotationStamps = new Map<string, number>()

/** 单调递增签发时钟：同一毫秒内的连续签发/旋转也能产生严格更大的时间戳，保证旧 token 立即失效 */
let lastTokenIssuedAt = 0

function nextIssueTime(): number {
  lastTokenIssuedAt = Math.max(Date.now(), lastTokenIssuedAt + 1)
  return lastTokenIssuedAt
}

export function formatDemoAccessToken(username: string, expiresAtMs: number): string {
  return `${DEMO_ACCESS_TOKEN_PREFIX}${username}.${expiresAtMs}`
}

export function formatDemoRefreshToken(username: string, expiresAtMs: number, issuedAtMs: number): string {
  return `${DEMO_REFRESH_TOKEN_PREFIX}${username}.${expiresAtMs}.${issuedAtMs}`
}

interface ParsedAccessToken {
  username: string
  expiresAtMs: number
}

interface ParsedRefreshToken extends ParsedAccessToken {
  issuedAtMs: number
}

function parseDemoToken(token: string, prefix: string): { username: string; parts: number[] } | null {
  if (!token.startsWith(prefix)) {
    return null
  }
  const segments = token.slice(prefix.length).split('.')
  if (segments.length !== 2 && segments.length !== 3) {
    return null
  }
  const username = segments[0]
  const numbers: number[] = []
  for (const segment of segments.slice(1)) {
    const parsed = Number(segment)
    if (!Number.isFinite(parsed) || segment.length === 0) {
      return null
    }
    numbers.push(parsed)
  }
  if (username.length === 0) {
    return null
  }
  return { username, parts: numbers }
}

function parseAccessToken(token: string): ParsedAccessToken | null {
  const parsed = parseDemoToken(token, DEMO_ACCESS_TOKEN_PREFIX)
  return parsed !== null && parsed.parts.length === 1
    ? { username: parsed.username, expiresAtMs: parsed.parts[0] }
    : null
}

function parseRefreshToken(token: string): ParsedRefreshToken | null {
  const parsed = parseDemoToken(token, DEMO_REFRESH_TOKEN_PREFIX)
  return parsed !== null && parsed.parts.length === 2
    ? { username: parsed.username, expiresAtMs: parsed.parts[0], issuedAtMs: parsed.parts[1] }
    : null
}

function resolveAccountOrThrow(username: string, errorCode: ApiErrorCode, message: string): DemoAccount {
  const account = findDemoAccount(username)
  if (account === null) {
    throw new DemoEndpointError(401, errorCode, message)
  }
  return account
}

/** 校验 accessToken：结构、账号存在、未失效、未过期；失败统一 401 AUTH_ACCESS_EXPIRED（规格 §14.4） */
function validateAccessToken(token: string): DemoAccount {
  const parsed = parseAccessToken(token)
  if (
    parsed === null ||
    allAccessTokensInvalidated ||
    invalidatedAccessAccounts.has(parsed.username) ||
    Date.now() >= parsed.expiresAtMs
  ) {
    throw new DemoEndpointError(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED, '演示 accessToken 已失效')
  }
  return resolveAccountOrThrow(parsed.username, API_ERROR_CODES.AUTH_ACCESS_EXPIRED, '演示 accessToken 已失效')
}

/** 校验 refreshToken：结构、账号存在、未失效、未过期、未被旋转出队；失败 401 AUTH_REFRESH_EXPIRED */
function validateRefreshToken(token: string): DemoAccount {
  const parsed = parseRefreshToken(token)
  const invalid = () => new DemoEndpointError(401, API_ERROR_CODES.AUTH_REFRESH_EXPIRED, '演示 refreshToken 已失效')
  if (parsed === null) {
    throw invalid()
  }
  if (allRefreshTokensInvalidated || invalidatedRefreshAccounts.has(parsed.username)) {
    throw invalid()
  }
  if (Date.now() >= parsed.expiresAtMs) {
    throw invalid()
  }
  if (parsed.issuedAtMs < (refreshRotationStamps.get(parsed.username) ?? 0)) {
    throw invalid()
  }
  return resolveAccountOrThrow(parsed.username, API_ERROR_CODES.AUTH_REFRESH_EXPIRED, '演示 refreshToken 已失效')
}

function issueTokenPair(username: string): { accessToken: string; refreshToken: string } {
  const now = nextIssueTime()
  refreshRotationStamps.set(username, now)
  return {
    accessToken: formatDemoAccessToken(username, now + DEMO_ACCESS_TOKEN_TTL_MS),
    refreshToken: formatDemoRefreshToken(username, now + DEMO_REFRESH_TOKEN_TTL_MS, now),
  }
}

// ── 请求上下文读取：认证头、查询参数与请求体 ──────────────────────────────────────

function readHeader(config: InternalAxiosRequestConfig, name: string): string | undefined {
  const headers = config.headers as unknown
  if (headers !== null && typeof headers === 'object') {
    const getter = (headers as { get?: (key: string) => unknown }).get
    if (typeof getter === 'function') {
      const value = getter.call(headers, name)
      return typeof value === 'string' && value.length > 0 ? value : undefined
    }
    const raw = (headers as Record<string, unknown>)[name]
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined
  }
  return undefined
}

/** 受保护端点统一入口：缺头/失效/过期均 401 AUTH_ACCESS_EXPIRED，触发请求层刷新单飞重放 */
function requireAccount(config: InternalAxiosRequestConfig): DemoAccount {
  const authorization = readHeader(config, 'Authorization')
  const token = authorization !== undefined && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  if (token === null) {
    throw new DemoEndpointError(401, API_ERROR_CODES.AUTH_ACCESS_EXPIRED, '演示 accessToken 已失效')
  }
  return validateAccessToken(token)
}

/** 写端点权限校验：按账号权限矩阵拒绝越权（规格 §5.3/§14.4 普通 403 只拒绝不提示刷新） */
function requirePermission(account: DemoAccount, code: string): void {
  if (!hasPermissionCode(account.permCodes, account.roleCodes, code)) {
    throw new DemoEndpointError(403, API_ERROR_CODES.AUTH_FORBIDDEN, '没有权限执行此操作')
  }
}

function readQuery(config: InternalAxiosRequestConfig): Record<string, string> {
  const params = config.params as unknown
  const query: Record<string, string> = {}
  if (params instanceof URLSearchParams) {
    for (const [key, value] of params.entries()) {
      query[key] = value
    }
    return query
  }
  if (typeof params === 'object' && params !== null) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        query[key] = value
      } else if (typeof value === 'number') {
        query[key] = String(value)
      }
    }
  }
  return query
}

function parseBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  const data: unknown = typeof config.data === 'string' ? safeJsonParse(config.data) : config.data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new DemoEndpointError(400, API_ERROR_CODES.VALIDATION_FAILED, '请求体必须是 JSON 对象', [
      { field: 'body', message: '请求体必须是 JSON 对象' },
    ])
  }
  return data as Record<string, unknown>
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

// ── 数据集访问辅助 ────────────────────────────────────────────────────────────

function findUserById(id: string): User | undefined {
  return ensureDemoDataset().users.find((user) => user.id === id)
}

/** admin 角色 ID：删除最后一个 admin 的冲突判定使用（规格 §14.3） */
const DEMO_ADMIN_ROLE_ID = DEMO_SEED_ROLES.find((role) => role.code === ADMIN_ROLE_CODE)?.id

function hasAdminRole(user: User): boolean {
  return DEMO_ADMIN_ROLE_ID !== undefined && user.roleIds.includes(DEMO_ADMIN_ROLE_ID)
}

function nowIso(): string {
  return new Date().toISOString()
}

// ── 端点实现（规格 §6.3/§14.3） ───────────────────────────────────────────────

function handleLogin(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const body = parseBody(config)
  const validator = new FieldValidator()
  const username = validator.requireString(body, 'username')
  // 密码任意（规格 §13.2），仅要求非空字符串存在
  validator.requireString(body, 'password')
  validator.throwIfInvalid()
  const account = findDemoAccount(username)
  if (account === null) {
    // 演示账号固定 admin/viewer（密码任意）；未知用户名按业务错误拒绝，fallback 不切换（规格 §13.1）
    throw new DemoEndpointError(401, API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, '用户名或密码错误')
  }
  const user = findUserById(account.userId)
  if (user === undefined) {
    throw new DemoEndpointError(500, API_ERROR_CODES.INTERNAL_ERROR, '演示账号缺少种子用户记录')
  }
  if (user.status === 'disabled') {
    throw new DemoEndpointError(403, API_ERROR_CODES.AUTH_ACCOUNT_DISABLED, '账号已被禁用，请联系管理员')
  }
  const tokens = issueTokenPair(account.username)
  const payload: LoginResponseDto = { ...tokens, user }
  return ok(payload)
}

function handleRefresh(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const body = parseBody(config)
  const validator = new FieldValidator()
  const dto: RefreshTokensRequestDto = { refreshToken: validator.requireString(body, 'refreshToken') }
  validator.throwIfInvalid()
  const account = validateRefreshToken(dto.refreshToken)
  const payload: RefreshTokensResponseDto = issueTokenPair(account.username)
  return ok(payload)
}

function handleLogout(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const body = parseBody(config)
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : null
  if (refreshToken !== null) {
    const parsed = parseRefreshToken(refreshToken)
    if (parsed !== null) {
      // 旋转时间戳推进到严格更大的签发时钟值：登出后该 refreshToken 立即失效（含此前签发的全部 token）
      refreshRotationStamps.set(
        parsed.username,
        Math.max(refreshRotationStamps.get(parsed.username) ?? 0, nextIssueTime()),
      )
    }
  }
  return ok(null)
}

function handleProfile(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const account = requireAccount(config)
  const user = findUserById(account.userId)
  if (user === undefined) {
    throw new DemoEndpointError(500, API_ERROR_CODES.INTERNAL_ERROR, '演示账号缺少种子用户记录')
  }
  if (user.status === 'disabled') {
    throw new DemoEndpointError(403, API_ERROR_CODES.AUTH_ACCOUNT_DISABLED, '账号已被禁用，请联系管理员')
  }
  const profile: ProfileData = {
    user,
    roleCodes: [...account.roleCodes],
    permCodes: [...account.permCodes],
    permissionVersion: account.permissionVersion,
  }
  return ok(profile)
}

/** 列表查询参数校验与归一（规格 §14.3：分页、sortBy 白名单、keyword 字段） */
interface UserListQuery {
  page: number
  size: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
  keyword: string
}

function parseUserListQuery(query: Record<string, string>): UserListQuery {
  const validator = new FieldValidator()
  const page = parsePositiveInt(query.page, PAGE_DEFAULT, 'page', validator)
  const size = parsePositiveInt(query.size, PAGE_SIZE_DEFAULT, 'size', validator)
  if (size > PAGE_SIZE_MAX) {
    validator.add('size', `size 不能超过 ${PAGE_SIZE_MAX}`)
  }
  const sortBy = query.sortBy ?? DEFAULT_SORT_BY
  if (!(USER_SORT_FIELDS as readonly string[]).includes(sortBy)) {
    validator.add('sortBy', `sortBy 必须是 ${USER_SORT_FIELDS.join(' | ')} 之一`)
  }
  const rawSortOrder = query.sortOrder ?? DEFAULT_SORT_ORDER
  if (rawSortOrder !== SORT_ORDERS.ASC && rawSortOrder !== SORT_ORDERS.DESC) {
    validator.add('sortOrder', 'sortOrder 必须是 asc | desc')
  }
  validator.throwIfInvalid()
  // 校验通过后归一为排序方向联合类型
  const sortOrder: SortOrder = rawSortOrder === SORT_ORDERS.DESC ? SORT_ORDERS.DESC : SORT_ORDERS.ASC
  return { page, size, sortBy, sortOrder, keyword: query.keyword?.trim() ?? '' }
}

function parsePositiveInt(raw: string | undefined, fallback: number, field: string, validator: FieldValidator): number {
  if (raw === undefined) {
    return fallback
  }
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    validator.add(field, `${field} 必须是不小于 1 的整数`)
    return fallback
  }
  return parsed
}

function compareUsersBy(field: string, sortOrder: 'asc' | 'desc'): (left: User, right: User) => number {
  const direction = sortOrder === SORT_ORDERS.DESC ? -1 : 1
  return (left, right) => {
    const leftValue = String(left[field as keyof User] ?? '')
    const rightValue = String(right[field as keyof User] ?? '')
    if (leftValue !== rightValue) {
      return leftValue < rightValue ? -direction : direction
    }
    // 稳定排序：主字段相等时按 id asc（规格 §14.3 兄弟节点稳定排序同思路）
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  }
}

function handleListUsers(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const account = requireAccount(config)
  requirePermission(account, PERMISSIONS.SYSTEM_USER_LIST)
  const query = parseUserListQuery(readQuery(config))
  const dataset = ensureDemoDataset()
  const keyword = query.keyword.toLowerCase()
  const filtered = dataset.users.filter((user) => {
    if (keyword.length === 0) {
      return true
    }
    // keyword 去首尾空白后对用户名/显示名不区分大小写包含匹配（规格 §14.3）
    return USER_KEYWORD_FIELDS.some((field) => String(user[field as keyof User]).toLowerCase().includes(keyword))
  })
  const sorted = [...filtered].sort(compareUsersBy(query.sortBy, query.sortOrder))
  const start = (query.page - 1) * query.size
  const page: PageResult<User> = {
    list: sorted.slice(start, start + query.size),
    total: sorted.length,
    page: query.page,
    size: query.size,
  }
  return ok(page)
}

const USER_STATUSES = ['enabled', 'disabled'] as const

/** 密码策略与创建/修改密码表单一致：最少 8 位且同时包含字母和数字（规格 §14.3） */
const DEMO_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

function handleCreateUser(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const account = requireAccount(config)
  requirePermission(account, PERMISSIONS.SYSTEM_USER_CREATE)
  const body = parseBody(config)
  const validator = new FieldValidator()
  const username = validator.requireString(body, 'username')
  const password = validator.requireString(body, 'password')
  const displayName = validator.requireString(body, 'displayName')
  const email = validator.requireString(body, 'email')
  const phone = validator.optionalString(body, 'phone')
  const status = validator.requireEnum(body, 'status', USER_STATUSES)
  const roleIds = validator.requireStringArray(body, 'roleIds')
  if (email.length > 0 && !USER_EMAIL_PATTERN.test(email)) {
    validator.add('email', 'email 格式不正确')
  }
  if (password.length > 0 && !DEMO_PASSWORD_PATTERN.test(password)) {
    validator.add('password', `密码最少 ${PASSWORD_MIN_LENGTH} 位且必须同时包含字母和数字`)
  }
  const knownRoleIds = new Set(DEMO_SEED_ROLES.map((role) => role.id))
  if (roleIds.length > 0 && !roleIds.every((roleId) => knownRoleIds.has(roleId))) {
    validator.add('roleIds', 'roleIds 包含未知的角色 ID')
  }
  validator.throwIfInvalid()
  const dataset = ensureDemoDataset()
  if (dataset.users.some((user) => user.username === username)) {
    throw new DemoEndpointError(409, API_ERROR_CODES.RESOURCE_CONFLICT, '用户名已存在')
  }
  const timestamp = nowIso()
  const created: User = {
    id: `${DEMO_USER_ID_PREFIX}${String(dataset.nextUserSequence).padStart(3, '0')}`,
    username,
    displayName,
    email,
    ...(phone !== undefined ? { phone } : {}),
    status,
    roleIds,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  dataset.nextUserSequence += 1
  dataset.users.push(created)
  persistDemoSnapshot()
  return ok(created)
}

function handleUpdateUser(config: InternalAxiosRequestConfig, params: Record<string, string>): DemoEndpointOutput {
  const account = requireAccount(config)
  requirePermission(account, PERMISSIONS.SYSTEM_USER_UPDATE)
  const target = findUserById(params.id ?? '')
  if (target === undefined) {
    throw new DemoEndpointError(404, API_ERROR_CODES.RESOURCE_NOT_FOUND, '请求的资源不存在')
  }
  const body = parseBody(config)
  const validator = new FieldValidator()
  const displayName = validator.requireString(body, 'displayName')
  const email = validator.requireString(body, 'email')
  const phone = validator.optionalString(body, 'phone')
  const status = validator.requireEnum(body, 'status', USER_STATUSES)
  if (email.length > 0 && !USER_EMAIL_PATTERN.test(email)) {
    validator.add('email', 'email 格式不正确')
  }
  validator.throwIfInvalid()
  // 禁用当前账号返回 RESOURCE_CONFLICT（规格 §14.3）；编辑契约不含 username/password/roleIds
  if (target.id === account.userId && status === 'disabled') {
    throw new DemoEndpointError(409, API_ERROR_CODES.RESOURCE_CONFLICT, '不能禁用当前登录账号')
  }
  target.displayName = displayName
  target.email = email
  if (phone === undefined) {
    delete target.phone
  } else {
    target.phone = phone
  }
  target.status = status
  target.updatedAt = nowIso()
  persistDemoSnapshot()
  return ok(target)
}

function handleDeleteUser(config: InternalAxiosRequestConfig, params: Record<string, string>): DemoEndpointOutput {
  const account = requireAccount(config)
  requirePermission(account, PERMISSIONS.SYSTEM_USER_DELETE)
  const target = findUserById(params.id ?? '')
  if (target === undefined) {
    throw new DemoEndpointError(404, API_ERROR_CODES.RESOURCE_NOT_FOUND, '请求的资源不存在')
  }
  if (target.id === account.userId) {
    throw new DemoEndpointError(409, API_ERROR_CODES.RESOURCE_CONFLICT, '不能删除当前登录账号')
  }
  const dataset = ensureDemoDataset()
  if (hasAdminRole(target) && dataset.users.filter((user) => hasAdminRole(user)).length === 1) {
    throw new DemoEndpointError(409, API_ERROR_CODES.RESOURCE_CONFLICT, '不能删除最后一个管理员')
  }
  dataset.users = dataset.users.filter((user) => user.id !== target.id)
  persistDemoSnapshot()
  return ok(null)
}

function handleAssignUserRoles(config: InternalAxiosRequestConfig, params: Record<string, string>): DemoEndpointOutput {
  const account = requireAccount(config)
  requirePermission(account, PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE)
  const target = findUserById(params.id ?? '')
  if (target === undefined) {
    throw new DemoEndpointError(404, API_ERROR_CODES.RESOURCE_NOT_FOUND, '请求的资源不存在')
  }
  const body = parseBody(config)
  const validator = new FieldValidator()
  const roleIds = validator.requireStringArray(body, 'roleIds')
  const knownRoleIds = new Set(DEMO_SEED_ROLES.map((role) => role.id))
  if (roleIds.length > 0 && !roleIds.every((roleId) => knownRoleIds.has(roleId))) {
    validator.add('roleIds', 'roleIds 包含未知的角色 ID')
  }
  validator.throwIfInvalid()
  target.roleIds = roleIds
  target.updatedAt = nowIso()
  persistDemoSnapshot()
  return ok(target)
}

// ── Dashboard 概览（规格 §14.3：GET /dashboard/overview → DashboardOverview） ─────────

/** 概览趋势窗口天数：loginTrend/userGrowth 展示最近 7 天（演示数据口径） */
const DEMO_OVERVIEW_TREND_DAYS = 7

/**
 * 概览数据全部由当前内存数据集推导，公式确定性、无随机数，测试与快照可复现；
 * 图表序列按日期升序，date 使用 YYYY-MM-DD（规格 §14.1）。
 */
function handleDashboardOverview(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const account = requireAccount(config)
  requirePermission(account, PERMISSIONS.DASHBOARD_VIEW)
  const dataset = ensureDemoDataset()
  const userCount = dataset.users.length
  const enabledUserCount = dataset.users.filter((user) => user.status === 'enabled').length
  const today = dayjs()
  const loginTrend = Array.from({ length: DEMO_OVERVIEW_TREND_DAYS }, (_, index) => ({
    date: today.subtract(DEMO_OVERVIEW_TREND_DAYS - 1 - index, 'day').format(DASHBOARD_DATE_FORMAT),
    count: enabledUserCount + index * 3,
  }))
  // 增长序列单调递增至当前总数，末位即 userCount
  const userGrowth = Array.from({ length: DEMO_OVERVIEW_TREND_DAYS }, (_, index) => ({
    date: today.subtract(DEMO_OVERVIEW_TREND_DAYS - 1 - index, 'day').format(DASHBOARD_DATE_FORMAT),
    count: Math.max(0, userCount - (DEMO_OVERVIEW_TREND_DAYS - 1 - index)),
  }))
  const roleDistribution = DEMO_SEED_ROLES.map((role) => ({
    roleName: role.name,
    count: dataset.users.filter((user) => user.roleIds.includes(role.id)).length,
  })).map(({ roleName, count }) => ({
    roleName,
    count,
    percent: userCount === 0 ? 0 : Math.round((count / userCount) * 100),
  }))
  const overview: DashboardOverview = {
    stats: {
      userCount,
      enabledUserCount,
      roleCount: DEMO_SEED_ROLES.length,
      todayLoginCount: userCount + enabledUserCount,
    },
    loginTrend,
    userGrowth,
    roleDistribution,
  }
  return ok(overview)
}

// ── 路由表：method + 路径模板 → handler；后续页面任务在此注册处扩展 ──────────────────

interface DemoRoute {
  method: string
  segments: readonly string[]
  handler: (config: InternalAxiosRequestConfig, params: Record<string, string>) => DemoEndpointOutput
}

function route(method: string, path: string, handler: DemoRoute['handler']): DemoRoute {
  return { method, segments: path.split('/').filter((segment) => segment.length > 0), handler }
}

const DEMO_ROUTES: readonly DemoRoute[] = [
  route('post', AUTH_ENDPOINTS.LOGIN, handleLogin),
  route('post', AUTH_ENDPOINTS.REFRESH, handleRefresh),
  route('post', AUTH_ENDPOINTS.LOGOUT, handleLogout),
  route('get', PROFILE_ENDPOINTS.GET_PROFILE, handleProfile),
  route('get', DASHBOARD_ENDPOINTS.OVERVIEW, handleDashboardOverview),
  route('get', USER_ENDPOINTS.LIST, handleListUsers),
  route('post', USER_ENDPOINTS.CREATE, handleCreateUser),
  // /users/:id/roles（4 段）先于 /users/:id（3 段）注册无歧义：按段数与字面量精确匹配
  route('put', USER_ENDPOINTS.ASSIGN_ROLES, handleAssignUserRoles),
  route('put', USER_ENDPOINTS.UPDATE, handleUpdateUser),
  route('delete', USER_ENDPOINTS.DELETE, handleDeleteUser),
]

function dispatchRequest(config: InternalAxiosRequestConfig): DemoEndpointOutput {
  const method = (config.method ?? 'get').toLowerCase()
  const path = (config.url ?? '').split('?')[0]
  const segments = path.split('/').filter((segment) => segment.length > 0)
  for (const candidate of DEMO_ROUTES) {
    if (candidate.method !== method || candidate.segments.length !== segments.length) {
      continue
    }
    const params: Record<string, string> = {}
    let matched = true
    for (let index = 0; index < segments.length; index += 1) {
      const pattern = candidate.segments[index]
      if (pattern.startsWith(':')) {
        params[pattern.slice(1)] = decodeURIComponent(segments[index])
        continue
      }
      if (pattern !== segments[index]) {
        matched = false
        break
      }
    }
    if (matched) {
      return candidate.handler(config, params)
    }
  }
  throw new DemoEndpointError(404, API_ERROR_CODES.RESOURCE_NOT_FOUND, 'demo adapter 未实现该端点')
}

function buildResponse(config: InternalAxiosRequestConfig, output: DemoEndpointOutput): AxiosResponse {
  return {
    data: output.data,
    status: output.status,
    statusText: output.status >= 200 && output.status < 300 ? 'OK' : 'Error',
    headers: new AxiosHeaders(),
    config,
    request: {},
  }
}

// ── adapter 入口：取消遵循 + DemoEndpointError → AxiosError（失败 envelope） ─────────

export const demoAdapter: AxiosAdapter = (config) =>
  new Promise<AxiosResponse>((resolve, reject) => {
    // 与真实 adapter 相同的取消时序：请求发出前/落定前 abort 均以 CanceledError 结束
    const signal = config.signal as AbortSignal | undefined
    const cancel = () => reject(new CanceledError('canceled', config))
    if (signal?.aborted) {
      cancel()
      return
    }
    signal?.addEventListener('abort', cancel, { once: true })
    const settle = () => signal?.removeEventListener('abort', cancel)
    let output: DemoEndpointOutput
    try {
      output = dispatchRequest(config)
    } catch (error) {
      settle()
      if (signal?.aborted) {
        cancel()
        return
      }
      if (error instanceof DemoEndpointError) {
        const response = buildResponse(config, endpointError(error))
        reject(
          new AxiosError(
            `Request failed with status code ${error.status}`,
            AxiosError.ERR_BAD_REQUEST,
            config,
            {},
            response,
          ),
        )
        return
      }
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }
    settle()
    if (signal?.aborted) {
      cancel()
      return
    }
    const response = buildResponse(config, output)
    if (output.status >= 200 && output.status < 300) {
      resolve(response)
    } else {
      reject(
        new AxiosError(
          `Request failed with status code ${output.status}`,
          AxiosError.ERR_BAD_REQUEST,
          config,
          {},
          response,
        ),
      )
    }
  })

// ── 测试专用失效控制器（规格 §13.2）：仅同目录测试与 E2E 引用，生产代码不得使用 ────────

/** 重置 token 运行态：失效标记、旋转时间戳与签发时钟；不动 CRUD 数据集（登出清理订阅使用，规格 §13.2） */
export function resetDemoTokenRuntime(): void {
  allAccessTokensInvalidated = false
  allRefreshTokensInvalidated = false
  invalidatedAccessAccounts.clear()
  invalidatedRefreshAccounts.clear()
  refreshRotationStamps.clear()
  lastTokenIssuedAt = 0
}

export const demoAdapterTestController = {
  /** 令指定账号（省略则全部账号）的 accessToken 立即失效：受保护端点返回 401 AUTH_ACCESS_EXPIRED */
  invalidateAccessTokens(username?: string): void {
    if (username === undefined) {
      allAccessTokensInvalidated = true
    } else {
      invalidatedAccessAccounts.add(username)
    }
  },
  /** 令指定账号（省略则全部账号）的 refreshToken 立即失效：刷新返回 401 AUTH_REFRESH_EXPIRED */
  invalidateRefreshTokens(username?: string): void {
    if (username === undefined) {
      allRefreshTokensInvalidated = true
    } else {
      invalidatedRefreshAccounts.add(username)
    }
  },
  /** 重置全部运行态（token 失效标记、旋转时间戳与内存数据集） */
  resetRuntime(options: { keepSnapshot?: boolean } = {}): void {
    resetDemoTokenRuntime()
    resetDemoDataset(options)
  },
}
