/**
 * §20 技术闸门 ⑤：demo 刷新延续。
 *
 * 验证 §13.2 fallback 会话在整页刷新后的延续性：
 * - fallback 登录：真实 adapter 网络级失败后才切换 demo 来源并重放一次登录，
 *   sessionSource 随双 token 持久化；
 * - 整页刷新（全新会话实例）：从持久化恢复 sessionSource，
 *   首个 profile 请求之前来源已就绪，profile 与 CRUD 继续走 demo adapter，
 *   刷新后真实 adapter 零调用；
 * - 真实登录成功时不切换 demo，刷新后继续走真实 adapter。
 *
 * 本文件是 §20 允许的验证性 PoC：假 storage、假 persist、双假 adapter
 * 全部内联并遵循 §7.1 envelope 契约，不引用 src/ 内任何实现。
 */
import { describe, expect, it } from 'vitest'

/** 假 localStorage（§8.2 STORAGE_KEY_PREFIX 约定为 apex_） */
const STORAGE_KEY = 'apex_user'

interface FakeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function createFakeStorage(): FakeStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

/** §7.1 成功 envelope：code 固定字面量 0，data 必须存在 */
interface ApiSuccess<T> {
  code: 0
  message: string
  data: T
}

function ok<T>(data: T): ApiSuccess<T> {
  return { code: 0, message: 'ok', data }
}

interface DemoUser {
  id: string
  username: string
  displayName: string
}

interface LoginResult {
  accessToken: string
  refreshToken: string
}

interface ProfileResult {
  username: string
  permCodes: string[]
}

interface UserListResult {
  list: DemoUser[]
  total: number
}

interface RequestAdapter {
  login(username: string, password: string): Promise<ApiSuccess<LoginResult>>
  profile(): Promise<ApiSuccess<ProfileResult>>
  listUsers(): Promise<ApiSuccess<UserListResult>>
  createUser(input: { username: string; displayName: string }): Promise<ApiSuccess<DemoUser>>
}

/** 持久化白名单：仅双 token + sessionSource（§6.1） */
interface PersistedAuth {
  accessToken: string
  refreshToken: string
  sessionSource: 'real' | 'demo'
}

function persistAuth(storage: FakeStorage, auth: PersistedAuth): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

function restoreAuth(storage: FakeStorage): PersistedAuth | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  return JSON.parse(raw) as PersistedAuth
}

function isNetworkLevelFailure(error: unknown): boolean {
  return error instanceof Error && error.message === 'Network Error'
}

/** 真实 adapter：默认网络不可达；networkDown=false 时正常返回真实数据 */
function createRealAdapter(log: string[], networkDown = true): RequestAdapter {
  return {
    async login() {
      log.push('real:login')
      if (networkDown) throw new Error('Network Error')
      return ok({ accessToken: 'real-access-token', refreshToken: 'real-refresh-token' })
    },
    async profile() {
      log.push('real:profile')
      if (networkDown) throw new Error('Network Error')
      return ok({ username: 'admin', permCodes: ['*'] })
    },
    async listUsers() {
      log.push('real:listUsers')
      if (networkDown) throw new Error('Network Error')
      return ok({ list: [{ id: 'r1', username: 'admin', displayName: '管理员' }], total: 1 })
    },
    async createUser() {
      log.push('real:createUser')
      if (networkDown) throw new Error('Network Error')
      return ok({ id: 'r2', username: 'viewer', displayName: '访客' })
    },
  }
}

