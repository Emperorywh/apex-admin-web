/**
 * E2E 公共辅助（规格 §16.3）：
 * - loginViaUi 走真实登录表单（demo 账号任意密码，规格 §13.2）；
 * - demoBridge 消费 window.__APEX_DEMO_E2E__（src/demo/demoRuntime.ts 在 demo 构建下挂载，
 *   规格测试专用控制器的浏览器入口）：token 失效、人工延迟与调用记录，
 *   支撑「并发 401 只刷新一次」「refresh 失效」「路由切换取消」等行为的可观测断言；
 * - spaNavigate 以 History API + popstate 触发应用内导航，用于制造同路由不同 query 的页签
 *   （规格 §17.9），不整页刷新。
 */
import { expect, type Page } from '@playwright/test'

/** demo adapter 调用记录（与 src/demo/adapters/demo.adapter.ts 的 DemoCallRecord 同形） */
export interface DemoCallRecord {
  method: string
  path: string
  status: number | null
  outcome: 'fulfilled' | 'rejected' | 'canceled'
}

/** 浏览器内 demo 测试控制器契约（src/demo/adapters/demo.adapter.ts demoAdapterTestController） */
interface DemoE2eController {
  invalidateAccessTokens(username?: string): void
  invalidateRefreshTokens(username?: string): void
  setEndpointDelay(method: string, path: string, delayMs: number): void
  clearEndpointDelays(): void
  getCallLog(): readonly DemoCallRecord[]
  clearCallLog(): void
}

/** Node 侧桥代理：动作经 page.evaluate 转发到页面内控制器，全部异步 */
export interface DemoBridge {
  invalidateAccessTokens(username?: string): Promise<void>
  invalidateRefreshTokens(username?: string): Promise<void>
  setEndpointDelay(method: string, path: string, delayMs: number): Promise<void>
  clearEndpointDelays(): Promise<void>
  getCallLog(): Promise<DemoCallRecord[]>
  clearCallLog(): Promise<void>
}

declare global {
  interface Window {
    __APEX_DEMO_E2E__?: DemoE2eController
    /** E2E 哨兵：断言热切换期间未发生整页刷新（document 重载会清空） */
    __e2e_no_reload?: boolean
  }
}

/**
 * 页面内 demo E2E 控制器代理：首个动作前等待桥挂载（demo force 构建随应用启动就绪），
 * 之后直接转发；getCallLog 返回结构化调用记录供断言。
 */
export function demoBridge(page: Page): DemoBridge {
  let readyPromise: Promise<void> | null = null
  const ready = (): Promise<void> => {
    readyPromise ??= page
      .waitForFunction(() => window.__APEX_DEMO_E2E__ !== undefined, undefined, { timeout: 15_000 })
      .then(() => undefined)
    return readyPromise
  }
  const act = <T>(action: () => Promise<T>): Promise<T> => ready().then(action)

  return {
    invalidateAccessTokens: (username?: string) =>
      act(() =>
        page.evaluate(([name]) => window.__APEX_DEMO_E2E__?.invalidateAccessTokens(name), [username]),
      ),
    invalidateRefreshTokens: (username?: string) =>
      act(() =>
        page.evaluate(([name]) => window.__APEX_DEMO_E2E__?.invalidateRefreshTokens(name), [username]),
      ),
    setEndpointDelay: (method: string, path: string, delayMs: number) =>
      act(() =>
        page.evaluate(
          ([m, p, d]) => window.__APEX_DEMO_E2E__?.setEndpointDelay(m, p, d),
          [method, path, delayMs] as const,
        ),
      ),
    clearEndpointDelays: () => act(() => page.evaluate(() => window.__APEX_DEMO_E2E__?.clearEndpointDelays())),
    getCallLog: () =>
      act(() => page.evaluate(() => window.__APEX_DEMO_E2E__?.getCallLog() as DemoCallRecord[])),
    clearCallLog: () => act(() => page.evaluate(() => window.__APEX_DEMO_E2E__?.clearCallLog())),
  }
}

/** 经真实登录表单登录（demo 任意密码，规格 §13.2），成功后停在 /dashboard */
export async function loginViaUi(page: Page, username: string): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('用户名').fill(username)
  await page.getByPlaceholder('密码').fill('e2e-any-password')
  // antd 两字按钮自动插入空格（「登 录」），以 \s 兼容两种形态
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  // 侧边菜单出现即布局就绪（后续菜单导航/页签断言的前置）
  await expect(page.locator('nav[aria-label="导航菜单"]')).toBeVisible()
}

/**
 * 以 History API + popstate 触发应用内（SPA）导航：React Router 读取新地址并路由。
 * 等待 URL 提交后才返回，避免连续触发时 POP 导航相互竞态丢历史。
 */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState(null, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await expect(page).toHaveURL((url: URL) => url.pathname + url.search === path)
}

/** 展开侧边菜单的「系统管理」子菜单并点击目标叶子项（应用内导航，不整页刷新） */
export async function openSystemPageViaMenu(page: Page, itemText: string): Promise<void> {
  const nav = page.locator('nav[aria-label="导航菜单"]')
  await nav.locator('.ant-menu-submenu-title', { hasText: '系统管理' }).click()
  await nav.getByRole('menuitem', { name: itemText }).click()
}
