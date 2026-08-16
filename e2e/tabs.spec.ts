/**
 * 多页签与页面保活 E2E —— 规格 §16.3「多页签缓存/LRU」条目（§9 全节，TASK-011 推迟的浏览器级核对）：
 * - §17.9/§19.1 同路由不同 query 页签并存，各自读取正确 search params，表单状态独立保留；
 * - §9.1/§17.13/§19.1 页签缓存保留表单状态；第 11 个普通缓存触发 LRU 淘汰（页签仍在、
 *   再激活时状态重置），未被淘汰的缓存状态保留；
 * - §9.3 右键菜单四项（刷新当前重建缓存）、关闭后继顺序、鼠标拖拽重排；
 * - §9.3 刷新浏览器后重建「Dashboard + 当前页签」且无重复 Dashboard。
 *
 * 注意：Activity 隐藏实例的 DOM 仍保留在文档中，页面元素断言一律加 visible 过滤。
 */
import { expect, test, type Page } from '@playwright/test'
import { loginViaUi, openSystemPageViaMenu, spaNavigate } from './helpers'

/** 页签条内按标题定位页签节点 */
function tabByTitle(page: Page, title: string) {
  return page.locator('[role="tablist"][aria-label="页签"] [role="tab"]', { hasText: title })
}

/** 读取页签条当前顺序（data-tab-key 列表，作拖拽/关闭断言基线） */
async function tabKeys(page: Page): Promise<string[]> {
  return page.locator('[role="tablist"][aria-label="页签"] [role="tab"]').evaluateAll((tabs) =>
    tabs.map((tab) => (tab as HTMLElement).dataset.tabKey ?? ''),
  )
}

/**
 * 等待页签条达到指定数量：连续 spaNavigate 的 URL 等待不足以证明应用已提交导航
 * （pushState 即改 URL，POP 处理可能被下一次导航打断），以页签条计数为提交信号。
 */
async function waitForTabCount(page: Page, count: number): Promise<void> {
  await expect(page.locator('[role="tablist"][aria-label="页签"] [role="tab"]')).toHaveCount(count)
}

/**
 * 当前激活（可见）页面的演示输入框/开关：隐藏缓存实例仍在 DOM，且多实例的
 * Form.Item 会生成重复 id（getByLabel 会解析到隐藏实例），改以 placeholder/role 定位。
 */
function demoInput(page: Page) {
  return page.getByPlaceholder('在任意层级页签输入内容后离开再返回').filter({ visible: true })
}

function demoSwitch(page: Page) {
  return page.locator('button[role="switch"]').filter({ visible: true })
}

test('同路由不同 query 页签并存，缓存与 search params 相互独立（§17.9/§19.1）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // 两个 query 页签：?id=1 与 ?id=2（应用内导航创建两个独立页签）
  await spaNavigate(page, '/demo/nested/level1?id=1')
  await expect(tabByTitle(page, '一级页面').first()).toBeVisible()
  await demoInput(page).fill('tab-id-1')
  await spaNavigate(page, '/demo/nested/level1?id=2')
  // 两个页签并存（同标题不同 key）
  await expect(tabByTitle(page, '一级页面')).toHaveCount(2)
  // 新页签输入独立，不携带旧页签状态
  await expect(demoInput(page)).toHaveValue('')
  await demoInput(page).fill('tab-id-2')

  // 回到第一个页签：URL 与表单状态都是自己的
  await tabByTitle(page, '一级页面').first().click()
  await expect(page).toHaveURL(/\/demo\/nested\/level1\?id=1$/)
  await expect(demoInput(page)).toHaveValue('tab-id-1')
  await tabByTitle(page, '一级页面').nth(1).click()
  await expect(page).toHaveURL(/\/demo\/nested\/level1\?id=2$/)
  await expect(demoInput(page)).toHaveValue('tab-id-2')
})

test('页签缓存保留表单状态：切换页签后返回内容不变（§9.1/§19.1）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await spaNavigate(page, '/demo/nested/level1')
  await demoInput(page).fill('keep-me')
  await demoSwitch(page).click()
  // 切到仪表盘再返回：Activity 缓存恢复 state
  await page.getByRole('menuitem', { name: '仪表盘' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await tabByTitle(page, '一级页面').click()
  await expect(demoInput(page)).toHaveValue('keep-me')
  await expect(demoSwitch(page)).toBeChecked()
})

test('第 11 个普通缓存触发 LRU：最久未激活页签被淘汰、页签仍在再激活状态重置（§17.13/§19.1）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  // 打开 case=1、case=2 并写入可观测表单状态
  await spaNavigate(page, '/demo/nested/level1?case=1')
  await waitForTabCount(page, 2)
  await demoInput(page).fill('kept-1')
  await spaNavigate(page, '/demo/nested/level1?case=2')
  await waitForTabCount(page, 3)
  await demoInput(page).fill('kept-2')
  // 再打开 8 个变体：case=1..10 共 10 个普通缓存（容量上限 PAGE_CACHE_MAX_ENTRIES=10）
  for (let index = 3; index <= 10; index += 1) {
    await spaNavigate(page, `/demo/nested/level1?case=${index}`)
    await waitForTabCount(page, index + 1)
  }
  await expect(tabByTitle(page, '一级页面')).toHaveCount(10)

  // 第 11 个普通缓存：LRU 淘汰最久未激活的 case=1（页签保留，缓存实例销毁）
  await spaNavigate(page, '/demo/nested/level1?case=11')
  await expect(tabByTitle(page, '一级页面')).toHaveCount(11)

  // 未被淘汰的 case=2：缓存状态保留
  await tabByTitle(page, '一级页面').nth(1).click()
  await expect(page).toHaveURL(/case=2$/)
  await expect(demoInput(page)).toHaveValue('kept-2')
  // 被淘汰的 case=1：页签仍在，再激活时状态重置（§19.1）
  await tabByTitle(page, '一级页面').first().click()
  await expect(page).toHaveURL(/case=1$/)
  await expect(demoInput(page)).toHaveValue('')
  // Dashboard affix 与当前页不受淘汰影响
  await expect(tabByTitle(page, '仪表盘')).toBeVisible()
})