/** demo adapter：内存数据 + envelope 契约（§13.2；快照持久化不在闸门范围） */
function createDemoAdapter(log: string[]): RequestAdapter {
  const users: DemoUser[] = [{ id: 'd1', username: 'admin', displayName: '管理员' }]
  let nextId = 2
  return {
    async login() {
      log.push('demo:login')
      return ok({ accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' })
    },
    async profile() {
      log.push('demo:profile')
      return ok({ username: 'admin', permCodes: ['*'] })
    },
    async listUsers() {
      log.push('demo:listUsers')
      return ok({ list: [...users], total: users.length })
    },
    async createUser(input) {
      log.push('demo:createUser')
      const user: DemoUser = { id: `d${nextId}`, ...input }
      nextId += 1
      users.push(user)
      return ok(user)
    },
  }
}

/** §13.2：sessionSource 在 adapter 选择之前恢复并决定请求走向 */
function createRequestDispatcher(
  real: RequestAdapter,
  demo: RequestAdapter,
  getSessionSource: () => 'real' | 'demo',
): Pick<RequestAdapter, 'profile' | 'listUsers' | 'createUser'> {
  return {
    profile: () => (getSessionSource() === 'demo' ? demo : real).profile(),
    listUsers: () => (getSessionSource() === 'demo' ? demo : real).listUsers(),
    createUser: (input) => (getSessionSource() === 'demo' ? demo : real).createUser(input),
  }
}

/** §13.1 fallback：先真实登录；仅网络级失败时切 demo 并重放一次登录，业务错误不切换 */
async function loginWithFallback(
  storage: FakeStorage,
  log: string[],
  real: RequestAdapter,
  demo: RequestAdapter,
  username: string,
  password: string,
): Promise<'real' | 'demo'> {
  try {
    const result = await real.login(username, password)
    persistAuth(storage, {
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      sessionSource: 'real',
    })
    return 'real'
  } catch (error) {
    if (!isNetworkLevelFailure(error)) {
      throw error
    }
    log.push('fallback:switch-to-demo')
    const retry = await demo.login(username, password)
    persistAuth(storage, {
      accessToken: retry.data.accessToken,
      refreshToken: retry.data.refreshToken,
      sessionSource: 'demo',
    })
    return 'demo'
  }
}

/** 整页刷新：新会话实例 + 新 adapter 实例，从持久化恢复来源 */
function createRefreshedSession(
  storage: FakeStorage,
  log: string[],
  networkDown = true,
): {
  restoredSource: 'real' | 'demo'
  request: Pick<RequestAdapter, 'profile' | 'listUsers' | 'createUser'>
} {
  const persisted = restoreAuth(storage)
  if (!persisted) {
    throw new Error('刷新前必须已存在持久化会话')
  }
  const real = createRealAdapter(log, networkDown)
  const demo = createDemoAdapter(log)
  const source = persisted.sessionSource
  return { restoredSource: source, request: createRequestDispatcher(real, demo, () => source) }
}

describe('§20 闸门 ⑤：demo 刷新延续', () => {
  it('fallback 登录进入 demo 后整页刷新，profile/CRUD 继续走 demo adapter', async () => {
    const storage = createFakeStorage()
    const beforeRefresh: string[] = []
    const source = await loginWithFallback(
      storage,
      beforeRefresh,
      createRealAdapter(beforeRefresh),
      createDemoAdapter(beforeRefresh),
      'admin',
      'any-password',
    )

    // fallback 序列：真实登录网络失败一次 → 切换来源 → demo 登录一次
    expect(source).toBe('demo')
    expect(beforeRefresh).toEqual(['real:login', 'fallback:switch-to-demo', 'demo:login'])
    // sessionSource 随双 token 持久化（§6.1）
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      sessionSource: 'demo',
    })

    // 整页刷新：来源在首个 profile 之前已恢复
    const afterRefresh: string[] = []
    const { restoredSource, request } = createRefreshedSession(storage, afterRefresh)
    expect(restoredSource).toBe('demo')

    // profile 与 CRUD 全部走 demo adapter，并遵守 envelope 契约
    const profile = await request.profile()
    expect(profile.code).toBe(0)
    expect(profile.data.username).toBe('admin')

    const created = await request.createUser({ username: 'viewer', displayName: '访客' })
    expect(created.code).toBe(0)
    expect(created.data.username).toBe('viewer')

    const list = await request.listUsers()
    expect(list.data.total).toBe(2)
    expect(list.data.list.some((user) => user.username === 'viewer')).toBe(true)

    // 刷新后真实 adapter 零调用
    expect(afterRefresh).toEqual(['demo:profile', 'demo:createUser', 'demo:listUsers'])
  })

  it('真实登录成功时不切换 demo，刷新后继续走真实 adapter', async () => {
    const storage = createFakeStorage()
    const beforeRefresh: string[] = []
    const source = await loginWithFallback(
      storage,
      beforeRefresh,
      createRealAdapter(beforeRefresh, false),
      createDemoAdapter(beforeRefresh),
      'admin',
      'any-password',
    )

    expect(source).toBe('real')
    expect(beforeRefresh).toEqual(['real:login'])

    const afterRefresh: string[] = []
    const { restoredSource, request } = createRefreshedSession(storage, afterRefresh, false)
    expect(restoredSource).toBe('real')

    const profile = await request.profile()
    expect(profile.data.username).toBe('admin')
    expect(afterRefresh).toEqual(['real:profile'])
  })
})
