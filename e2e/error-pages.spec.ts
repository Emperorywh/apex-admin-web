/**
 * 错误页 E2E —— 规格 §16.3「错误页」条目（§4.2/§19.1）：
 * - /403 无权限页（守卫权限链不满足 replace，viewer 直达受保护页场景归 permissions.spec）；
 * - 未知路径 404（受保护根内 * 兜底渲染同一 NotFound 实现）与显式 /404；
 * - /500 服务器错误页直达。
 * 「注入渲染错误进入 500」由 RouterErrorBoundary 单元测试覆盖（§17.19），
 * 浏览器级验证直接访问 /500 静态路由。
 */
import { expect, test } from '@playwright/test'
import { loginViaUi } from './helpers'

test('/403 直达渲染无权限页（§16.3 错误页）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.goto('/403')
  await expect(page.getByText('无权限访问')).toBeVisible()
  await expect(page.getByText('您没有访问该页面的权限')).toBeVisible()
  // 返回首页按钮 replace 导航到 /dashboard
  await page.getByRole('button', { name: '返回首页' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('未知路径命中 * 兜底渲染 404（§16.3 错误页）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.goto('/definitely/not/a/route')
  await expect(page.getByText('页面不存在', { exact: true })).toBeVisible()
  await expect(page.getByText('您访问的页面不存在')).toBeVisible()
})

test('显式 /404 路由渲染 404（§16.3 错误页）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.goto('/404')
  await expect(page.getByText('页面不存在', { exact: true })).toBeVisible()
})

test('/500 直达渲染服务器错误页（§16.3 错误页）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.goto('/500')
  await expect(page.getByText('服务器错误')).toBeVisible()
  await expect(page.getByText('服务器开小差了，请稍后重试')).toBeVisible()
  await page.getByRole('button', { name: '返回首页' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('刷新深层路由经 SPA fallback 返回应用并正确路由（§16.4/§17.23）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.goto('/system/user')
  await page.reload()
  await expect(page).toHaveURL(/\/system\/user$/)
  await expect(page.getByRole('cell', { name: 'alice', exact: true })).toBeVisible()
})
