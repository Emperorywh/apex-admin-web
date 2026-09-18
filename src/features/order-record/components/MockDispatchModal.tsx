/**
 * 模拟分配弹窗（P03）：调用真实仿真接口 mockDispatch（D25/规格 9）。
 *
 * - 列表「检测」按钮（队列中任务可用）打开本弹窗，选择车辆后模拟分配；
 * - 界面明确标注「仿真」：这是后端真实仿真接口（非前端 mock）。名称含 mock 的
 *   真实业务 API 按已确认仿真范围处理并标注（规格 9/12），不得删去也不得伪装成普通功能；
 * - 防重复提交；失败保留弹窗，结果按真实响应呈现；写操作不自动重试。
 */

import { useEffect, useState } from 'react'
import { Alert, App, Button, Form, Modal, Select, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'
import { mockDispatch } from '@/services/order-record/order.service'

interface MockDispatchModalProps {
  open: boolean
  /** 目标订单 key（模拟分配对象） */
  orderKey: string
  onClose: () => void
  /** 模拟分配成功后回调（页面刷新列表与统计） */
  onSucceeded: () => void
}

interface MockDispatchFormValues {
  vehicleKey: string
}

export function MockDispatchModal({ open, orderKey, onClose, onSucceeded }: MockDispatchModalProps) {
  const { t } = useTranslation('orderRecord')
  const { message } = App.useApp()
  const [form] = Form.useForm<MockDispatchFormValues>()
  const [submitting, setSubmitting] = useState(false)

  // 车辆选项：共享契约（scope 取消/防乱序/失败清空+下拉内重试）
  const vehicles = useStaticOptions<SimpleVehicleDto>((signal) => fetchSimpleVehicles({ signal }))

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      await mockDispatch({ orderTaskKey: orderKey, vehicleKey: values.vehicleKey })
      message.success(t('模拟订单成功'))
      onClose()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('模拟订单出错') + ': ' + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={t('订单检测')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={submitting}
      okText={t('确定')}
      cancelText={t('取消')}
      destroyOnHidden
    >
      {/*
        仿真标注（D25）：说明操作为调度仿真并列明目标对象（DoD 8）；
        orderKey 为协议原值，不做翻译。
      */}
      <Alert
        type="info"
        showIcon
        message={t('仿真说明')}
        description={`${t('仿真操作提示')}：${orderKey}`}
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label={t('车辆')}
          name="vehicleKey"
          rules={[{ required: true, message: t('请选择车辆!') }]}
        >
          <Select
            placeholder={t('请选择检测车辆')}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={vehicles.loading}
            fieldNames={{ label: 'name', value: 'key' }}
            options={vehicles.options ?? []}
            notFoundContent={
              vehicles.error ? (
                <Spin size="small">
                  <Button size="small" onClick={vehicles.reload}>
                    {t('重新加载')}
                  </Button>
                </Spin>
              ) : undefined
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
