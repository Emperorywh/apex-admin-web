/**
 * 路由启动接线测试（规格 §4.3/§5.4/§6.2）：
 * 认证导航意图消费（post-login 五步同源校验后执行合法回跳或 /dashboard、post-logout、
 * route-forbidden 真实 replace('/403')）、会话清理跳转消费与失权页签权限解析注册。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROUTE_FALLBACK_PATH, ROUTE_PATHS } from '@/constants/route.constants'
import { emitAuthNavigation, registerAuthNavigator } from '@/services/auth/authNavigation'
import { registerTabPermissionResolver } from '@/services/auth/auth.session'
import { registerSessionExpiredNavigator, runSessionCleanup } from '@/services/request/sessionCleanup'
import { createComponentTestStore } from '@/test/componentTestHelpers'
import {
  bootstrapRouter,
  connectRouterNavigation,
  createAuthNavigator,
  resolveTabPermissionChain,
  type RouterNavigate,
} from './bootstrap'

/** 以 jsdom history 设置当前地址栏（登录页带 redirect 参数等场景） */
function setAddress(path: string): void {
  window.history.replaceState({}, '', path)
}

/** 收集各测试注册的清理函数，统一还原全局通道 */
const navigationCleanups: Array<() => void> = []

afterEach(() => {
  for (const cleanup of navigationCleanups.splice(0)) {
    cleanup()
  }
})

describe('createAuthNavigator：登录提交后的最终导航接线（规格 §4.3/§6.2）', () => {
  it('post-login：合法 redirect 参数经五步同源校验后执行回跳（replace）', () => {
    setAddress(`/login?redirect=${encodeURIComponent('/system/user?id=1#top')}`)
    const navigate = vi.fn()
    createAuthNavigator(navigate as RouterNavigate)({ kind: 'post-login', target: ROUTE_FALLBACK_PATH })
    expect(navigate).toHaveBeenCalledWith('/system/user?id=1#top', { replace: true })
  })

  it('post-login：恶意 redirect（//evil.example）回退 /dashboard', () => {
    setAddress(`/login?redirect=${encodeURIComponent('//evil.example')}`)
    const navigate = vi.fn()
    createAuthNavigator(navigate as RouterNavigate)({ kind: 'post-login', target: ROUTE_FALLBACK_PATH })
    expect(navigate).toHaveBeenCalledWith(ROUTE_FALLBACK_PATH, { replace: true })
  })

  it('post-login：反斜杠与控制字符样例同样回退 /dashboard（规格 §17.21）', () => {
    for (const malicious of ['/\\evil.example', '/foo\nbar']) {
      setAddress(`/login?redirect=${encodeURIComponent(malicious)}`)
      const navigate = vi.fn()
      createAuthNavigator(navigate as RouterNavigate)({ kind: 'post-login', target: ROUTE_FALLBACK_PATH })
      expect(navigate).toHaveBeenCalledWith(ROUTE_FALLBACK_PATH, { replace: true })
    }
  })

  it('post-login：无 redirect 参数时使用意图默认落点 /dashboard', () => {
    setAddress(ROUTE_PATHS.LOGIN)
    const navigate = vi.fn()
    createAuthNavigator(navigate as RouterNavigate)({ kind: 'post-login', target: ROUTE_FALLBACK_PATH })
    expect(navigate).toHaveBeenCalledWith(ROUTE_FALLBACK_PATH, { replace: true })
  })

  it('post-logout：回登录页且不带 redirect 参数（用户显式离开）', () => {
    setAddress('/dashboard')
    const navigate = vi.fn()
    createAuthNavigator(navigate as RouterNavigate)({ kind: 'post-logout', target: ROUTE_PATHS.LOGIN })
    expect(navigate).toHaveBeenCalledWith(ROUTE_PATHS.LOGIN, { replace: true })
  })

  it('route-forbidden：失权 403 意图消费为真实 replace("/403")（规格 §5.4）', () => {
    const navigate = vi.fn()
    createAuthNavigator(navigate as RouterNavigate)({ kind: 'route-forbidden', target: ROUTE_PATHS.FORBIDDEN })
    expect(navigate).toHaveBeenCalledWith(ROUTE_PATHS.FORBIDDEN, { replace: true })
  })
})

describe('connectRouterNavigation：三个导航通道接线（规格 §6.2）', () => {
  it('emitAuthNavigation 产出的意图经注册的 navigate 执行', () => {
    const navigate = vi.fn()
    navigationCleanups.push(connectRouterNavigation(navigate as RouterNavigate))
    emitAuthNavigation({ kind: 'post-logout', target: ROUTE_PATHS.LOGIN })
    expect(navigate).toHaveBeenCalledWith(ROUTE_PATHS.LOGIN, { replace: true })
  })

  it('会话清理跳转：sessionCleanup 构造的带校验地址经注册回调跳登录（replace）', () => {
    setAddress('/system/user?id=2#frag')
    const navigate = vi.fn()
    navigationCleanups.push(connectRouterNavigation(navigate as RouterNavigate))
    const store = createComponentTestStore()
    runSessionCleanup(store)
    expect(navigate).toHaveBeenCalledTimes(1)
    const [target, options] = navigate.mock.calls[0] as [string, { replace?: boolean }]
    // 目标为 /login?redirect=（当前地址经同源校验编码一次）
    expect(target.startsWith(`${ROUTE_PATHS.LOGIN}?redirect=`)).toBe(true)
    expect(options).toEqual({ replace: true })
    const decoded = new URLSearchParams(target.split('?')[1]).get('redirect')
    expect(decoded).toBe('/system/user?id=2#frag')
  })

  it('bootstrapRouter：创建 Data Router 并接线意图消费（route-forbidden → navigate("/403")）', () => {
    const router = bootstrapRouter()
    navigationCleanups.push(() => {
      registerAuthNavigator(null)
      registerSessionExpiredNavigator(null)
      registerTabPermissionResolver(null)
    })
    const navigateSpy = vi.spyOn(router, 'navigate')
    emitAuthNavigation({ kind: 'route-forbidden', target: ROUTE_PATHS.FORBIDDEN })
    expect(navigateSpy).toHaveBeenCalledWith(ROUTE_PATHS.FORBIDDEN, { replace: true })
  })

  it('失权页签权限解析：真实路由定义的 pathname 映射权限码链，未登记路径无权限要求', () => {
    // 当前 definitions 只含无 permCode 的节点：错误页路径登记为空链
    expect(resolveTabPermissionChain(ROUTE_PATHS.FORBIDDEN)).toEqual([])
    expect(resolveTabPermissionChain(ROUTE_PATHS.NOT_FOUND)).toEqual([])
    // 未登记路径（尚无业务路由）回退空链，不产生误伤
    expect(resolveTabPermissionChain('/not/registered/yet')).toEqual([])
  })
})