test('右键菜单：刷新当前重建缓存、关闭其他不影响 affix（§9.3）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await spaNavigate(page, '/demo/nested/level1')
  await demoInput(page).fill('stale-state')
  // 右键当前页签 → 刷新当前：revision 重建，表单状态重置。
  // 下拉 portal 带缩放动画且旧 portal 关闭后仍留 DOM：取 .last() 最新菜单，
  // 并以 dispatchEvent 派发点击，规避动画期命中测试不稳定（rc-menu onClick 正常触发）
  await tabByTitle(page, '一级页面').click({ button: 'right' })
  await page.getByRole('menuitem', { name: '刷新当前' }).last().dispatchEvent('click')
  await expect(demoInput(page)).toHaveValue('')

  // 打开更多页签后「关闭其他」：仅保留 affix Dashboard 与当前页签
  await spaNavigate(page, '/demo/nested/level1?case=x')
  await waitForTabCount(page, 3)
  await spaNavigate(page, '/demo/nested/level1/level2')
  await waitForTabCount(page, 4)
  await expect(tabByTitle(page, '二级页面')).toBeVisible()
  await tabByTitle(page, '二级页面').click({ button: 'right' })
  await page.getByRole('menuitem', { name: '关闭其他' }).last().dispatchEvent('click')
  await expect(tabByTitle(page, '仪表盘')).toBeVisible()
  await expect(tabByTitle(page, '二级页面')).toBeVisible()
  await expect(tabByTitle(page, '一级页面')).toHaveCount(0)
})

test('关闭页签按「右侧最近 → 左侧最近」确定后继激活（§9.3/§17.14）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await spaNavigate(page, '/demo/nested/level1?case=a')
  await waitForTabCount(page, 2)
  await spaNavigate(page, '/demo/nested/level1/level2')
  await waitForTabCount(page, 3)
  await spaNavigate(page, '/demo/nested/level1/level2/level3')
  await waitForTabCount(page, 4)
  await expect(tabByTitle(page, '三级页面')).toBeVisible()

  // 关闭中间的「二级页面」（非激活页签）：激活页不受影响
  await tabByTitle(page, '二级页面').locator('button[aria-label*="关闭"]').click()
  await expect(page).toHaveURL(/level3$/)

  // 关闭当前「三级页面」：无右侧 → 激活左侧最近（一级页面）
  await tabByTitle(page, '三级页面').locator('button[aria-label*="关闭"]').click()
  await expect(page).toHaveURL(/\/demo\/nested\/level1\?case=a$/)

  // 关闭最后一个普通页签：无右侧/左侧 → /dashboard
  await tabByTitle(page, '一级页面').locator('button[aria-label*="关闭"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('鼠标拖拽重排页签（dnd-kit PointerSensor，越激活阈值后落到相邻位置，§9.3）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await spaNavigate(page, '/demo/nested/level1')
  await spaNavigate(page, '/demo/nested/level1/level2')
  // 页签条为 仪表盘(affix) + 一级页面 + 二级页面
  await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveCount(3)
  const keysBefore = await tabKeys(page)

  // 指针拖拽末位（二级页面）到前一位：缓慢移动触发碰撞检测与跨过激活距离阈值
  const source = page.locator('[role="tablist"] [role="tab"]').nth(2)
  const target = page.locator('[role="tablist"] [role="tab"]').nth(1)
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (sourceBox === null || targetBox === null) {
    throw new Error('页签节点缺少可拖拽边界框')
  }
  const startX = sourceBox.x + sourceBox.width / 2
  const y = sourceBox.y + sourceBox.height / 2
  const endX = targetBox.x + targetBox.width / 2
  await page.mouse.move(startX, y)
  await page.mouse.down()
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(startX + ((endX - startX) * step) / 10, y)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()

  const keysAfter = await tabKeys(page)
  expect(keysAfter.length).toBe(keysBefore.length)
  // 顺序发生变化：末位 key 移到前一位
  expect(keysAfter[1]).toBe(keysBefore[2])
  expect(keysAfter[2]).toBe(keysBefore[1])
})

test('刷新浏览器后重建「Dashboard + 当前页签」且无重复（§9.3）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await openSystemPageViaMenu(page, '用户管理')
  await spaNavigate(page, '/demo/nested/level1')
  await expect(tabByTitle(page, '一级页面')).toBeVisible()
  await page.reload()
  // Dashboard（affix）+ 当前页签各一个，无重复
  await expect(tabByTitle(page, '仪表盘')).toHaveCount(1)
  await expect(tabByTitle(page, '一级页面')).toHaveCount(1)
  await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveCount(2)
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(/一级页面/)
  await expect(page).toHaveURL(/\/demo\/nested\/level1$/)
})
