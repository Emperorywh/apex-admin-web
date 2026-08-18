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
import { PERMISSIONS } from '@/constants/permission.constants'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_PAGE_ROUTE_IDS } from '@/constants/system/menu/menu.constants'
import { axiosErrorToApiError } from '@/services/request/envelope'
import { registerUiFeedbackInstances, resetUiFeedbackInstances, type UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { hasPermissionCode } from '@/store/permissions'
import type { ApiError } from '@/services/request/request.types'
import type { LoginResponseDto } from '@/services/auth/auth.service.types'
import type { ProfileData } from '@/types/auth/auth.types'
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'
import type { MenuItem } from '@/types/system/menu/menu.types'
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
    demoConfig({ method: 'post', url: '/auth/login', data: { username, password: '任意密码' } }),
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
      demoConfig({ method: 'post', url: '/auth/login', data: { username: 'nobody', password: 'x' } }),
    )
    expect(apiError.httpStatus).toBe(401)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_INVALID_CREDENTIALS)
  })

  it('缺少 password 返回 400 VALIDATION_FAILED，details.fields 含 password', async () => {
    const { apiError, envelope } = await expectFailure(
      demoConfig({ method: 'post', url: '/auth/login', data: { username: 'admin' } }),
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

  it('编辑资料：PUT /auth/profile 更新当前账号用户记录、落快照，后续 profile 与用户列表立即反映新资料', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    const outcome = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/auth/profile',
        token: accessToken,
        data: { displayName: '演示访客·已改名', email: 'viewer2@apex.demo', phone: '13900000002' },
      }),
    )
    const updated = envelopeData<User>(outcome)
    expect(updated).toMatchObject({
      id: 'demo-user-002',
      username: 'viewer',
      displayName: '演示访客·已改名',
      email: 'viewer2@apex.demo',
      phone: '13900000002',
    })
    // username/status/roleIds 等不受编辑契约影响（规格 §14.3）
    expect(updated.roleIds).toEqual(['demo-role-viewer'])

    const profile = envelopeData<ProfileData>(
      await callAdapter(demoConfig({ url: '/auth/profile', token: accessToken })),
    )
    expect(profile.user.displayName).toBe('演示访客·已改名')

    const page = await listUsers(accessToken, { page: 1, size: 100 })
    expect(page.list.find((user) => user.id === 'demo-user-002')?.email).toBe('viewer2@apex.demo')
    expect(
      JSON.parse(readDemoSnapshotRaw() ?? '{}').users.find((user: User) => user.id === 'demo-user-002').displayName,
    ).toBe('演示访客·已改名')
  })

  it('编辑资料：空 displayName/非法 email 400 VALIDATION_FAILED 字段映射；空串 phone 按未填清除', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const { envelope } = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/auth/profile',
        token: accessToken,
        data: { displayName: '', email: 'not-an-email' },
      }),
    )
    expect(envelope.code).toBe(400)
    expect(envelope.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
    const fields = (envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
    expect(fields).toEqual(expect.arrayContaining(['displayName', 'email']))

    const outcome = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/auth/profile',
        token: accessToken,
        data: { displayName: '演示管理员', email: 'admin@apex.demo', phone: '' },
      }),
    )
    expect(envelopeData<User>(outcome).phone).toBeUndefined()
  })

  it('编辑资料：未登录 401', async () => {
    const { apiError } = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/auth/profile',
        token: null,
        data: { displayName: 'x', email: 'x@apex.demo' },
      }),
    )
    expect(apiError.httpStatus).toBe(401)
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_ACCESS_EXPIRED)
  })

  it('修改密码：合法载荷返回 data null；弱密码 400 映射 newPassword；缺 oldPassword 400', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/auth/password',
        token: accessToken,
        data: { oldPassword: '任意旧密码', newPassword: 'fresh12345' },
      }),
    )
    expect(envelopeData<null>(outcome)).toBeNull()

    const weak = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/auth/password',
        token: accessToken,
        data: { oldPassword: '任意旧密码', newPassword: 'short' },
      }),
    )
    expect(weak.apiError.httpStatus).toBe(400)
    const fields = (weak.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
    expect(fields).toContain('newPassword')

    const missing = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/auth/password',
        token: accessToken,
        data: { newPassword: 'fresh12345' },
      }),
    )
    expect(missing.apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
    expect(
      (missing.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field),
    ).toContain('oldPassword')
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
      demoConfig({ method: 'post', url: '/auth/refresh', data: { refreshToken: first.refreshToken } }),
    )
    const rotated = envelopeData<{ accessToken: string; refreshToken: string }>(outcome)
    expect(rotated.accessToken).not.toBe(first.accessToken)
    expect(rotated.refreshToken).not.toBe(first.refreshToken)

    const replay = await expectFailure(
      demoConfig({ method: 'post', url: '/auth/refresh', data: { refreshToken: first.refreshToken } }),
    )
    expect(replay.apiError.httpStatus).toBe(401)
    expect(replay.apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })

  it('过期 refreshToken 返回 401 AUTH_REFRESH_EXPIRED', async () => {
    const expired = formatDemoRefreshToken(DEMO_ACCOUNT_USERNAMES.ADMIN, Date.now() - 1_000, Date.now() - 2_000)
    const { apiError } = await expectFailure(
      demoConfig({ method: 'post', url: '/auth/refresh', data: { refreshToken: expired } }),
    )
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })

  it('失效控制器令 refreshToken 立即失效', async () => {
    const { refreshToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    demoAdapterTestController.invalidateRefreshTokens()
    const { apiError } = await expectFailure(
      demoConfig({ method: 'post', url: '/auth/refresh', data: { refreshToken } }),
    )
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })

  it('非 demo 格式 refreshToken 返回 401 AUTH_REFRESH_EXPIRED', async () => {
    const { apiError } = await expectFailure(
      demoConfig({ method: 'post', url: '/auth/refresh', data: { refreshToken: 'garbage-token' } }),
    )
    expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_REFRESH_EXPIRED)
  })
})

