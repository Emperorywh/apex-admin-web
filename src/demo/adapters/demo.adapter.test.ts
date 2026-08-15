/**
 * demo adapter 契约测试（规格 §13.2/§7.1/§14.3/§14.4）：
 * - 与真实接口相同的 HTTP/envelope/errorCode 契约：失败 envelope { code, message, data: null, errorCode }，
 *   经 axiosErrorToApiError 转换后与真实后端语义一致；
 * - 登录（密码任意/未知用户名业务错误）、profile（token 过期/失效）、refresh 旋转与失效控制器、
 *   logout 令牌失效、用户 CRUD（分页白名单/唯一性/自删与末位 admin 冲突/越权 403/快照同步）；
 * - 版本化快照：损坏与旧版恢复种子并提示一次、keepSnapshot 模拟整页刷新重载、登出清除。
 */
import { AxiosHeaders } from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_ENDPOINTS } from '@/constants/auth/auth.constants'
import { PERMISSIONS } from '@/constants/permission.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { axiosErrorToApiError } from '@/services/request/envelope'
import { registerUiFeedbackInstances, resetUiFeedbackInstances, type UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { hasPermissionCode } from '@/store/permissions'
import type { ApiError } from '@/services/request/request.types'
import type { LoginResponseDto } from '@/services/auth/auth.service.types'
import type { ProfileData } from '@/types/auth/auth.types'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import type { PermissionNode, Role } from '@/types/system/role/role.types'
import { collectPermissionLeafCodes } from '@/utils/permissionTree'
import type { PageResult, User } from '@/types/system/user/user.types'
import { DEMO_ACCOUNT_USERNAMES, DEMO_SNAPSHOT_SCHEMA_VERSION, DEMO_SNAPSHOT_STORAGE_KEY } from '../demo.constants'
import { clearDemoDataOnLogout, readDemoSnapshotRaw } from '../demoData'
import { DEMO_SEED_ROLES } from '../fixtures/demoSeedData'
import { demoAdapter, demoAdapterTestController, formatDemoAccessToken, formatDemoRefreshToken } from './demo.adapter'

/** 构造直达 adapter 的请求配置；data 按 axios 序列化后形态传入（JSON 字符串） */
function demoConfig(options: {
  url: string
  method?: string
  data?: unknown
  params?: Record<string, unknown>
  token?: string | null
  signal?: AbortSignal
}): InternalAxiosRequestConfig {
  const headers = new AxiosHeaders()
  if (options.token !== undefined && options.token !== null) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }
  return {
    url: options.url,
    method: options.method ?? 'get',
    headers,
    data: options.data === undefined ? undefined : JSON.stringify(options.data),
    params: options.params,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  } as InternalAxiosRequestConfig
}

type AdapterOutcome = { ok: true; status: number; body: unknown } | { ok: false; error: AxiosError }

async function callAdapter(config: InternalAxiosRequestConfig): Promise<AdapterOutcome> {
  try {
    const response = await demoAdapter(config)
    return { ok: true, status: response.status, body: response.data }
  } catch (error) {
    return { ok: false, error: error as AxiosError }
  }
}

/** 断言失败契约并转换为 ApiError（与请求层一致的业务错误形状） */
async function expectFailure(config: InternalAxiosRequestConfig): Promise<{ apiError: ApiError; envelope: Record<string, unknown> }> {
  const outcome = await callAdapter(config)
  expect(outcome.ok).toBe(false)
  if (outcome.ok) {
    throw new Error('unreachable')
  }
  const response = outcome.error.response
  expect(response).toBeDefined()
  const envelope = response?.data as Record<string, unknown>
  // 失败 envelope 固定形状（规格 §7.1）：code/message/errorCode 存在且 data === null
  expect(envelope.data).toBeNull()
  expect(typeof envelope.errorCode).toBe('string')
  const apiError = await axiosErrorToApiError(outcome.error)
  return { apiError, envelope }
}

function envelopeData<T>(outcome: AdapterOutcome): T {
  expect(outcome.ok).toBe(true)
  if (outcome.ok !== true) {
    throw new Error('预期 adapter 成功响应')
  }
  expect(outcome.body).toMatchObject({ code: 0 })
  return (outcome.body as { data: T }).data
}

