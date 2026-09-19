/**
 * 电梯控制命令弹窗（P14）：呼叫电梯（外呼）/ 电梯开门 / 电梯关门。
 *
 * 交互与契约要点（控制样板升级，旧实现仅「弹窗一问」无确认框）：
 * - 流程：操作菜单选择命令 → 本弹窗录入命令参数 → 确定 → confirmCommand
 *   命令确认（列明对象电梯与影响，附「提交≠完成」固定附注）→ 发送命令；
 *   确认在参数录入之后，确认内容可携带具体参数值；
 * - 外呼参数：当前楼层（-200..200 整数，旧实现同边界）；
 *   开/关门参数：目标电梯门（FRONT 前门 / BACK 后门，旧实现同取值域）；
 * - 受理语义（A14/A15）：命令提交成功仅代表后端受理，电梯实际动作完成与否
 *   以「状态」按钮重新查询为准；提示文案明确「已发送」而非「已完成」；
 * - 命令失败/超时不自动补发，失败如实透传后端 message，是否重试由用户决定；
 * - G06：内呼（电梯上楼）接口未文档化，本弹窗不提供内呼模式——
 *   页面操作菜单以灰色标记入口 + 点击说明呈现，不用外呼猜替；
 * - 弹窗不保留草稿（控制命令即时性输入，关闭即弃；旧实现关闭即 reset 同语义）。
 */

import { useEffect, useState } from 'react'
import { Form, InputNumber, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'

/** 命令种类（G06：无内呼模式——接口未文档化，页面以禁用入口说明） */
export type ElevatorCommandKind = 'outerCall' | 'openDoor' | 'closeDoor'

/** 表单值形状（按命令种类取用对应字段） */
interface ElevatorControlFormValues {
  currentFloor?: number
  doorWay?: string
}

interface ElevatorControlModalProps {
  open: boolean
  /** 当前命令种类 */
  command: ElevatorCommandKind
  /** 目标电梯（展示名 + 定位 key） */
  deviceKey: string
  deviceName: string
  onClose: () => void
  /**
   * 确认发送回调：参数校验通过且 confirmCommand 确认后触发；
   * 提交与反馈由页面层处理（本组件只负责参数录入与确认环节）。
   */
  onConfirm: (params: { currentFloor?: number; doorWay?: string }) => void
}

export function ElevatorControlModal({
  open,
  command,
  deviceKey,
  deviceName,
  onClose,
  onConfirm,
}: ElevatorControlModalProps) {
  const { t } = useTranslation('deviceElevator')
  const [form] = Form.useForm<ElevatorControlFormValues>()
  const [confirming, setConfirming] = useState(false)

  // 每次打开/切换命令重置输入（控制命令即时性输入，不保留草稿）
  useEffect(() => {
    if (open) {
      form.resetFields()
    }
  }, [open, command, form])

  const title =
    command === 'outerCall' ? t('呼叫电梯') : t('电梯操作')

  const handleOk = async () => {
    if (confirming) return
    const values = await form.validateFields()
    setConfirming(true)
    try {
      // 参数校验通过后才进入命令确认（确认内容携带具体参数，见页面层实现）
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
        {command === 'outerCall' ? (
          <Form.Item
            label={t('当前楼层')}
            name="currentFloor"
            rules={[{ required: true, message: t('请输入电梯当前楼层') }]}
          >
            {/* 呼叫楼层整数语义：-200..200（旧实现同边界） */}
            <InputNumber
              style={{ width: '100%' }}
              placeholder={t('请输入当前楼层')}
              min={-200}
              max={200}
              step={1}
              precision={0}
            />
          </Form.Item>
        ) : (
          <Form.Item
            label={t('目标电梯门')}
            name="doorWay"
            rules={[{ required: true, message: t('请选择要操作的电梯门') }]}
          >
            {/* 门位置取值域为协议枚举 FRONT/BACK（旧实现同取值） */}
            <Select
              placeholder={t('请选择要操作的电梯门')}
              options={[
                { label: t('前门'), value: 'FRONT' },
                { label: t('后门'), value: 'BACK' },
              ]}
            />
          </Form.Item>
        )}
        {/* 目标电梯提示：确认框对象以 deviceName（deviceKey）列明 */}
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
