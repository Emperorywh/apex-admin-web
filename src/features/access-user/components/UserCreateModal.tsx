/**
 * 新增用户弹窗（P31 用户管理页）：真实 addUser 接入（POST + JSON body）。
 *
 * 交互与契约要点（旧实现 UserModal 等价迁移）：
 * - 三字段校验与旧版逐条一致：用户名 4-16 位字母/数字/下划线；密码与确认密码
 *   均须同时包含字母和数字、长度 4-16 位且两次一致；
 * - 密码仅以 MD5 摘要进入协议（SparkMD5 32 位小写，与登录同源适配）；确认密码
 *   一致性校验通过后同样以 MD5 摘要随请求提交——旧实现三字段等价形态（联验
 *   实证：两/三字段后端均受理，confirm 提供时后端校验一致性）；
 * - 提交防重复（confirmLoading + submitting 门）；失败保留输入如实反馈，写
 *   操作不自动重试；成功后由页面刷新列表并关闭弹窗；
 * - 关闭即销毁草稿（destroyOnHidden，旧版 destroyOnClose + resetFields 同语义）；
 *   弹窗短生命周期，旧版无切页脏保护，保持等价不新增。
 */

import { useState } from 'react'
import { App, Form, Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import SparkMD5 from 'spark-md5'
import { addAuthUser } from '@/services/access-user/access-user.service'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'

/** 表单字段形状（明文仅存在于组件内存，提交前 MD5 摘要、绝不持久化） */
interface UserFormValues {
  username: string
  password: string
  confirm: string
}

interface UserCreateModalProps {
  open: boolean
  onClose: () => void
  /** 提交成功后回调（页面刷新列表并关闭弹窗） */
  onSucceeded: () => void
}

export function UserCreateModal({ open, onClose, onSucceeded }: UserCreateModalProps) {
  const { t } = useTranslation('access-user')
  const { message } = App.useApp()
  const [form] = Form.useForm<UserFormValues>()
  // 提交中状态：驱动确认按钮 loading，防止重复提交
  const [submitting, setSubmitting] = useState(false)

  /** 弹窗确认：校验通过后按协议提交（密码 MD5 摘要，明文不出组件内存） */
  const handleOk = async () => {
    if (submitting) return
    let values: UserFormValues
    try {
      values = await form.validateFields()
    } catch {
      // 校验失败：antd 已在字段下方呈现错误，无需额外处理
      return
    }
    setSubmitting(true)
    try {
      await addAuthUser({
        username: values.username,
        password: SparkMD5.hash(values.password),
        confirm: SparkMD5.hash(values.confirm),
      })
      message.success(t('新增用户成功'))
      onSucceeded()
    } catch (error) {
      // 失败保留输入；取消（切页/弹窗销毁引发的请求中止）不打错误提示
      if (!isCancelledError(error)) {
        message.error(t('新增用户失败：{{msg}}', { msg: apiErrorMessage(error) }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={t('新增用户')}
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
        <Form.Item<UserFormValues>
          label={t('用户名')}
          name="username"
          rules={[
            { required: true, message: t('请输入用户名') },
            {
              // 用户名仅允许字母、数字、下划线，长度 4-16 位（旧版同规则）
              pattern: /^[a-zA-Z0-9_]{4,16}$/,
              message: t('用户名只能包含字母、数字、下划线，长度4-16位'),
            },
          ]}
        >
          <Input placeholder={t('请输入用户名')} maxLength={16} showCount />
        </Form.Item>

        <Form.Item<UserFormValues>
          label={t('密码')}
          name="password"
          rules={[
            { required: true, message: t('请输入密码') },
            {
              // 密码必须同时包含字母和数字，长度 4-16 位（旧版同规则）
              pattern: /^(?=.*[A-Za-z])(?=.*\d).{4,16}$/,
              message: t('密码必须包含字母和数字，长度4-16位'),
            },
          ]}
        >
          <Input.Password placeholder={t('请输入密码')} maxLength={64} />
        </Form.Item>

        <Form.Item<UserFormValues>
          label={t('确认密码')}
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true, message: t('请再次输入密码') },
            ({ getFieldValue }) => ({
              // 与密码字段联动一致性校验（旧版同规则）
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error(t('两次输入的密码不一致')))
              },
            }),
          ]}
        >
          <Input.Password placeholder={t('请再次输入密码')} maxLength={64} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