async function loginDemo(username: string): Promise<LoginResponseDto> {
  const outcome = await callAdapter(
    demoConfig({ method: 'post', url: AUTH_ENDPOINTS.LOGIN, data: { username, password: '任意密码' } }),
  )
  return envelopeData<LoginResponseDto>(outcome)
}

async function listUsers(token: string, params?: Record<string, unknown>): Promise<PageResult<User>> {
  const outcome = await callAdapter(demoConfig({ url: '/users', token, params }))
  return envelopeData<PageResult<User>>(outcome)
}

const CREATE_USER_BODY = {
  username: 'carol',
  password: 'carol123ab',
  displayName: '新演示用户',
  email: 'carol@apex.demo',
  status: 'enabled',
  roleIds: ['demo-role-viewer'],
}

let warningMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  demoAdapterTestController.resetRuntime()
  window.localStorage.clear()
  warningMock = vi.fn()
  registerUiFeedbackInstances({ message: { warning: warningMock } } as unknown as UiFeedbackInstances)
})

afterEach(() => {
  resetUiFeedbackInstances()
  window.localStorage.clear()
})

describe('登录端点（规格 §13.2：admin/viewer 密码任意）', () => {
  it('admin 任意密码登录：envelope code 0，签发 demo 前缀双 token 与种子用户', async () => {
    const result = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    expect(result.accessToken.startsWith('demo-at.admin.')).toBe(true)
    expect(result.refreshToken.startsWith('demo-rt.admin.')).toBe(true)
    expect(result.user).toMatchObject({ id: 'demo-user-001', username: 'admin', roleIds: ['demo-role-admin'] })
  })

  it('viewer 登录成功且 token 账号段为 viewer', async () => {
    const result = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    expect(result.accessToken.startsWith('demo-at.viewer.')).toBe(true)
  })

  it('未知用户名返回 401 AUTH_INVALID_CREDENTIALS：业务错误，fallback 不得切换（规格 §13.1）', async () => {
    const { apiError } = await expectFailure(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.LOGIN, data: { username: 'nobody', password: 'x' } }),
    )
    expect(apiError.httpStatus).toBe(401)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_INVALID_CREDENTIALS)
  })

  it('缺少 password 返回 400 VALIDATION_FAILED，details.fields 含 password', async () => {
    const { apiError, envelope } = await expectFailure(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.LOGIN, data: { username: 'admin' } }),
    )
    expect(apiError.httpStatus).toBe(400)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
    const fields = (envelope.details as { fields: Array<{ field: string }> }).fields
    expect(fields.map((issue) => issue.field)).toContain('password')
  })
})

describe('profile 端点（规格 §6.3/§5.3）', () => {
  it('admin token 返回 ProfileData：admin 角色通配任意权限码', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(demoConfig({ url: '/auth/profile', token: accessToken }))
    const profile = envelopeData<ProfileData>(outcome)
    expect(profile.user.username).toBe('admin')
    expect(profile.roleCodes).toEqual(['admin'])
    expect(hasPermissionCode(profile.permCodes, profile.roleCodes, PERMISSIONS.SYSTEM_MENU_CREATE)).toBe(true)
  })

  it('viewer token 权限严格符合 §5.3 最小权限码', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    const outcome = await callAdapter(demoConfig({ url: '/auth/profile', token: accessToken }))
    const profile = envelopeData<ProfileData>(outcome)
    expect([...profile.permCodes].sort()).toEqual(
      [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.DEMO_NESTED_VIEW].sort(),
    )
    expect(hasPermissionCode(profile.permCodes, profile.roleCodes, PERMISSIONS.DASHBOARD_VIEW)).toBe(true)
    expect(hasPermissionCode(profile.permCodes, profile.roleCodes, PERMISSIONS.SYSTEM_USER_CREATE)).toBe(false)
  })

  it('缺少认证头返回 401 AUTH_ACCESS_EXPIRED', async () => {
    const { apiError } = await expectFailure(demoConfig({ url: '/auth/profile', token: null }))
    expect(apiError.httpStatus).toBe(401)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_ACCESS_EXPIRED)
  })

  it('过期 accessToken 返回 401 AUTH_ACCESS_EXPIRED（触发请求层刷新单飞）', async () => {
    const expired = formatDemoAccessToken(DEMO_ACCOUNT_USERNAMES.ADMIN, Date.now() - 1_000)
    const { apiError } = await expectFailure(demoConfig({ url: '/auth/profile', token: expired }))
    expect(apiError.httpStatus).toBe(401)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_ACCESS_EXPIRED)
  })

  it('失效控制器令有效 accessToken 立即 401', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    demoAdapterTestController.invalidateAccessTokens(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const { apiError } = await expectFailure(demoConfig({ url: '/auth/profile', token: accessToken }))
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_ACCESS_EXPIRED)
  })
})

