/**
 * 风淋门控制命令弹窗（P18）：开门 / 关门（需选择前门 / 后门）。
 *
 * 交互与契约要点（与 P14 电梯控制弹窗同构；旧实现为「弹窗一问」直接发送）：
 * - 流程：操作菜单选择命令 → 本弹窗选择门类型 → 确定 → confirmCommand
 *   命令确认（列明对象风淋门与影响，附「提交≠完成」语义）→ 发送命令；
 *   确认在参数录入之后，确认内容可携带具体门类型；
 * - 开/关门参数：门类型（FRONT 前门 / BACK 后门，协议枚举，旧实现同取值域；
 *   风淋门为前/后双门设备，doorWay 必填）；
 * - 受理语义（A14）：命令提交成功仅代表后端受理，风淋门实际动作完成与否
 *   以「状态」按钮重新查询为准；提示文案明确「已发送」而非「已完成」；
 * - 命令失败/超时不自动补发，失败如实透传后端 message，是否重试由用户决定；
 * - 旧实现 items 仅保留开门/关门两个可达命令（风淋/清占用在当前来源不可达），
 *   本弹窗不提供其余命令模式；
 * - 弹窗不保留草稿（控制命令即时性输入，关闭即弃；旧实现关闭即 reset 同语义）。
 */

import { useEffect, useState } from 'react'
import { Form, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'

/** 命令种类（旧实现可达命令仅开门/关门，均需选择门类型） */
export type AirShowerCommandKind = 'openDoor' | 'closeDoor'

/** 表单值形状（门类型） */
interface AirShowerControlFormValues {
  doorWay?: string
}

interface AirShowerControlModalProps {
  open: boolean
  /** 当前命令种类 */
  command: AirShowerCommandKind
  /** 目标风淋门（展示名 + 定位 key） */
  deviceKey: string
  deviceName: string
  onClose: () => void
  /**
   * 确认发送回调：参数校验通过后触发；
   * confirmCommand 确认与提交、反馈由页面层处理（本组件只负责参数录入环节）。
   */
  onConfirm: (params: { doorWay?: string }) => void
}

export function AirShowerControlModal({
  open,
  command,
  deviceKey,
  deviceName,
  onClose,
  onConfirm,
}: AirShowerControlModalProps) {
  const { t } = useTranslation('deviceAirShower')
  const [form] = Form.useForm<AirShowerControlFormValues>()
  const [confirming, setConfirming] = useState(false)

  // 每次打开/切换命令重置输入（控制命令即时性输入，不保留草稿）
  useEffect(() => {
    if (open) {
      form.resetFields()
    }
  }, [open, command, form])

  // 弹窗标题按旧实现原样：开门「风淋门开门」/ 关门「风淋门关门」
  const title = command === 'openDoor' ? t('风淋门开门') : t('风淋门关门')

  // 门类型字段 label/占位按旧实现随命令区分（开门类型/关门类型）
  const doorLabel = command === 'openDoor' ? t('开门类型') : t('关门类型')
  const doorPlaceholder = command === 'openDoor' ? t('请选择开门类型') : t('请选择关门类型')

  const handleOk = async () => {
    if (confirming) return
    const values = await form.validateFields()
    setConfirming(true)
    try {
      // 参数校验通过后才进入命令确认（确认内容携带具体门类型，见页面层实现）
      onConfirm(values)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={t('确定')}
      cancelText={t('取消')}
      confirmLoading={confirming}
      destroyOnHidden
    >
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal/Drawer 内表单既定参数） */}
      <Form form={form} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} autoComplete="off">
        <Form.Item
          label={doorLabel}
          name="doorWay"
          rules={[{ required: true, message: t('请选择(开/关)门类型') }]}
        >
          {/* 门类型取值域为协议枚举 FRONT/BACK（旧实现同取值） */}
          <Select
            placeholder={doorPlaceholder}
            options={[
              { label: t('前门'), value: 'FRONT' },
              { label: t('后门'), value: 'BACK' },
            ]}
          />
        </Form.Item>
        {/* 目标风淋门提示：确认框对象以 deviceName（deviceKey）列明 */}
        <Form.Item label={t('设备名称')} style={{ marginBottom: 0 }}>
          <span>
            {deviceName || deviceKey}
            {deviceName && deviceKey ? `（${deviceKey}）` : ''}
          </span>
        </Form.Item>
      </Form>
    </Modal>
  )
}