describe('logout 端点（规格 §6.3/§13.2）', () => {
  it('data 为 null，且该 refreshToken 随后不可再刷新', async () => {
    const { refreshToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({ method: 'post', url: '/auth/logout', data: { refreshToken } }),
    )
    expect(envelopeData<null>(outcome)).toBeNull()

    const replay = await expectFailure(
      demoConfig({ method: 'post', url: '/auth/refresh', data: { refreshToken } }),
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
    // 单用户详情查询（GET /users/:id）当前未注册：未实现端点统一 404
    const { apiError } = await expectFailure(
      demoConfig({ url: '/users/demo-user-001', token: accessToken }),
    )
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

describe('菜单树与菜单 CRUD（规格 §14.3/§14.1）', () => {
  async function fetchMenuTree(token: string): Promise<MenuItem[]> {
    const outcome = await callAdapter(demoConfig({ url: '/menus/tree', token }))
    return envelopeData<MenuItem[]>(outcome)
  }

  it('菜单树：种子树形结构与稳定排序（sort asc），page 携带 routeId/path、button 携带 permCode', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const tree = await fetchMenuTree(accessToken)
    // 根级兄弟按 sort asc（仪表盘 1、系统管理 2、演示 3）
    expect(tree.map((node) => node.id)).toEqual(['demo-menu-dashboard', 'demo-menu-system', 'demo-menu-demo'])
    const system = tree[1]
    expect(system.type).toBe('directory')
    expect(system.children?.map((node) => node.id)).toEqual([
      'demo-menu-system-user',
      'demo-menu-system-role',
      'demo-menu-system-menu',
    ])
    const userPage = system.children![0]
    expect(userPage.routeId).toBe('system-user')
    expect(userPage.path).toBe('/system/user')
    expect(userPage.children?.map((node) => node.permCode)).toEqual([
      PERMISSIONS.SYSTEM_USER_LIST,
      PERMISSIONS.SYSTEM_USER_CREATE,
      PERMISSIONS.SYSTEM_USER_UPDATE,
      PERMISSIONS.SYSTEM_USER_DELETE,
      PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE,
    ])
    // 种子全部 page routeId 均在可识别全集内（对照 route.constants；不预置未注册 routeId 数据）
    const pageRouteIds: string[] = []
    const walk = (nodes: readonly MenuItem[]): void => {
      for (const node of nodes) {
        if (node.type === 'page') {
          pageRouteIds.push(node.routeId ?? '')
        }
        if (node.children !== undefined) {
          walk(node.children)
        }
      }
    }
    walk(tree)
    expect(pageRouteIds.length).toBeGreaterThanOrEqual(4)
    for (const routeId of pageRouteIds) {
      expect(MENU_PAGE_ROUTE_IDS).toContain(routeId)
    }
    // 多级菜单演示种子（规格 §14.2）：演示 > 多级菜单 > 三个层级页面，
    // routeId/path 与静态路由定义一致（ROUTE_IDS/ROUTE_PATHS 权威值）
    const demo = tree[2]
    expect(demo.type).toBe('directory')
    const nested = demo.children?.[0]
    expect(nested?.id).toBe('demo-menu-nested')
    expect(nested?.children?.map((node) => node.routeId)).toEqual([
      ROUTE_IDS.DEMO_NESTED_LEVEL1,
      ROUTE_IDS.DEMO_NESTED_LEVEL2,
      ROUTE_IDS.DEMO_NESTED_LEVEL3,
    ])
    expect(nested?.children?.map((node) => node.path)).toEqual([
      ROUTE_PATHS.DEMO_NESTED_LEVEL1,
      ROUTE_PATHS.DEMO_NESTED_LEVEL2,
      ROUTE_PATHS.DEMO_NESTED_LEVEL3,
    ])
  })

  it('创建菜单：page 携带可识别 routeId 落库并进入树（sort asc 定位），ID 序号递增、同步快照', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const outcome = await callAdapter(
      demoConfig({
        method: 'post',
        url: '/menus',
        token: accessToken,
        data: { parentId: null, type: 'page', name: '个人中心', routeId: 'profile', path: '/profile', sort: 5, visible: true, status: 'enabled' },
      }),
    )
    const created = envelopeData<MenuItem>(outcome)
    expect(created).toMatchObject({ id: 'demo-menu-001', type: 'page', routeId: 'profile', path: '/profile', parentId: null })

    const tree = await fetchMenuTree(accessToken)
    expect(tree.map((node) => node.id)).toEqual(['demo-menu-dashboard', 'demo-menu-system', 'demo-menu-demo', 'demo-menu-001'])
    const snapshot = JSON.parse(readDemoSnapshotRaw() ?? '{}')
    expect(snapshot.schemaVersion).toBe(DEMO_SNAPSHOT_SCHEMA_VERSION)
    expect(snapshot.menus.map((menu: MenuItem) => menu.id)).toContain('demo-menu-001')
  })

  it('按类型条件校验（写入契约）：directory 带 routeId、page 缺/不可识别 routeId、button 缺/未知 permCode、未知 parentId 均 400', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const cases: Array<{ body: Record<string, unknown>; field: string }> = [
      // directory 不得设置 routeId
      { body: { parentId: null, type: 'directory', name: '目录', routeId: 'dashboard', sort: 1, visible: true, status: 'enabled' }, field: 'routeId' },
      // page 必须设置 routeId / 必须可识别
      { body: { parentId: null, type: 'page', name: '页面', sort: 1, visible: true, status: 'enabled' }, field: 'routeId' },
      { body: { parentId: null, type: 'page', name: '页面', routeId: 'no-such-route', sort: 1, visible: true, status: 'enabled' }, field: 'routeId' },
      // button 必须设置 permCode / 必须已知
      { body: { parentId: null, type: 'button', name: '按钮', sort: 1, visible: true, status: 'enabled' }, field: 'permCode' },
      { body: { parentId: null, type: 'button', name: '按钮', permCode: 'system:none:fake', sort: 1, visible: true, status: 'enabled' }, field: 'permCode' },
      // parentId 必须指向现存菜单
      { body: { parentId: 'no-such-menu', type: 'directory', name: '目录', sort: 1, visible: true, status: 'enabled' }, field: 'parentId' },
    ]
    for (const { body, field } of cases) {
      const invalid = await expectFailure(demoConfig({ method: 'post', url: '/menus', token: accessToken, data: body }))
      expect(invalid.apiError.httpStatus, JSON.stringify(body)).toBe(400)
      expect(invalid.apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
      const fields = (invalid.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
      expect(fields).toContain(field)
    }

    // 基础字段校验：非法 type、空 name、非整数 sort、非布尔 visible
    const malformed = await expectFailure(
      demoConfig({
        method: 'post',
        url: '/menus',
        token: accessToken,
        data: { parentId: null, type: 'frozen', name: '', sort: 1.5, visible: 'yes', status: 'enabled' },
      }),
    )
    expect(malformed.apiError.httpStatus).toBe(400)
    const fields = (malformed.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
    expect(fields).toEqual(expect.arrayContaining(['type', 'name', 'sort', 'visible']))
  })

  it('编辑菜单：字段更新且类型切换清理独占字段；parentId 成环 400；不存在 404', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    // page → directory：routeId/path 从数据中移除
    const outcome = await callAdapter(
      demoConfig({
        method: 'put',
        url: '/menus/demo-menu-dashboard',
        token: accessToken,
        data: { parentId: null, type: 'directory', name: '仪表盘目录', sort: 1, visible: false, status: 'disabled' },
      }),
    )
    const updated = envelopeData<MenuItem>(outcome)
    expect(updated).toMatchObject({ name: '仪表盘目录', sort: 1, visible: false, status: 'disabled' })
    expect(updated.routeId).toBeUndefined()
    expect(updated.path).toBeUndefined()
    const tree = await fetchMenuTree(accessToken)
    expect(tree.find((menu) => menu.id === 'demo-menu-dashboard')?.routeId).toBeUndefined()

    // 成环：目录挂到自己的子页面下（400，父链非法）
    const cycle = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/menus/demo-menu-system',
        token: accessToken,
        data: { parentId: 'demo-menu-system-user', type: 'directory', name: '系统管理', sort: 2, visible: true, status: 'enabled' },
      }),
    )
    expect(cycle.apiError.httpStatus).toBe(400)
    expect(cycle.apiError.errorCode).toBe(API_ERROR_CODES.VALIDATION_FAILED)
    const cycleFields = (cycle.envelope.details as { fields: Array<{ field: string }> }).fields.map((issue) => issue.field)
    expect(cycleFields).toContain('parentId')

    const missing = await expectFailure(
      demoConfig({
        method: 'put',
        url: '/menus/demo-menu-none',
        token: accessToken,
        data: { parentId: null, type: 'directory', name: 'x', sort: 1, visible: true, status: 'enabled' },
      }),
    )
    expect(missing.apiError.httpStatus).toBe(404)
    expect(missing.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_NOT_FOUND)
  })

  it('删除菜单：存在子节点返回 409 RESOURCE_CONFLICT；叶子删除成功并从树移除', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    const conflict = await expectFailure(
      demoConfig({ method: 'delete', url: '/menus/demo-menu-system', token: accessToken }),
    )
    expect(conflict.apiError.httpStatus).toBe(409)
    expect(conflict.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_CONFLICT)

    // 叶子按钮：删除成功
    const outcome = await callAdapter(
      demoConfig({ method: 'delete', url: '/menus/demo-menu-user-list', token: accessToken }),
    )
    expect(envelopeData<null>(outcome)).toBeNull()
    const tree = await fetchMenuTree(accessToken)
    const userPage = tree[1].children?.find((menu) => menu.id === 'demo-menu-system-user')
    expect(userPage?.children?.map((node) => node.id)).not.toContain('demo-menu-user-list')

    const missing = await expectFailure(
      demoConfig({ method: 'delete', url: '/menus/demo-menu-none', token: accessToken }),
    )
    expect(missing.apiError.httpStatus).toBe(404)
    expect(missing.apiError.errorCode).toBe(API_ERROR_CODES.RESOURCE_NOT_FOUND)
  })

  it('viewer 无菜单权限：树查询与写操作全部 403 AUTH_FORBIDDEN（§5.3 矩阵）', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.VIEWER)
    const writeBody = { parentId: null, type: 'directory', name: '越权', sort: 1, visible: true, status: 'enabled' }
    for (const config of [
      demoConfig({ url: '/menus/tree', token: accessToken }),
      demoConfig({ method: 'post', url: '/menus', token: accessToken, data: writeBody }),
      demoConfig({ method: 'put', url: '/menus/demo-menu-system', token: accessToken, data: writeBody }),
      demoConfig({ method: 'delete', url: '/menus/demo-menu-system', token: accessToken }),
    ]) {
      const { apiError } = await expectFailure(config)
      expect(apiError.httpStatus).toBe(403)
      expect(apiError.errorCode).toBe(API_ERROR_CODES.AUTH_FORBIDDEN)
    }
  })

  it('同 sort 兄弟按 id asc 稳定排序（规格 §14.3）', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    for (const name of ['甲目录', '乙目录']) {
      await callAdapter(
        demoConfig({
          method: 'post',
          url: '/menus',
          token: accessToken,
          data: { parentId: null, type: 'directory', name, sort: 9, visible: true, status: 'enabled' },
        }),
      )
    }
    const tree = await fetchMenuTree(accessToken)
    expect(tree.filter((node) => node.sort === 9).map((node) => node.id)).toEqual(['demo-menu-001', 'demo-menu-002'])
  })

  it('菜单 CRUD 后 keepSnapshot 模拟整页刷新：菜单结果从快照恢复', async () => {
    const { accessToken } = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    await callAdapter(
      demoConfig({
        method: 'post',
        url: '/menus',
        token: accessToken,
        data: { parentId: null, type: 'page', name: '个人中心', routeId: 'profile', sort: 5, visible: true, status: 'enabled' },
      }),
    )
    demoAdapterTestController.resetRuntime({ keepSnapshot: true })
    const tree = await fetchMenuTree(accessToken)
    expect(tree.map((node) => node.id)).toContain('demo-menu-001')
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

describe('测试控制器可观测性面（规格 §13.2：E2E 调用记录与人工延迟）', () => {
  it('失效后 refresh 签发的新 token 立即生效：401 → 刷新 → 重放成功链路可用（规格 §13.2）', async () => {
    const login = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    demoAdapterTestController.invalidateAccessTokens()
    // 既有 token 立即 401
    const denied = await callAdapter(demoConfig({ url: '/auth/profile', token: login.accessToken }))
    expect(denied.ok).toBe(false)
    // refresh 签发新 token 对：失效自动恢复（否则重放永远 401，无法验证单飞重放）
    const refreshed = await callAdapter(
      demoConfig({
        method: 'post',
        url: '/auth/refresh',
        data: { refreshToken: login.refreshToken },
      }),
    )
    expect(refreshed.ok).toBe(true)
    const tokens = envelopeData<{ accessToken: string; refreshToken: string }>(refreshed)
    // 新 token 重放成功
    const replay = await callAdapter(demoConfig({ url: '/auth/profile', token: tokens.accessToken }))
    expect(replay.ok).toBe(true)
  })

  it('记录成功、失败与取消三类调用的 method/path/status/outcome', async () => {
    demoAdapterTestController.clearCallLog()
    const login = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    // 失败：过期 token 的受保护请求 → 401 AUTH_ACCESS_EXPIRED
    await callAdapter(demoConfig({ url: '/auth/profile', token: formatDemoAccessToken('admin', Date.now() - 1) }))
    // 取消：请求发出前已 abort
    const controller = new AbortController()
    controller.abort()
    await callAdapter(demoConfig({ url: '/users', token: login.accessToken, signal: controller.signal }))
    expect(demoAdapterTestController.getCallLog()).toEqual([
      { method: 'post', path: '/auth/login', status: 200, outcome: 'fulfilled' },
      { method: 'get', path: '/auth/profile', status: 401, outcome: 'rejected' },
      { method: 'get', path: '/users', status: null, outcome: 'canceled' },
    ])
  })

  it('人工延迟期间 abort 以 CanceledError 结束并记录取消；清除延迟后恢复即时落定', async () => {
    const login = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    demoAdapterTestController.clearCallLog()
    demoAdapterTestController.setEndpointDelay('get', '/users', 5_000)
    vi.useFakeTimers()
    try {
      const controller = new AbortController()
      const pending = callAdapter(
        demoConfig({ url: '/users?size=5', token: login.accessToken, signal: controller.signal }),
      )
      // 未到延迟时间不得落定
      await vi.advanceTimersByTimeAsync(100)
      controller.abort()
      const outcome = await pending
      expect(outcome.ok).toBe(false)
      if (outcome.ok) {
        throw new Error('预期 adapter 取消拒绝')
      }
      expect(outcome.error.name).toBe('CanceledError')
      expect(demoAdapterTestController.getCallLog()).toEqual([
        { method: 'get', path: '/users', status: null, outcome: 'canceled' },
      ])
      // 清除延迟后同端点即时成功（不依赖任何计时器）
      demoAdapterTestController.clearEndpointDelays()
      const immediate = await callAdapter(demoConfig({ url: '/users', token: login.accessToken }))
      expect(immediate.ok).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resetRuntime 只重置 token 运行态：调用记录与人工延迟由各自方法显式清理', async () => {
    const login = await loginDemo(DEMO_ACCOUNT_USERNAMES.ADMIN)
    demoAdapterTestController.setEndpointDelay('get', '/users', 60_000)
    demoAdapterTestController.resetRuntime({ keepSnapshot: true })
    // 会话清理（登出订阅）会触发 resetDemoTokenRuntime：可观测性面必须保留
    //（E2E 需跨会话清理断言「只刷新一次」），由显式方法清理
    expect(demoAdapterTestController.getCallLog().length).toBeGreaterThan(0)
    demoAdapterTestController.clearCallLog()
    expect(demoAdapterTestController.getCallLog()).toEqual([])
    // 已设置的延迟不随 token 重置移除：在途请求仍可经 abort 取消（E2E 取消语义）
    const controller = new AbortController()
    const pending = callAdapter(
      demoConfig({ url: '/users', token: login.accessToken, signal: controller.signal }),
    )
    controller.abort()
    const outcome = await pending
    expect(outcome.ok).toBe(false)
    demoAdapterTestController.clearEndpointDelays()
  })
})