describe('dashboard 概览端点（规格 §14.3：GET /dashboard/overview）', () => {
  it('登录账号返回与真实接口同形的 DashboardOverview，序列按日期升序', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(demoConfig({ url: '/dashboard/overview', token: accessToken }))
    const overview = envelopeData<DashboardOverview>(outcome)
    // 统计卡四字段均为非负整数，且由当前数据集推导（种子 4 用户/3 启用/2 角色）
    expect(overview.stats).toMatchObject({
      userCount: expect.any(Number),
      enabledUserCount: expect.any(Number),
      roleCount: expect.any(Number),
      todayLoginCount: expect.any(Number),
    })
    expect(overview.stats.userCount).toBeGreaterThanOrEqual(4)
    expect(overview.stats.roleCount).toBe(2)
    // 图表序列按日期升序（规格 §14.1），date 为 YYYY-MM-DD
    for (const series of [overview.loginTrend, overview.userGrowth]) {
      expect(series.length).toBeGreaterThan(0)
      const dates = series.map((point) => point.date)
      expect([...dates].sort()).toEqual(dates)
      for (const point of series) {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(point.count).toBeGreaterThanOrEqual(0)
      }
    }
    // 角色分布与种子角色一一对应，percent 落在 0–100
    expect(overview.roleDistribution.map((item) => item.roleName)).toEqual(
      DEMO_SEED_ROLES.map((role) => role.name),
    )
    for (const item of overview.roleDistribution) {
      expect(item.count).toBeGreaterThanOrEqual(0)
      expect(item.percent).toBeGreaterThanOrEqual(0)
      expect(item.percent).toBeLessThanOrEqual(100)
    }
  })

  it('viewer 同样可访问（dashboard:view 属最小权限码，规格 §5.3）', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    const outcome = await callAdapter(demoConfig({ url: '/dashboard/overview', token: accessToken }))
    expect(envelopeData<DashboardOverview>(outcome).stats.roleCount).toBe(2)
  })

  it('缺少认证头返回 401 AUTH_ACCESS_EXPIRED', async () => {
    const { apiError } = await expectFailure(demoConfig({ url: '/dashboard/overview', token: null }))
    expect(apiError.httpStatus).toBe(401)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_ACCESS_EXPIRED)
  })
})

describe('refresh 端点（规格 §13.2：token 过期与旋转）', () => {
  it('刷新签发新双 token；旧 refreshToken 因旋转立即失效', async () => {
    const first = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.REFRESH, data: { refreshToken: first.refreshToken } }),
    )
    const rotated = envelopeData<{ accessToken: string; refreshToken: string }>(outcome)
    expect(rotated.accessToken).not.toBe(first.accessToken)
    expect(rotated.refreshToken).not.toBe(first.refreshToken)

    const replay = await expectFailure(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.REFRESH, data: { refreshToken: first.refreshToken } }),
    )
    expect(replay.apiError.httpStatus).toBe(401)
    expect(replay.apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })

  it('过期 refreshToken 返回 401 AUTH_REFRESH_EXPIRED', async () => {
    const expired = formatDemoRefreshToken(DEMO_ACCOUNT_USERNAMES.ADMIN, Date.now() - 1_000, Date.now() - 2_000)
    const { apiError } = await expectFailure(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.REFRESH, data: { refreshToken: expired } }),
    )
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })

  it('失效控制器令 refreshToken 立即失效', async () => {
    const { refreshToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    demoAdapterTestController.invalidateRefreshTokens()
    const { apiError } = await expectFailure(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.REFRESH, data: { refreshToken } }),
    )
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })

  it('非 demo 格式 refreshToken 返回 401 AUTH_REFRESH_EXPIRED', async () => {
    const { apiError } = await expectFailure(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.REFRESH, data: { refreshToken: 'garbage-token' } }),
    )
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })
})

