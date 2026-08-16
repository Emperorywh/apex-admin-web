/**
 * 用户管理 CRUD E2E —— 规格 §16.3「CRUD」条目（§14.3 用户接口、§19.1 完整走通）：
 * admin 创建用户 → 编辑显示名称 → 分配角色 → 删除，每步断言表格数据与成功提示。
 */
import { expect, test } from '@playwright/test'
import { loginViaUi, openSystemPageViaMenu } from './helpers'

/** 测试内创建的演示用户（每个测试独立浏览器上下文，demo 数据集互不影响） */
const CREATED_USERNAME = 'e2e-user'

test('用户 CRUD 与角色分配完整走通（§16.3 CRUD/§19.1）', async ({ page }) => {
  await loginViaUi(page, 'admin')
  await openSystemPageViaMenu(page, '用户管理')
  await expect(page).toHaveURL(/\/system\/user$/)

  // ── 创建：Drawer 表单必填项（初始角色为可选字段，角色分配由下方专门步骤覆盖） ──
  await page.getByRole('button', { name: '新增用户' }).click()
  const createDrawer = page.getByRole('dialog')
  await expect(createDrawer.getByText('新增用户')).toBeVisible()
  await createDrawer.getByLabel('用户名').fill(CREATED_USERNAME)
  await createDrawer.getByLabel('密码').fill('e2ePass123')
  await createDrawer.getByLabel('显示名称').fill('E2E 新建用户')
  await createDrawer.getByLabel('邮箱').fill('e2e-user@apex.demo')
  await createDrawer.getByRole('button', { name: /保\s*存/ }).click()
  await expect(page.getByText('创建用户成功')).toBeVisible()
  await expect(page.getByRole('cell', { name: CREATED_USERNAME, exact: true })).toBeVisible()

  // ── 编辑：仅改显示名称，用户名禁用回显（无 name 的 Form.Item 不产生 label 关联，以 input 定位） ──
  const row = page.getByRole('row', { name: new RegExp(CREATED_USERNAME) })
  await row.getByRole('button', { name: /编\s*辑/ }).click()
  const editDrawer = page.getByRole('dialog')
  await expect(editDrawer.getByText('编辑用户')).toBeVisible()
  await expect(editDrawer.locator('input').first()).toBeDisabled()
  await expect(editDrawer.locator('input').first()).toHaveValue(CREATED_USERNAME)
  await editDrawer.getByLabel('显示名称').fill('E2E 改名用户')
  await editDrawer.getByRole('button', { name: /保\s*存/ }).click()
  await expect(page.getByText('保存成功')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'E2E 改名用户' })).toBeVisible()

  // ── 分配角色：独立 Drawer 勾选提交（PUT /users/:id/roles） ──
  await page.getByRole('row', { name: /E2E 改名用户/ }).getByRole('button', { name: '分配角色' }).click()
  const roleDrawer = page.getByRole('dialog')
  await expect(roleDrawer.getByText('分配角色')).toBeVisible()
  // 点击角色标签勾选（antd 原生 input 视觉隐藏，check() 不可用）
  await roleDrawer.getByText('演示管理员角色').click()
  await roleDrawer.getByRole('button', { name: /保\s*存/ }).click()
  await expect(page.getByText('保存成功').first()).toBeVisible()
  // 重新打开：勾选状态由角色分配结果回显
  await page.getByRole('row', { name: /E2E 改名用户/ }).getByRole('button', { name: '分配角色' }).click()
  await expect(roleDrawer.getByText('分配角色')).toBeVisible()
  await expect(roleDrawer.locator('input[type="checkbox"]:checked')).toHaveCount(1)
  // 关闭抽屉（否则遮罩拦截表格行按钮）
  await roleDrawer.getByRole('button', { name: /取\s*消/ }).click()
  await expect(roleDrawer).toBeHidden()

  // ── 删除：确认框 → 行消失 ──
  await page.getByRole('row', { name: /E2E 改名用户/ }).getByRole('button', { name: /删\s*除/ }).click()
  const confirmDialog = page.getByRole('dialog')
  await expect(confirmDialog).toContainText('删除用户')
  await confirmDialog.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByText('删除成功')).toBeVisible()
  await expect(page.getByRole('cell', { name: CREATED_USERNAME, exact: true })).toHaveCount(0)
})
