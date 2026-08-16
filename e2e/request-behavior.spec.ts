/**
 * 请求层行为 E2E —— 规格 §16.3「并发 401」「refresh 失效」「路由切换取消」条目：
 * - §6.2/§17.4 access 失效后并发 401 只刷新一次（POST /auth/refresh 恰一次）且每个请求重放成功；
 * - §6.2/§17.4 refresh 失效（AUTH_REFRESH_EXPIRED）只执行一次会话清理并跳登录一次；
 * - §17.12/§17.24 路由切换取消在途请求（页签 scope abort，经人工延迟制造在途窗口）。
 * 可观测性来自 window.__APEX_DEMO_E2E__ 调用记录（demo 测试专用控制器，规格 §13.2）。
 */
import { expect, test } from '@playwright/test'
import { demoBridge, loginViaUi, spaNavigate } from './helpers'

test('access 失效后并发 401 只刷新一次，业务请求各重放一次并成功（§6.2/§17.4/§16.3）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  const bridge = demoBridge(page)
  await bridge.clearCallLog()
  // 令全部 accessToken 失效：随后用户页挂载触发的 /users 与 /roles 并发收到 401
  await bridge.invalidateAccessTokens()

  // 应用内导航（不整页刷新，控制器状态保留）：用户管理页挂载并发发出 /users + /roles
  await spaNavigate(page, '/system/user')
  // 页面数据渲染成功（重放成功的结果）
  await expect(page.getByRole('cell', { name: 'alice', exact: true })).toBeVisible()

  const log = await bridge.getCallLog()
  // 刷新单飞：整页内 POST /auth/refresh 恰好一次（并发 401 共享同一刷新，§17.4）
  const refreshCalls = log.filter((record) => record.method === 'post' && record.path === '/auth/refresh')
  expect(refreshCalls).toHaveLength(1)
  expect(refreshCalls[0]?.status).toBe(200)
  // 业务请求至多重放一次且最终成功：时序上先于刷新完成的请求经历 401 → 200，
  // 刷新完成后才发出的请求直接以新 token 成功（§17.4「每个请求最多重放一次」）
  for (const path of ['/users', '/roles']) {
    const statuses = log.filter((record) => record.path === path).map((record) => record.status)
    expect(statuses.length).toBeLessThanOrEqual(2)
    expect(statuses[statuses.length - 1]).toBe(200)
    if (statuses.length === 2) {
      expect(statuses[0]).toBe(401)
    }
  }
})

test('refresh 失效只执行一次会话清理并跳登录一次（§6.2/§17.4/§16.3）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  const bridge = demoBridge(page)
  await bridge.clearCallLog()
  // access 与 refresh 同时失效：业务请求 401 → 刷新失败 AUTH_REFRESH_EXPIRED → 会话清理
  await bridge.invalidateAccessTokens()
  await bridge.invalidateRefreshTokens()

  // 直接触发应用内导航（不经菜单点击：会话清理重定向会与菜单动画竞争）
  await page.evaluate(() => {
    window.history.pushState(null, '', '/system/user')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  // 跳转登录页并携带合法当前地址（§6.2 会话清理带校验地址跳登录）
  await expect(page).toHaveURL(/\/login\?redirect=%2Fsystem%2Fuser$/)

  const log = await bridge.getCallLog()
  // 刷新只尝试一次；失败后未产生重放风暴（/users 只有最初一次 401，无第二次请求）
  expect(log.filter((record) => record.method === 'post' && record.path === '/auth/refresh')).toHaveLength(1)
  expect(log.filter((record) => record.path === '/users').map((record) => record.status)).toEqual([401])
  expect(log.filter((record) => record.path === '/auth/login')).toHaveLength(0)

  // 只跳登录一次：等待后仍稳定停留在登录页（无循环重定向），登录表单可再次使用
  await page.waitForTimeout(1_500)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByPlaceholder('用户名')).toBeVisible()
})

test('路由切换取消在途请求：页签 scope abort（§17.12/§17.24/§16.3 路由切换取消）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  const bridge = demoBridge(page)
  // 为 GET /users 设置人工延迟，制造足够宽的在途窗口（覆盖断言等待的耗时抖动）
  await bridge.setEndpointDelay('get', '/users', 6_000)
  await bridge.clearCallLog()

  // 进入用户管理：等待页面真实挂载（工具栏出现 ⇒ 挂载效应已发出在途 /users；
  // 不得以任意 spinner 判定——懒加载 Suspense 兜底也含 spinner，会在页面挂载前通过）
  await spaNavigate(page, '/system/user')
  await expect(page.getByRole('button', { name: '新增用户' })).toBeVisible()
  // 立即切回仪表盘：页面隐藏触发 scope abort（§17.12）
  await page.getByRole('menuitem', { name: '仪表盘' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  // 调用记录出现 /users 取消条目（在途请求被取消而非延迟落定）
  await expect
    .poll(
      async () =>
        (await bridge.getCallLog()).some(
          (record) => record.method === 'get' && record.path === '/users' && record.outcome === 'canceled',
        ),
      { timeout: 5_000 },
    )
    .toBe(true)
  // 清理人工延迟，不影响后续测试
  await bridge.clearEndpointDelays()
})
