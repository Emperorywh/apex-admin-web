/**
 * RolePermissionDrawer 测试（规格 §14.1/§14.3）：
 * 勾选初始值由 Role.permCodes 推导（仅叶子、树内权限码；父节点呈半选聚合态，
 * 树外权限码如 '*' 不参与展示）、树懒加载晚于挂载到达时推导保持响应式、
 * 父节点勾选联动子节点、提交载荷仅含选中叶子 permCodes、失败 Alert 与树加载态。
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PermissionNode, Role } from '@/types/system/role/role.types'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { RolePermissionDrawer } from './RolePermissionDrawer'

const TREE_FIXTURE: PermissionNode[] = [
  {
    key: 'dashboard',
    title: '仪表盘',
    children: [{ key: 'dashboard:view', title: '查看', permCode: 'dashboard:view' }],
  },
  {
    key: 'system:user',
    title: '用户管理',
    children: [
      { key: 'system:user:list', title: '查询', permCode: 'system:user:list' },
      { key: 'system:user:create', title: '新增', permCode: 'system:user:create' },
    ],
  },
]

const roleFixture: Role = {
  id: 'r-2',
  code: 'viewer',
  name: '访客',
  status: 'enabled',
  builtIn: true,
  // 含树内叶子权限码与树外通配符（'*' 不在树内，不参与展示）
  permCodes: ['dashboard:view', '*'],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
}

const submitSpy = vi.fn<(permCodes: string[]) => Promise<void>>()
const closeSpy = vi.fn()

/** 按节点标题定位对应树节点的复选框元素 */
function checkboxForTitle(title: string): HTMLElement {
  const wrappers = Array.from(document.querySelectorAll('.ant-tree-node-content-wrapper'))
  const wrapper = wrappers.find((element) => element.textContent === title)
  expect(wrapper, `缺少标题为 ${title} 的树节点`).toBeDefined()
  const node = wrapper!.closest('.ant-tree-treenode')
  const checkbox = node!.querySelector<HTMLElement>('.ant-tree-checkbox')
  expect(checkbox, `标题 ${title} 的节点缺少复选框`).toBeDefined()
  return checkbox!
}

beforeEach(() => {
  submitSpy.mockReset()
  submitSpy.mockResolvedValue(undefined)
  closeSpy.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderDrawer(overrides: { role?: Role | null; tree?: PermissionNode[]; treeLoading?: boolean } = {}) {
  return renderWithProviders(
    <RolePermissionDrawer
      open
      role={overrides.role ?? roleFixture}
      tree={overrides.tree ?? TREE_FIXTURE}
      treeLoading={overrides.treeLoading ?? false}
      submitting={false}
      onSubmit={submitSpy}
      onClose={closeSpy}
    />,
  )
}

describe('RolePermissionDrawer 勾选推导（规格 §14.1：checked 由 Role.permCodes 推导）', () => {
  it('初始勾选仅叶子权限码；父节点呈半选/全选聚合态；树外权限码不参与展示', () => {
    renderDrawer()
    // dashboard:view 命中 → 叶子选中；dashboard 仅一个子节点且已选 → 全选
    expect(checkboxForTitle('查看')).toHaveClass('ant-tree-checkbox-checked')
    expect(checkboxForTitle('仪表盘')).toHaveClass('ant-tree-checkbox-checked')
    // system:user 两个叶子均未选 → 父节点非半选非全选
    expect(checkboxForTitle('用户管理')).not.toHaveClass('ant-tree-checkbox-checked')
    expect(checkboxForTitle('用户管理')).not.toHaveClass('ant-tree-checkbox-indeterminate')
    expect(screen.getByText(/目标角色/)).toBeInTheDocument()
    expect(screen.getByText(/viewer/)).toBeInTheDocument()
  })

  it('树懒加载晚于挂载到达时勾选推导保持响应式（不丢失 permCodes 初始值）', async () => {
    const view = renderDrawer({ tree: [] })
    // 首帧空树：无任何可勾选节点渲染
    expect(document.querySelectorAll('.ant-tree-checkbox')).toHaveLength(0)
    // 树数据到达后重渲染：勾选仍由 permCodes 正确推导
    view.rerender(
      <RolePermissionDrawer
        open
        role={roleFixture}
        tree={TREE_FIXTURE}
        treeLoading={false}
        submitting={false}
        onSubmit={submitSpy}
        onClose={closeSpy}
      />,
    )
    await waitFor(() => expect(document.querySelectorAll('.ant-tree-treenode').length).toBeGreaterThan(0))
    expect(checkboxForTitle('查看')).toHaveClass('ant-tree-checkbox-checked')
  })
})

describe('RolePermissionDrawer 交互与提交（规格 §14.3：PUT /roles/:id/permissions）', () => {
  it('父节点勾选联动全部子节点；提交载荷仅含选中叶子 permCodes', async () => {
    const user = userEvent.setup()
    renderDrawer()
    // 勾选「用户管理」父节点 → 子节点全部选中
    await user.click(checkboxForTitle('用户管理'))
    expect(checkboxForTitle('查询')).toHaveClass('ant-tree-checkbox-checked')
    expect(checkboxForTitle('新增')).toHaveClass('ant-tree-checkbox-checked')
    // 取消一个叶子 → 父节点转半选
    await user.click(checkboxForTitle('查询'))
    expect(checkboxForTitle('用户管理')).toHaveClass('ant-tree-checkbox-indeterminate')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    // 载荷 = dashboard:view（初始） + system:user:create（勾选）；不含父节点 key
    expect(submitSpy.mock.calls[0][0]).toEqual(['dashboard:view', 'system:user:create'])
  })

  it('提交失败显示统一兜底 Alert', async () => {
    submitSpy.mockRejectedValueOnce(new Error('服务端异常'))
    const user = userEvent.setup()
    renderDrawer()
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(await screen.findByText('权限分配失败，请稍后重试')).toBeInTheDocument()
  })

  it('树加载中：显示加载文案且保存禁用', () => {
    renderDrawer({ treeLoading: true })
    expect(screen.getByText('加载中')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保\s*存/ })).toBeDisabled()
  })
})
