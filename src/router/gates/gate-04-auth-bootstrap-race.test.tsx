/**
 * §20 技术闸门 ④：认证启动竞态。
 *
 * 验证 §4.3 启动闸门在延迟 rehydration 下的行为：
 * - 受保护 loader 第一行 await rehydratedPromise：恢复完成前挂起等待，
 *   不因 store 里暂时没有 token 而误跳登录；
 * - Data Router 并行执行父子 loader 时，profileSingleFlight 保证
 *   一次启动只发出一个 profile 请求；
 * - profile 完成前受保护页不渲染；rehydration 完成但无 token 时
 *   才按守卫规则跳转登录。
 *
 * 本文件是 §20 允许的验证性 PoC：假 persist 与 profile single-flight
 * 全部内联，不引用 src/ 内任何实现。
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Outlet, RouterProvider, createMemoryRouter, redirect, useLocation } from 'react-router'

interface ProfileData {
  username: string
  permCodes: string[]
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** 假 redux-persist：token 只有在恢复完成后才出现在 store（§8.2 rehydratedPromise） */
function createFakePersist() {
  let accessToken: string | null = null
  const rehydrated = createDeferred<void>()
  return {
    rehydratedPromise: rehydrated.promise,
    readToken: () => accessToken,
    completeRehydration(token: string | null) {
      accessToken = token
      rehydrated.resolve()
    },
  }
}

/** profile single-flight：一次启动最多发出一个 profile 请求（§4.3） */
function createProfileSingleFlight() {
  const deferred = createDeferred<ProfileData>()
  let inflight: Promise<ProfileData> | null = null
  let requestCount = 0
  return {
    ensureProfile(): Promise<ProfileData> {
      if (!inflight) {
        requestCount += 1
        inflight = deferred.promise
      }
      return inflight
    },
    resolveProfile(data: ProfileData) {
      deferred.resolve(data)
    },
    get requestCount() {
      return requestCount
    },
  }
}

function ProtectedProbe() {
  const location = useLocation()
  return <div data-testid="protected-probe">{`path=${location.pathname}`}</div>
}

interface Harness {
  router: ReturnType<typeof createMemoryRouter>
  loaderRuns: { count: number }
}

/** 每个受保护 loader 都独立 await rehydration 并调用同一 ensureProfile（§4.3） */
function buildHarness(persist: ReturnType<typeof createFakePersist>, profile: ReturnType<typeof createProfileSingleFlight>): Harness {
  const loaderRuns = { count: 0 }
  const protectedLoader = async () => {
    loaderRuns.count += 1
    await persist.rehydratedPromise
    if (!persist.readToken()) {
      return redirect('/login')
    }
    await profile.ensureProfile()
    return null
  }
  const router = createMemoryRouter(
    [
      { path: '/login', element: <div data-testid="login-page" /> },
      {
        path: '/',
        element: <Outlet />,
        loader: protectedLoader,
        children: [{ path: 'target', element: <ProtectedProbe />, loader: protectedLoader }],
      },
    ],
    { initialEntries: ['/target'] },
  )
  return { router, loaderRuns }
}

describe('§20 闸门 ④：认证启动竞态', () => {
  it('延迟 rehydration 下 loader 等待恢复，不误跳登录；并发 loader 只发一次 profile', async () => {
    const persist = createFakePersist()
    const profile = createProfileSingleFlight()
    const { router, loaderRuns } = buildHarness(persist, profile)
    render(<RouterProvider router={router} />)

    // 阶段一：rehydration 未完成。父子 loader 已并发启动并挂起等待，
    // 既没有跳登录，也没有渲染受保护页
    await act(async () => {
      await Promise.resolve()
    })
    expect(loaderRuns.count).toBe(2)
    expect(screen.queryByTestId('login-page')).toBeNull()
    expect(screen.queryByTestId('protected-probe')).toBeNull()
    expect(profile.requestCount).toBe(0)

    // 阶段二：rehydration 完成且带 token。loader 继续等待 profile，
    // profile 完成前受保护页仍未渲染
    await act(async () => {
      persist.completeRehydration('token-1')
      await persist.rehydratedPromise
      await Promise.resolve()
    })
    expect(screen.queryByTestId('protected-probe')).toBeNull()

    // 阶段三：profile 完成。受保护页渲染，且两个并发 loader 只发出一次 profile 请求
    await act(async () => {
      profile.resolveProfile({ username: 'admin', permCodes: ['*'] })
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(screen.getByTestId('protected-probe')).toBeTruthy()
    })
    expect(screen.getByTestId('protected-probe')).toHaveTextContent('path=/target')
    expect(profile.requestCount).toBe(1)
    expect(router.state.location.pathname).toBe('/target')
    expect(screen.queryByTestId('login-page')).toBeNull()
  })

  it('rehydration 完成但无 token 时才跳转登录，且不发出 profile 请求', async () => {
    const persist = createFakePersist()
    const profile = createProfileSingleFlight()
    const { router } = buildHarness(persist, profile)
    render(<RouterProvider router={router} />)

    await act(async () => {
      persist.completeRehydration(null)
      await persist.rehydratedPromise
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeTruthy()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(profile.requestCount).toBe(0)
  })
})
