/**
 * 权限矩阵 E2E —— 规格 §16.3「admin/viewer 差异」条目，验收矩阵固定于 §5.3：
 * - viewer：用户列表可见但四个写按钮隐藏；角色/菜单管理菜单隐藏；直达 /system/role、
 *   /system/menu 被守卫重定向 /403；多级菜单演示与个人中心可访问；
 * - admin：写按钮齐全、系统管理三个子菜单齐全。
 */
import { expect, test } from '@playwright/test'
import { loginViaUi, openSystemPageViaMenu } from './helpers'

test('viewer：系统管理菜单仅保留用户管理，角色/菜单管理隐藏（§5.3 菜单隐藏）', async ({ page }) => {
  await loginViaUi(page, 'viewer')
  const nav = page.locator('nav[aria-label="导航菜单"]')
  await expect(nav.getByRole('menuitem', { name: '仪表盘' })).toBeVisible()
  // 系统管理目录因唯一可见子节点（用户管理）而保留（§4.4）
  await nav.getByRole('menuitem', { name: '系统管理' }).click()
  await expect(nav.getByRole('menuitem', { name: '用户管理' })).toBeVisible()
  await expect(nav.getByRole('menuitem', { name: '角色管理' })).toHaveCount(0)
  await expect(nav.getByRole('menuitem', { name: '菜单管理' })).toHaveCount(0)
  // 多级菜单演示对 viewer 开放（§5.3）
  await nav.getByRole('menuitem', { name: '演示' }).click()
  await expect(nav.getByRole('menuitem', { name: '多级菜单' })).toBeVisible()
})

test('viewer：用户列表可查询，新增/编辑/删除/分配角色按钮全部隐藏（§5.3 按钮隐藏）', async ({ page }) => {
  await loginViaUi(page, 'viewer')
  await page.goto('/system/user')
  // 列表数据可见（demo 种子用户 alice）
  await expect(page.getByRole('cell', { name: 'alice', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增用户' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /编\s*辑/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '分配角色' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /删\s*除/ })).toHaveCount(0)
})

test('viewer：直达角色/菜单管理被守卫重定向到 403（§5.3 直达 403）', async ({ page }) => {
  await loginViaUi(page, 'viewer')
  await page.goto('/system/role')
  await expect(page).toHaveURL(/\/403$/)
  await expect(page.getByText('无权限访问')).toBeVisible()
  await page.goto('/system/menu')
  await expect(page).toHaveURL(/\/403$/)
  await expect(page.getByText('无权限访问')).toBeVisible()
})

test('viewer：个人中心仅要求登录，可访问（§5.3）', async ({ page }) => {
  await loginViaUi(page, 'viewer')
  await page.getByRole('button', { name: '用户菜单' }).click()
  await page.getByRole('menuitem', { name: '个人中心' }).click()
  await expect(page).toHaveURL(/\/profile$/)
})

test('admin：系统管理三个子菜单齐全，用户页四个写按钮可见（§5.3）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await openSystemPageViaMenu(page, '用户管理')
  await expect(page).toHaveURL(/\/system\/user$/)
  await expect(page.getByRole('button', { name: '新增用户' })).toBeVisible()
  await expect(page.getByRole('button', { name: /编\s*辑/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '分配角色' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /删\s*除/ }).first()).toBeVisible()
  // 角色管理、菜单管理可进入（后两者菜单项在子菜单展开后可见）
  const nav = page.locator('nav[aria-label="导航菜单"]')
  await expect(nav.getByRole('menuitem', { name: '角色管理' })).toBeVisible()
  await expect(nav.getByRole('menuitem', { name: '菜单管理' })).toBeVisible()
})
