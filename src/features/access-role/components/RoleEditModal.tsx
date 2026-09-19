/**
 * 角色新增 / 编辑弹窗（P32 角色管理页）：真实 addRole/updateRole 接入。
 *
 * 交互与契约要点（旧实现 RoleModal 等价迁移）：
 * - 单弹窗双模式：modifyRow 为 null 时新增（addRole），非空时编辑（updateRole
 *   按 id 定位整组提交 code/name/state）；打开时按模式回填 / 清空（旧版
 *   useEffect 依赖 open 的教训注释等价保留——仅依赖 modifyRow 会在「编辑→取消
 *   →再编辑同一行」时因引用不变而跳过回填，叠加 destroyOnHidden 清空表单出
 *   现「点击编辑却无信息回显」）；
 * - 三字段校验与旧版逐条一致：编码/名称必填、最长 64、showCount；状态必选
 *   （ENABLED/DISABLED）；表单参数按 AGENTS 第 3 节统一（labelCol 6 / wrapper
 *   18，旧版 5/17 为项目内统一前形态，行为等价）；
 * - 提交防重复（confirmLoading + submitting 门）；失败保留输入如实反馈，写
 *   操作不自动重试；成功后由页面刷新列表并关闭弹窗；
 * - 关闭即销毁草稿（destroyOnHidden，旧版 destroyOnClose + resetFields 同语
 *   义）；弹窗短生命周期，旧版无切页脏保护，保持等价不新增。
 */

import { useEffect, useState } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  addRole,
  updateRole,
} from '@/services/access-role/access-role.service'
import type {
  AuthRoleRecord,
  AuthRoleState,
} from '@/services/access-role/access-role.service.types'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'

/** 角色表单字段形状（与旧版 RoleFormValues 一致） */
interface RoleFormValues {
  code: string
  name: string
  state: AuthRoleState
}

interface RoleEditModalProps {
  /** 弹窗是否打开 */
  open: boolean
  /** 编辑目标行快照（null=新增模式） */
  modifyRow: AuthRoleRecord | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表并关闭弹窗） */
  onSucceeded: () => void
}

export function RoleEditModal({
  open,
  modifyRow,
  onClose,
  onSucceeded,
}: RoleEditModalProps) {
  const { t } = useTranslation('access-role')
  const { message } = App.useApp()
  const [form] = Form.useForm<RoleFormValues>()
  // 提交中状态：驱动确认按钮 loading，防止重复提交
  const [submitting, setSubmitting] = useState(false)

  // 角色状态选项：启用 / 禁用（旧版同源枚举）
  const stateOptions: { label: string; value: AuthRoleState }[] = [
    { label: t('启用'), value: 'ENABLED' },
    { label: t('禁用'), value: 'DISABLED' },
  ]

  /** 弹窗打开时按模式回填 / 清空表单（旧版同语义，依赖 open 触发） */
  useEffect(() => {
    if (!open) return
    if (modifyRow) {
      form.setFieldsValue({
        code: modifyRow.code ?? '',
        name: modifyRow.name ?? '',
        // 未知枚举不喂给受控 Select（选项只有 ENABLED/DISABLED）——展示层
        // 语义见列表列；表单回填仅在受控枚举内进行，避免 antd 原值告警
        state: modifyRow.state === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      })
    } else {
      // 新增模式：主动清空，避免上一轮编辑的残留值带入（旧版同语义）
      form.resetFields()
    }
  }, [open, modifyRow, form])

  /** 弹窗确认：校验通过后按模式调用新增 / 更新（旧版 handleOk 同结构） */
  const handleOk = async () => {
    if (submitting) return
    let values: RoleFormValues
    try {
      values = await form.validateFields()
    } catch {
      // 校验失败：antd 已在字段下方呈现错误，无需额外处理
      return
    }
    setSubmitting(true)
    try {
      if (modifyRow) {
        await updateRole({ ...values, id: Number(modifyRow.id) })
        message.success(t('编辑角色成功'))
      } else {
        await addRole(values)
        message.success(t('新增角色成功'))
      }
      onSucceeded()
    } catch (error) {
      // 失败保留输入；取消（切页/弹窗销毁引发的请求中止）不打错误提示
      if (!isCancelledError(error)) {
        message.error(
          modifyRow
            ? t('编辑角色失败：{{msg}}', { msg: apiErrorMessage(error) })
            : t('新增角色失败：{{msg}}', { msg: apiErrorMessage(error) }),
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={modifyRow ? t('编辑角色') : t('新增角色')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      // 关闭即销毁草稿（旧版 destroyOnClose + resetFields 同语义，等价迁移）
      destroyOnHidden
      confirmLoading={submitting}
      okText={t('确定')}
      cancelText={t('取消')}
    >
      <Form
        form={form}
        // 弹窗内表单参数（AGENTS 第 3 节：labelCol 6 / wrapper 18，登录页同参数）
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
      >
        <Form.Item<RoleFormValues>
          label={t('角色编码')}
          name="code"
          rules={[{ required: true, message: t('请输入角色编码') }]}
        >
          <Input placeholder={t('请输入角色编码')} maxLength={64} showCount />
        </Form.Item>

        <Form.Item<RoleFormValues>
          label={t('角色名称')}
          name="name"
          rules={[{ required: true, message: t('请输入角色名称') }]}
        >
          <Input placeholder={t('请输入角色名称')} maxLength={64} showCount />
        </Form.Item>

        <Form.Item<RoleFormValues>
          label={t('角色状态')}
          name="state"
          rules={[{ required: true, message: t('请选择角色状态') }]}
        >
          <Select placeholder={t('请选择角色状态')} options={stateOptions} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
