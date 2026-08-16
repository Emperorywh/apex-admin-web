/**
 * 认证与会话 E2E —— 规格 §16.3「登录与回跳」「恶意 redirect」条目：
 * - §4.3/§19.1 登录 → 合法回跳（redirect 参数）与默认落点 /dashboard；
 * - §17.21 三类恶意外站 redirect 与控制字符全部回 Dashboard；
 * - §6.2/§13.2 demo 登出确认 → 回登录页；§17.20 登出后浏览器后退仍由守卫拦截。
 * 「refresh 失效只跳登录一次」归 request-behavior.spec.ts。
 */
import { expect, test } from '@playwright/test'
import { loginViaUi, openSystemPageViaMenu } from './helpers'

test('登录成功默认落点为 /dashboard（§16.3 登录与回跳）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // Header 展示 demo 管理员显示名称，仪表盘布局就绪
  await expect(page.locator('header')).toContainText('演示管理员')
})

test('受保护地址未登录先到登录页并携带 redirect，登录后合法回跳（§4.3/§19.1）', async ({ page }) => {
  await page.goto('/system/user')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fsystem%2Fuser$/)
  // 登录表单展示回跳目标提示（§14.2 登录页回跳参数展示）
  await expect(page.getByText('登录后将前往')).toBeVisible()
  await page.getByPlaceholder('用户名').fill('admin')
  await page.getByPlaceholder('密码').fill('any')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).toHaveURL(/\/system\/user$/)
})

for (const malicious of [
  'https://evil.example',
  'http://evil.example',
  '//evil.example',
  '/\\evil.example',
  '/\nevil.example',
]) {
  test(`恶意 redirect「${malicious.replace(/\n/g, '\\n')}」登录后回 /dashboard，不离开当前 origin（§17.21）`, async ({
    page,
  }) => {
    await page.goto(`/login?redirect=${encodeURIComponent(malicious)}`)
    const origin = new URL(page.url()).origin
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('any')
    await page.getByRole('button', { name: /登\s*录/ }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    // 显式断言未导航到外站 origin
    expect(new URL(page.url()).origin).toBe(origin)
    expect(new URL(page.url()).pathname).toBe('/dashboard')
  })
}

test('demo 登出：确认框 → 清会话回登录页；浏览器后退仍被守卫拦截（§6.2/§13.2/§17.20）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // 先产生一条受保护路由历史（登出用 replace 导航，无历史时后退无处可退）
  await openSystemPageViaMenu(page, '用户管理')
  await expect(page).toHaveURL(/\/system\/user$/)
  await page.getByRole('button', { name: '用户菜单' }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  // demo 会话登出确认框（默认保留快照）
  const confirm = page.getByRole('dialog')
  await expect(confirm).toContainText('退出登录确认')
  await confirm.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login/)
  // 登出后后退到受保护路由：无 token，守卫拦截跳回登录页（§17.20）
  await page.goBack()
  await expect(page).toHaveURL(/\/login/)
})
