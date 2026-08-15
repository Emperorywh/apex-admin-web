/**
 * RoleForm 测试（规格 §14.3 写入契约/§14.4 字段映射）：
 * 创建/编辑字段差异与初始回显（code 创建后不可改：编辑禁用回显）、必填校验、
 * 提交载荷形态（trim、空 description 省略、编辑契约不含 code）、
 * VALIDATION_FAILED.details 已知字段映射到表单项、未知字段与其他错误码显示页面级错误。
 */
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { createApiError } from '@/services/request/envelope'
import type { Role } from '@/types/system/role/role.types'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { RoleForm } from './RoleForm'
import type { RoleFormSubmitPayload } from './RoleForm.types'

const editRoleFixture: Role = {
  id: 'r-1',
  code: 'operator',
  name: '运营',
  description: '原描述',
  status: 'enabled',
  builtIn: false,
  permCodes: [],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
}

const submitSpy = vi.fn<(payload: RoleFormSubmitPayload) => Promise<void>>()
const cancelSpy = vi.fn()

beforeEach(() => {
  submitSpy.mockReset()
  submitSpy.mockResolvedValue(undefined)
  cancelSpy.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

/** 创建模式填入合法字段并提交（code/name 带首尾空白验证 trim） */
async function fillCreateAndSubmit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('请输入角色标识'), '  operator  ')
  await user.type(screen.getByPlaceholderText('请输入角色名称'), '  运营  ')
  await user.click(screen.getByRole('button', { name: /保\s*存/ }))
}

describe('RoleForm 创建/编辑字段差异（规格 §14.3 契约）', () => {
  it('创建模式渲染 code 表单项；编辑模式 code 禁用回显且不可编辑', () => {
    const createView = renderWithProviders(
      <RoleForm mode="create" role={null} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    expect(screen.getByPlaceholderText('请输入角色标识')).toBeInTheDocument()
    createView.unmount()

    renderWithProviders(
      <RoleForm mode="edit" role={editRoleFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    expect(screen.queryByPlaceholderText('请输入角色标识')).not.toBeInTheDocument()
    // code 创建后不可修改（规格 §14.3）：编辑模式仅禁用态回显
    expect(screen.getByDisplayValue('operator')).toBeDisabled()
    // 编辑初始回显
    expect(screen.getByDisplayValue('运营')).toBeInTheDocument()
    expect(screen.getByDisplayValue('原描述')).toBeInTheDocument()
  })

  it('空提交触发行内必填校验，不调用提交', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RoleForm mode="create" role={null} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(await screen.findByText('请输入角色标识')).toBeInTheDocument()
    expect(screen.getByText('请输入角色名称')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })
})

describe('RoleForm 提交载荷（规格 §14.3 写入契约）', () => {
  it('创建载荷为 { code, name, description?, status }：trim、空 description 省略', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RoleForm mode="create" role={null} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillCreateAndSubmit(user)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy.mock.calls[0][0]).toEqual({
      mode: 'create',
      dto: { code: 'operator', name: '运营', status: 'enabled' },
    })
  })

  it('创建载荷含非空 trim 后的 description', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RoleForm mode="create" role={null} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await user.type(screen.getByPlaceholderText('请输入角色标识'), 'operator')
    await user.type(screen.getByPlaceholderText('请输入角色名称'), '运营')
    await user.type(screen.getByPlaceholderText('请输入描述'), '  日常运营  ')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy.mock.calls[0][0]).toEqual({
      mode: 'create',
      dto: { code: 'operator', name: '运营', description: '日常运营', status: 'enabled' },
    })
  })

  it('编辑载荷为 { name, description?, status }：不含 code，清空 description 时省略', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RoleForm mode="edit" role={editRoleFixture} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    // 清空 description：选中 textarea 内容后输入空串
    const descriptionInput = screen.getByDisplayValue('原描述')
    await user.clear(descriptionInput)
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy.mock.calls[0][0]).toEqual({
      mode: 'edit',
      dto: { name: '运营', status: 'enabled' },
    })
  })
})

describe('RoleForm 错误映射（规格 §14.4）', () => {
  it('VALIDATION_FAILED.details 已知字段映射到表单项，未知字段显示页面级错误', async () => {
    const user = userEvent.setup()
    submitSpy.mockRejectedValueOnce(
      createApiError({
        httpStatus: 400,
        errorCode: API_ERROR_CODES.VALIDATION_FAILED,
        message: '请求参数校验失败',
        details: {
          fields: [
            { field: 'code', message: 'code 已被占用' },
            { field: 'unknown', message: '未知字段问题' },
          ],
        },
      }),
    )
    renderWithProviders(
      <RoleForm mode="create" role={null} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillCreateAndSubmit(user)
    expect(await screen.findByText('code 已被占用')).toBeInTheDocument()
    expect(screen.getByText('unknown: 未知字段问题')).toBeInTheDocument()
  })

  it('RESOURCE_CONFLICT（code 重复）显示页面级错误文案', async () => {
    const user = userEvent.setup()
    submitSpy.mockRejectedValueOnce(
      createApiError({
        httpStatus: 409,
        errorCode: API_ERROR_CODES.RESOURCE_CONFLICT,
        message: '角色标识已存在',
      }),
    )
    renderWithProviders(
      <RoleForm mode="create" role={null} submitting={false} onSubmit={submitSpy} onCancel={cancelSpy} />,
    )
    await fillCreateAndSubmit(user)
    await waitFor(() => expect(screen.getByText('操作与当前状态冲突，请刷新后重试')).toBeInTheDocument())
  })
})
