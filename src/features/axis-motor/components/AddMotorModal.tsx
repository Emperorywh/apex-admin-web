import { useEffect } from 'react'
import { Form, Modal, Typography } from 'antd'
import { axisMotorData, getMotorAction } from '../axisMotor.model'
import type { MotorAttributes } from '../axisMotor.types'
import { MotorAttributesFields } from './MotorAttributesFields'

/** 弹窗显隐由页面控制；创建返回失败时保留用户输入，便于修正后重新提交。 */
interface AddMotorModalProps {
  open: boolean
  initialActionType?: string
  onCancel: () => void
  onCreate: (values: MotorAttributes) => boolean
}

/** 新增入口复用属性字段；动作与默认硬件均来自本地目录，不产生额外的数据源。 */
export function AddMotorModal({ open, initialActionType, onCancel, onCreate }: AddMotorModalProps) {
  const [form] = Form.useForm<MotorAttributes>()

  // 每次打开时按当前动作重新初始化，取消的草稿不带入下一次新增；同步操作无需清理资源。
  useEffect(() => {
    if (!open) return

    const action = initialActionType ? getMotorAction(initialActionType) : axisMotorData.actions[0]
    form.resetFields()
    form.setFieldsValue({
      name: action.label,
      actionType: action.id,
      driverId: axisMotorData.drivers[0].value,
      encoderId: axisMotorData.encoders[0].value,
    })
  }, [form, initialActionType, open])

  // 校验通过后统一去除名称首尾空白，成功关闭由父级完成，失败不重置草稿。
  const handleCreate = (values: MotorAttributes) => {
    onCreate({ ...values, name: values.name.trim() })
  }

  return (
    // 预先挂载表单，保证打开时的初始化 Effect 已连接实例；重置统一由上述 Effect 管理。
    <Modal
      title="新增轴电机"
      open={open}
      width={560}
      forceRender
      okText="创建电机"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Typography.Paragraph type="secondary">
        选择动作类型并关联驱动器、编码器，轴所属编号将自动填写。
      </Typography.Paragraph>
      {/* 新增与卡片编辑统一使用左标签、右输入的属性布局。 */}
      <Form<MotorAttributes> form={form} layout="horizontal" onFinish={handleCreate}>
        <MotorAttributesFields form={form} />
      </Form>
    </Modal>
  )
}
