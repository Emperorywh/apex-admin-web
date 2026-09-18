/**
 * 任务取消弹窗（P03）：取消命令必须填写原因（旧实现保留的必填交互）。
 *
 * - 提交 operateOrderTask(CMD_ORDER_CANCEL)：code=200 且无状态码 → 成功；
 *   携带调度状态码 → 业务拒绝（映射文案/原值），输入保留，不冒充成功；
 * - 请求失败（网络/会话）→ 错误提示，输入与弹窗保留（DoD 6/8）；
 * - 提交期间防重复点击（confirmLoading）；
 * - 写操作不自动重试：失败由用户决定再次提交。
 */

import { useEffect, useState } from 'react'
import { App, Form, Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { operateOrderTask } from '@/services/order-record/order.service'
import { DISPATCHER_STATUS_TEXT } from '@/services/order-record/order.service.types'

interface OrderCancelModalProps {
  open: boolean
  /** 目标任务 key（列表行 orderKey，协议原值不翻译） */
  orderKey: string
  /** 目标任务名（确认信息展示用） */
  orderName: string
  onClose: () => void
  /** 取消成功后回调（页面刷新列表与统计） */
  onSucceeded: () => void
}

interface CancelFormValues {
  cancelReason: string
}

export function OrderCancelModal({ open, orderKey, orderName, onClose, onSucceeded }: OrderCancelModalProps) {
  const { t } = useTranslation('orderRecord')
  const { message } = App.useApp()
  const [form] = Form.useForm<CancelFormValues>()
  const [submitting, setSubmitting] = useState(false)

  // 每次打开都从空输入开始：取消原因是针对具体任务的一次性输入，不保留草稿
  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      const statusCode = await operateOrderTask({
        orderTaskKey: orderKey,
        cancelReason: values.cancelReason,
        operate: 'CMD_ORDER_CANCEL',
      })
      if (statusCode) {
        // 调度子系统拒绝：映射文案优先，未知码显示原值（规格 18.3），不关闭弹窗
        message.warning(t(DISPATCHER_STATUS_TEXT[statusCode] ?? statusCode))
        return
      }
      message.success(t('订单操作成功'))
      onClose()
      onSucceeded()
    } catch (error) {
      // 主动取消（页签关闭/刷新）静默；真实失败提示并保留输入
      if (!isCancelledError(error)) {
        message.error(t('订单操作失败') + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={t('取消原因')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={submitting}
      okText={t('确定')}
      cancelText={t('取消')}
      destroyOnHidden
    >
      {/* 标签横排居左（视觉规范） */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
      >
        {/* 目标任务以名称+编号列明（DoD 8：确认对象明确），原文展示不翻译 */}
        <Form.Item label={t('任务名称')}>
          <Input value={orderName ? `${orderName}（${orderKey}）` : orderKey} disabled />
        </Form.Item>
        <Form.Item
          label={t('取消原因')}
          name="cancelReason"
          rules={[{ required: true, message: t('请输入取消订单的原因') }]}
        >
          <Input
            placeholder={t('请输入取消订单的原因')}
            maxLength={20}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
