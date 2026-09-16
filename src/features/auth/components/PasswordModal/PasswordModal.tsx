/**
 * 修改本人密码弹窗（G02，T017）：迁移自旧 components/PasswordModal。
 * 校验、占位与成功/失败反馈按源实现：新密码须同时含字母和数字（4-16 位），
 * 两次输入一致；成功后提示并触发退出回登录页（源 onSuccess = 退出登录）。
 */

import { useEffect } from 'react'
import { Form, Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { App } from 'antd'
import { apiErrorMessage } from '@/services/request/request'
import { updateUserPassword } from '@/services/system/user/user.service'

interface PasswordFormValues {
  password: string
  confirm: string
}

interface PasswordModalProps {
  /** 弹窗是否打开 */
  open: boolean
  /** 当前登录用户名（源行为：按用户名改本人密码，无独立输入框） */
  username?: string
  /** 关闭弹窗（取消/成功后由调用方置 false） */
  onClose: () => void
  /** 密码修改成功后的回调（源行为：退出登录回登录页） */
  onSuccess: () => void
}

export function PasswordModal({ open, username, onClose, onSuccess }: PasswordModalProps) {
  const { t } = useTranslation('common')
  const [form] = Form.useForm<PasswordFormValues>()
  const { message } = App.useApp()

  /* 关闭后清空表单（源 destroyOnClose 语义）；仅校验态错误留在表单内 */
  useEffect(() => {
    if (!open) form.resetFields()
  }, [open, form])

  const handleOk = async () => {
    if (!username) return
    let values: PasswordFormValues
    try {
      values = await form.validateFields()
    } catch {
      // 校验失败：错误提示已由表单展示
      return
    }
    try {
      await updateUserPassword({ username, password: values.password })
    } catch (error) {
      const text = apiErrorMessage(error)
      void message.error(text ? `${t('修改密码失败')}${text}` : t('修改密码失败'))
      return
    }
    message.success(t('修改密码成功'))
    onClose()
    // 源行为：改密成功即退出登录，回登录页用新密码重新登录
    onSuccess()
  }

  return (
    <Modal
      title={username ? `${t('修改密码')} - ${username}` : t('修改密码')}
      open={open}
      onOk={() => void handleOk()}
      onCancel={onClose}
      okText={t('确定')}
      cancelText={t('取消')}
      destroyOnHidden
    >
      <Form<PasswordFormValues> form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label={t('新密码')}
          name="password"
          rules={[
            { required: true, message: t('请输入新密码') },
            {
              // 源校验：密码必须同时包含字母和数字，长度 4-16 位
              pattern: /^(?=.*[A-Za-z])(?=.*\d).{4,16}$/,
              message: t('密码必须包含字母和数字，长度4-16位'),
            },
          ]}
        >
          <Input.Password placeholder={t('请输入新密码')} maxLength={32} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label={t('确认密码')}
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true, message: t('请再次输入新密码') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error(t('两次输入的密码不一致')))
              },
            }),
          ]}
        >
          <Input.Password placeholder={t('请再次输入新密码')} maxLength={32} autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