describe('logout 端点（规格 §6.3/§13.2）', () => {
  it('data 为 null，且该 refreshToken 随后不可再刷新', async () => {
    const { refreshToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.LOGOUT, data: { refreshToken } }),
    )
    expect(envelopeData<null>(outcome)).toBeNull()

    const replay = await expectFailure(
      demoConfig({ method: 'post', url: AUTH_ENDPOINTS.REFRESH, data: { refreshToken } }),
    )
    expect(replay.apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })
})

describe('用户 CRUD（规格 §14.3）', () => {
  it('默认列表：createdAt 相同按 id asc 稳定排序，total 4、分页默认 page=1 size=10', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const page = await listUsers(accessToken)
    expect(page.total).toBe(4)
    expect(page.page).toBe(1)
    expect(page.size).toBe(10)
    expect(page.list.map((user) => user.username)).toEqual(['admin', 'viewer', 'alice', 'bob'])
  })

  it('keyword 去空白且大小写不敏感：AL 命中 alice，空串不过滤', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const page = await listUsers(accessToken, { keyword: '  AL ' })
    expect(page.list.map((user) => user.username)).toEqual(['alice'])
    const all = await listUsers(accessToken, { keyword: '   ' })
    expect(all.total).toBe(4)
  })

  it('非法 page/sortBy/size 返回 400 VALIDATION_FAILED 且 details.fields 对应字段', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    for (const params of [{ page: 0 }, { sortBy: 'password' }, { size: 101 }]) {
      const { apiError, envelope } = await expectFailure(demoConfig({ url: '/users', token: accessToken, params }))
      expect(apiError.httpStatus).toBe(400)
      expect(apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
      const fields = (envelope.details as { fields: Array<{ field: string }> }).fields
      expect(fields.length).toBeGreaterThan(0)
    }
  })

  it('viewer 无写权限：创建/删除返回 403 AUTH_FORBIDDEN（§5.3 矩阵）', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    const create = await expectFailure(
      demoConfig({ method: 'post', url: '/users', token: accessToken, data: CREATE_USER_BODY }),
    )
    expect(create.apiError.httpStatus).toBe(403)
    expect(create.apiError.errorCode).toBe(API_ERROR_CODES.AUTH_FORBIDDEN)
    const remove = await expectFailure(
      demoConfig({ method: 'delete', url: '/users/demo-user-004', token: accessToken }),
    )
    expect(remove.apiError.errorCode).toBe(API_ERROR_CODES.AUTH_FORBIDDEN)
  })

  it('admin 创建用户：新 ID 序号递增、进入列表并同步版本化快照', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({ method: 'post', url: '/users', token: accessToken, data: CREATE_USER_BODY }),
    )
    const created = envelopeData<User>(outcome)
    expect(created.id).toBe('demo-user-005')
    expect(created.username).toBe('carol')

    const page = await listUsers(accessToken)
    expect(page.total).toBe(5)
    expect(page.list.some((user) => user.username === 'carol')).toBe(true)

    const raw = readDemoSnapshotRaw()
    expect(raw).not.toBeNull()
    const snapshot = JSON.parse(raw ?? '{}')
    expect(snapshot.schemaVersion).toBe(DEMO_SNAPSHOT_SCHEMA_VERSION)
    expect(snapshot.users.some((user: User) => user.username === 'carol')).toBe(true)
  })

  it('重复用户名返回 409 RESOURCE_CONFLICT；非法 email/密码返回 400', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const duplicate = await expectFailure(
      demoConfig({
        method: 'post',
        url: '/users',
        token: accessToken,
        data: { ...CREATE_USER_BODY, username: 'admin' },
      }),
    )
    expect(duplicate.apiError.httpStatus).toBe(409)
    expect(duplicate.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    const invalid = await expectFailure(
      demoConfig({
        method: 'post',
        url: '/users',
        token: accessToken,
        data: { ...CREATE_USER_BODY, email: 'not-an-email', password: 'short' },
      }),
    )
    expect(invalid.apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
    const fields = (invalid.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']))
  })

  it('编辑用户更新可编辑字段并落快照；不存在的用户 404', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/users/demo-user-003',
        token: accessToken,
        data: { displayName: '更名爱丽丝', email: 'alice2@apex.demo', status: 'enabled' },
      }),
    )
    const updated = envelopeData<User>(outcome)
    expect(updated.displayName).toBe('更名爱丽丝')
    expect(JSON.parse(readDemoSnapshotRaw() ?? '{}').users.find((user: User) => user.id === 'demo-user-003').displayName).toBe(
      '更名爱丽丝',
    )

    const missing = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/users/demo-user-999',
        token: accessToken,
        data: { displayName: 'x', email: 'x@apex.demo', status: 'enabled' },
      }),
    )
    expect(missing.apiError.httpStatus).toBe(404)
    expect(missing.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_NOT_FOUND)
  })

  it('禁用当前登录账号返回 409 RESOURCE_CONFLICT；禁用他人成功', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const self = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/users/demo-user-001',
        token: accessToken,
        data: { displayName: '演示管理员', email: 'admin@apex.demo', status: 'disabled' },
      }),
    )
    expect(self.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    const other = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/users/demo-user-004',
        token: accessToken,
        data: { displayName: '演示用户·鲍勃', email: 'bob@apex.demo', status: 'enabled' },
      }),
    )
    expect(envelopeData<User>(other).status).toBe('enabled')
  })

  it('删除自己与删除最后一个 admin 返回 409；删除普通用户成功', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const self = await expectFailure(
      demoConfig({ method: 'delete', url: '/users/demo-user-001', token: accessToken }),
    )
    expect(self.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    // 构造"最后一个 admin"：新建 carol 并提为 admin，再把当前 admin 用户记录降为 viewer 角色
    // （账号权限来自 DemoAccount 通配，不随用户记录角色变化，操作可继续）
    await callAdapter(demoConfig({ method: 'post', url: '/users', token: accessToken, data: CREATE_USER_BODY }))
    await callAdapter(
      demoConfig({ method: 'put', url: '/users/demo-user-005/roles', token: accessToken, data: { roleIds: ['demo-role-admin'] } }),
    )
    await callAdapter(
      demoConfig({ method: 'put', url: '/users/demo-user-001/roles', token: accessToken, data: { roleIds: ['demo-role-viewer'] } }),
    )
    const lastAdmin = await expectFailure(
      demoConfig({ method: 'delete', url: '/users/demo-user-005', token: accessToken }),
    )
    expect(lastAdmin.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    const removed = await callAdapter(
      demoConfig({ method: 'delete', url: '/users/demo-user-004', token: accessToken }),
    )
    expect(envelopeData<null>(removed)).toBeNull()
    const page = await listUsers(accessToken)
    expect(page.total).toBe(4)
  })

  it('分配角色：未知 roleId 400；成功替换 roleIds 并落快照', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const invalid = await expectFailure(
      demoConfig({ method: 'put', url: '/users/demo-user-003/roles', token: accessToken, data: { roleIds: ['demo-role-none'] } }),
    )
    expect(invalid.apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)

    const outcome = await callAdapter(
      demoConfig({ method: 'put', url: '/users/demo-user-003/roles', token: accessToken, data: { roleIds: ['demo-role-admin'] } }),
    )
    expect(envelopeData<User>(outcome).roleIds).toEqual(['demo-role-admin'])
    expect(
      JSON.parse(readDemoSnapshotRaw() ?? '{}').users.find((user: User) => user.id === 'demo-user-003').roleIds,
    ).toEqual(['demo-role-admin'])
  })

  it('未实现端点返回 404 RESOURCE_NOT_FOUND（后续任务在路由表扩展）', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const { apiError } = await expectFailure(demoConfig({ url: '/menus/tree', token: accessToken }))
    expect(apiError.httpStatus).toBe(404)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_NOT_FOUND)
  })
})

