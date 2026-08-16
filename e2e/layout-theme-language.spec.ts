/**
 * 布局、语言与主题 E2E —— 规格 §16.3「布局切换」「语言」「主题刷新」条目：
 * - §10.1/§11.1 侧边 ↔ 顶部布局热切换（无整页刷新）与 <768px 窄视口导航 Drawer；
 * - §12/§19.1 中英切换：资源加载后一次性切换，html lang / 菜单文案同步；
 * - §8.3/§10.2/§17.15/§17.16 主题实时切换与刷新不出现相反主题底色（TASK-009 推迟的浏览器级核对）。
 */
import { expect, test } from '@playwright/test'
import { loginViaUi } from './helpers'

/** 侧边（inline）/顶部（horizontal）菜单根节点的稳定判别选择器 */
const INLINE_MENU = 'nav .ant-menu-root.ant-menu-inline'
const HORIZONTAL_MENU = 'nav .ant-menu-root.ant-menu-horizontal'

test('侧边 ↔ 顶部布局热切换不整页刷新（§11.1/§16.3 布局切换）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // 整页刷新哨兵：热切换后仍存在证明未发生 document 重载
  await page.evaluate(() => {
    window.__e2e_no_reload = true
  })

  await page.getByRole('button', { name: '打开界面设置' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('界面设置')).toBeVisible()
  // 默认侧边布局：垂直菜单可见
  await expect(page.locator(INLINE_MENU)).toBeVisible()

  // 切换顶部布局：水平菜单出现、垂直侧栏隐藏（无刷新热切换，§11.1）
  await drawer.getByText('顶部布局').click()
  await expect(page.locator(HORIZONTAL_MENU)).toBeVisible()
  await expect(page.locator(INLINE_MENU)).toBeHidden()

  // 切回侧边布局
  await drawer.getByText('侧边布局').click()
  await expect(page.locator(INLINE_MENU)).toBeVisible()
  await expect(page.locator(HORIZONTAL_MENU)).toBeHidden()

  expect(await page.evaluate(() => window.__e2e_no_reload === true)).toBe(true)
})

test('窄视口（<768px）：侧边菜单折叠为导航 Drawer，次要操作收入更多菜单（§11.1）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.setViewportSize({ width: 375, height: 812 })
  // 窄视口触发按钮：打开导航菜单
  await expect(page.getByRole('button', { name: '打开导航菜单' })).toBeVisible()
  await page.getByRole('button', { name: '打开导航菜单' }).click()
  // 抽屉内垂直菜单可见，且可点击叶子项完成导航
  const drawerMenu = page.locator('.ant-drawer .ant-menu-root.ant-menu-inline')
  await expect(drawerMenu).toBeVisible()
  await page.locator('.ant-drawer .ant-menu-submenu-title', { hasText: '系统管理' }).click()
  await page.locator('.ant-drawer').getByRole('menuitem', { name: '用户管理' }).click()
  await expect(page).toHaveURL(/\/system\/user$/)
  // 次要操作（全屏/语言/主题）收入「更多」菜单（§11.1）
  await expect(page.getByRole('button', { name: '更多' })).toBeVisible()
})

test('中英切换一次性生效：菜单文案与 html lang 同步（§12/§19.1）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // 切换后 nav aria-label 随语言变化，以 class 判别侧边菜单根节点
  const sideMenu = page.locator(INLINE_MENU)
  await expect(sideMenu.getByRole('menuitem', { name: '仪表盘' })).toBeVisible()

  // 切换 English：资源加载完成后一次性切换
  await page.getByRole('button', { name: '切换语言' }).click()
  await page.getByRole('menuitem', { name: 'English' }).click()
  await expect(sideMenu.getByRole('menuitem', { name: 'Dashboard' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.getByRole('button', { name: 'Open appearance settings' })).toBeVisible()

  // 切回简体中文（按钮 aria-label 已随语言切换）
  await page.getByRole('button', { name: 'Switch language' }).click()
  await page.getByRole('menuitem', { name: '简体中文' }).click()
  await expect(sideMenu.getByRole('menuitem', { name: '仪表盘' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
})

test('主题切换实时生效：深色 data-theme/color-scheme 同步（§10.2/§17.15）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await page.getByRole('button', { name: '切换主题' }).click()
  await page.getByRole('menuitem', { name: '深色' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')

  await page.getByRole('button', { name: '切换主题' }).click()
  await page.getByRole('menuitem', { name: '浅色' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('深色主题刷新不出现相反底色：首帧即深色背景（§8.3/§17.16，TASK-009 浏览器级核对）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // 切换深色（随 settings 持久化，启动镜像随之重写）
  await page.getByRole('button', { name: '切换主题' }).click()
  await page.getByRole('menuitem', { name: '深色' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // 整页刷新：DOM 解析完成（首帧前后）即读取启动镜像结果
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const boot = await page.evaluate(() => {
    const root = document.documentElement
    return { theme: root.getAttribute('data-theme'), background: root.style.backgroundColor }
  })
  // 首帧前内联脚本必须已设置深色（index.html 启动镜像）：data-theme=dark 且背景为深色
  expect(boot.theme).toBe('dark')
  expect(boot.background).toBe('rgb(0, 0, 0)')
  // 应用启动后主题保持深色（hydration 不产生相反主题切换）
  await expect(page.locator('nav[aria-label="导航菜单"]')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})
