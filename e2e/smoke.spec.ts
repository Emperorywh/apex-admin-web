/**
 * 关键冒烟 E2E —— 规格 §16.4「Firefox/WebKit 关键冒烟」条目：
 * 仅本文件被 firefox/webkit 项目执行（playwright.config.ts testMatch 收窄）；
 * 覆盖登录、仪表盘渲染、权限差异直达 403、页签与主题四条关键链路。
 */
import { expect, test } from '@playwright/test'
import { loginViaUi } from './helpers'

test('登录 → 仪表盘渲染（§16.3 登录/关键链路）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await expect(page.locator('header')).toContainText('演示管理员')
  // 演示模式常驻 Badge（§13.2）
  await expect(page.locator('header')).toContainText('演示模式')
})

test('用户列表数据渲染（§16.3 CRUD 关键链路）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.goto('/system/user')
  await expect(page.getByRole('cell', { name: 'alice', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增用户' })).toBeVisible()
})

test('viewer 直达角色管理被重定向 403（§5.3/§16.3 权限差异）', async ({ page }) => {
  await loginViaUi(page, 'viewer')
  await page.goto('/system/role')
  await expect(page).toHaveURL(/\/403$/)
  await expect(page.getByText('无权限访问')).toBeVisible()
})

test('多页签与主题切换（§16.3 多页签/主题关键链路）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // 打开二级页签并返回：页签保留
  await page.goto('/demo/nested/level1')
  await expect(page.locator('[role="tablist"] [role="tab"]', { hasText: '一级页面' })).toBeVisible()
  await page.getByRole('menuitem', { name: '仪表盘' }).click()
  await expect(page.locator('[role="tablist"] [role="tab"]', { hasText: '一级页面' })).toBeVisible()
  // 主题快捷切换实时生效
  await page.getByRole('button', { name: '切换主题' }).click()
  await page.getByRole('menuitem', { name: '深色' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