describe('角色列表（规格 §14.3：用户管理分配角色消费）', () => {
  it('admin 分页查询角色：默认 createdAt desc，返回种子角色', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({ url: '/roles', token: accessToken, params: { page: '1', size: '10' } }),
    )
    const page = envelopeData<PageResult<Role>>(outcome)
    expect(page.total).toBe(2)
    expect(page.list.map((role) => role.code)).toEqual(['admin', 'viewer'])
  })

  it('keyword 对 code/name 不区分大小写包含匹配', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({ url: '/roles', token: accessToken, params: { keyword: ' VIEWER ' } }),
    )
    const page = envelopeData<PageResult<Role>>(outcome)
    expect(page.list.map((role) => role.code)).toEqual(['viewer'])
  })

  it('sortBy 白名单外返回 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const { apiError } = await expectFailure(
      demoConfig({ url: '/roles', token: accessToken, params: { sortBy: 'username' } }),
    )
    expect(apiError.httpStatus).toBe(400)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
  })

  it('viewer 无 system:role:list：403 AUTH_FORBIDDEN（规格 §5.3 角色管理矩阵）', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    const { apiError } = await expectFailure(demoConfig({ url: '/roles', token: accessToken }))
    expect(apiError.httpStatus).toBe(403)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_FORBIDDEN)
  })
})

describe('角色 CRUD 与权限树（规格 §14.3/§14.1）', () => {
  const CREATE_ROLE_BODY = { code: 'operator', name: '运营', description: '日常运营', status: 'enabled' }

  async function listRoles(token: string, params?: Record<string, unknown>): Promise<PageResult<Role>> {
    const outcome = await callAdapter(demoConfig({ url: '/roles', token, params }))
    return envelopeData<PageResult<Role>>(outcome)
  }

  it('admin 创建角色：新 ID 序号递增、builtIn false、permCodes 空、进入列表并落快照', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({ method: 'post', url: '/roles', token: accessToken, data: CREATE_ROLE_BODY }),
    )
    const created = envelopeData<Role>(outcome)
    expect(created).toMatchObject({ id: 'demo-role-001', code: 'operator', builtIn: false, permCodes: [] })

    const page = await listRoles(accessToken)
    expect(page.total).toBe(3)
    expect(page.list.map((role) => role.code)).toContain('operator')
    // 版本化快照同步写入角色集合（schemaVersion 与 roles 字段）
    const snapshot = JSON.parse(readDemoSnapshotRaw() ?? '{}')
    expect(snapshot.schemaVersion).toBe(DEMO_SNAPSHOT_SCHEMA_VERSION)
    expect(snapshot.roles.map((role: Role) => role.code)).toContain('operator')
  })

  it('重复 code 返回 409 RESOURCE_CONFLICT；缺 code/name 与非法 status 返回 400', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const conflict = await expectFailure(
      demoConfig({ method: 'post', url: '/roles', token: accessToken, data: { code: 'viewer', name: '重复', status: 'enabled' } }),
    )
    expect(conflict.apiError.httpStatus).toBe(409)
    expect(conflict.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    const invalid = await expectFailure(
      demoConfig({ method: 'post', url: '/roles', token: accessToken, data: { code: '', name: '', status: 'frozen' } }),
    )
    expect(invalid.apiError.httpStatus).toBe(400)
    expect(invalid.apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
    const fields = (invalid.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
    expect(fields).toEqual(expect.arrayContaining(['code', 'name', 'status']))
  })

  it('viewer 无写权限：创建/编辑/删除/分配权限全部 403 AUTH_FORBIDDEN（§5.3 矩阵）', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    for (const config of [
      demoConfig({ method: 'post', url: '/roles', token: accessToken, data: CREATE_ROLE_BODY }),
      demoConfig({ method: 'put', url: '/roles/demo-role-viewer', token: accessToken, data: { name: 'x', status: 'enabled' } }),
      demoConfig({ method: 'delete', url: '/roles/demo-role-viewer', token: accessToken }),
      demoConfig({ method: 'put', url: '/roles/demo-role-viewer/permissions', token: accessToken, data: { permCodes: [] } }),
    ]) {
      const { apiError } = await expectFailure(config)
      expect(apiError.httpStatus).toBe(403)
      expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_FORBIDDEN)
    }
  })

  it('编辑角色：name/description/status 更新、description 省略即移除、body 中的 code 被忽略；不存在 404', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/roles/demo-role-viewer',
        token: accessToken,
        // 编辑契约外多传 code：后端忽略，code 保持不变
        data: { code: 'hacked', name: '访客（只读）', description: '仅查看', status: 'enabled' },
      }),
    )
    const updated = envelopeData<Role>(outcome)
    expect(updated.code).toBe('viewer')
    expect(updated.name).toBe('访客（只读）')
    expect(updated.description).toBe('仅查看')

    const removed = await callAdapter(
      demoConfig({ method: 'put', url: '/roles/demo-role-viewer', token: accessToken, data: { name: '访客', status: 'enabled' } }),
    )
    expect(envelopeData<Role>(removed).description).toBeUndefined()

    const missing = await expectFailure(
      demoConfig({ method: 'put', url: '/roles/demo-role-none', token: accessToken, data: { name: 'x', status: 'enabled' } }),
    )
    expect(missing.apiError.httpStatus).toBe(404)
    expect(missing.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_NOT_FOUND)
  })

  it('删除角色：builtIn 与被用户引用返回 409 RESOURCE_CONFLICT；未引用的新建角色删除成功', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    // builtIn 角色禁止删除（规格 §14.1）
    const builtIn = await expectFailure(
      demoConfig({ method: 'delete', url: '/roles/demo-role-viewer', token: accessToken }),
    )
    expect(builtIn.apiError.httpStatus).toBe(409)
    expect(builtIn.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    // 新建 operator 并分配给用户 alice：被引用同样拒绝
    await callAdapter(demoConfig({ method: 'post', url: '/roles', token: accessToken, data: CREATE_ROLE_BODY }))
    await callAdapter(
      demoConfig({ method: 'put', url: '/users/demo-user-003/roles', token: accessToken, data: { roleIds: ['demo-role-001'] } }),
    )
    const referenced = await expectFailure(
      demoConfig({ method: 'delete', url: '/roles/demo-role-001', token: accessToken }),
    )
    expect(referenced.apiError.httpStatus).toBe(409)
    expect(referenced.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    // 未分配给任何用户的新建角色：删除成功并从列表移除
    await callAdapter(
      demoConfig({ method: 'post', url: '/roles', token: accessToken, data: { code: 'auditor', name: '审计', status: 'enabled' } }),
    )
    const outcome = await callAdapter(
      demoConfig({ method: 'delete', url: '/roles/demo-role-002', token: accessToken }),
    )
    expect(envelopeData<null>(outcome)).toBeNull()
    const page = await listRoles(accessToken)
    expect(page.list.map((role) => role.code)).toContain('operator')
    expect(page.list.map((role) => role.code)).not.toContain('auditor')
  })

  it('分配权限：未知权限码 400 VALIDATION_FAILED；成功去重替换 permCodes 并落快照', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const invalid = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/roles/demo-role-viewer/permissions',
        token: accessToken,
        data: { permCodes: [PERMISSIONS.DASHBOARD_VIEW, 'system:none:fake'] },
      }),
    )
    expect(invalid.apiError.httpStatus).toBe(400)
    expect(invalid.apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
    const fields = (invalid.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
    expect(fields).toContain('permCodes')

    const outcome = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/roles/demo-role-viewer/permissions',
        token: accessToken,
        // 重复权限码去重；'/'（通配符不在权限树内）不合法，不参与本用例
        data: { permCodes: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST] },
      }),
    )
    const updated = envelopeData<Role>(outcome)
    expect(updated.permCodes).toEqual([PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST])
    const snapshot = JSON.parse(readDemoSnapshotRaw() ?? '{}')
    expect(snapshot.roles.find((role: Role) => role.id === 'demo-role-viewer').permCodes).toEqual([
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SYSTEM_USER_LIST,
    ])
  })

  it('权限树：叶子权限码集合与 §5.1 全部正式权限码一致；目录节点无 permCode；viewer 403', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(demoConfig({ url: '/permissions/tree', token: accessToken }))
    const tree = envelopeData<PermissionNode[]>(outcome)
    // 叶子权限码恰为 16 个正式权限码（§5.1），无重复
    const leafCodes = collectPermissionLeafCodes(tree)
    expect(new Set(leafCodes).size).toBe(leafCodes.length)
    expect([...leafCodes].sort()).toEqual(Object.values(PERMISSIONS).sort())
    // 仅叶子提供 permCode（§14.1）：顶层目录节点不含 permCode
    expect(tree.every((node) => node.permCode === undefined)).toBe(true)

    const { accessToken: viewerToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    const forbidden = await expectFailure(demoConfig({ url: '/permissions/tree', token: viewerToken }))
    expect(forbidden.apiError.httpStatus).toBe(403)
    expect(forbidden.apiError.errorCode).toBe(API_ERROR_CODES.AUTH_FORBIDDEN)
  })

  it('角色 CRUD 后 keepSnapshot 模拟整页刷新：角色结果从快照恢复', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    await callAdapter(demoConfig({ method: 'post', url: '/roles', token: accessToken, data: CREATE_ROLE_BODY }))
    demoAdapterTestController.resetRuntime({ keepSnapshot: true })
    const page = await listRoles(accessToken)
    expect(page.list.map((role) => role.code)).toContain('operator')
  })
})

describe('版本化快照（规格 §13.2）', () => {
  it('损坏快照首次访问恢复种子数据并提示一次', async () => {
    window.localStorage.setItem(DEMO_SNAPSHOT_STORAGE_KEY, '{not-json')
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const page = await listUsers(accessToken)
    expect(page.total).toBe(4)
    expect(warningMock).toHaveBeenCalledTimes(1)
    // 同一会话内第二次访问不再提示
    await listUsers(accessToken)
    expect(warningMock).toHaveBeenCalledTimes(1)
  })

  it('旧版本快照（schemaVersion 不一致）恢复种子并提示', async () => {
    window.localStorage.setItem(
      DEMO_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, users: [], nextUserSequence: 9 }),
    )
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const page = await listUsers(accessToken)
    expect(page.total).toBe(4)
    expect(warningMock).toHaveBeenCalledTimes(1)
  })

  it('keepSnapshot 重置模拟整页刷新：CRUD 结果从快照恢复', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    await callAdapter(demoConfig({ method: 'post', url: '/users', token: accessToken, data: CREATE_USER_BODY }))
    demoAdapterTestController.resetRuntime({ keepSnapshot: true })
    const refreshed = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const page = await listUsers(refreshed.accessToken)
    expect(page.total).toBe(5)
    expect(page.list.some((user) => user.username === 'carol')).toBe(true)
  })

  it('clearDemoDataOnLogout：移除快照并把数据集重置回种子', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    await callAdapter(demoConfig({ method: 'post', url: '/users', token: accessToken, data: CREATE_USER_BODY }))
    expect(readDemoSnapshotRaw()).not.toBeNull()

    clearDemoDataOnLogout()
    expect(readDemoSnapshotRaw()).toBeNull()
    const refreshed = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const page = await listUsers(refreshed.accessToken)
    expect(page.total).toBe(4)
  })
})

describe('取消契约（规格 §7.4-9）', () => {
  it('请求发出前已 abort 的 signal 以 CanceledError 结束', async () => {
    const controller = new AbortController()
    controller.abort()
    const outcome = await callAdapter(
      demoConfig({ url: '/auth/profile', token: 'demo-at.admin.9999999999999', signal: controller.signal }),
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok !== false) {
      throw new Error('预期 adapter 取消拒绝')
    }
    expect(outcome.error.name).toBe('CanceledError')
  })
})
