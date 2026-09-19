/**
 * 新增/编辑电梯弹窗（P14）：真实 addElevator/updateElevator 接入。
 *
 * 交互与契约要点：
 * - 新增模式（editTarget=null）：草稿保留（A13/DoD 7）——关闭弹窗不清空输入，
 *   草稿留页签内存（Activity 缓存切页不丢），提交成功才清空；显式「清空」入口；
 * - 编辑模式（editTarget 非 null）：打开时按行记录重填（旧实现同语义）；
 *   设备配置以 4 空格缩进 JSON 字符串回显（旧实现同形态）；
 *   编辑提交回带原 deviceKey 定位（表单无 deviceKey 输入框，旧实现同边界）；
 * - 驱动切换（P14 专项验收「驱动切换校验参数」）：选中驱动即以其
 *   driverProtocol 覆写设备配置 JSON（旧实现同语义）；取消选择不清空已有配置
 *   （旧实现 onDeselect 置 undefined，此处保留用户已编辑值更稳妥，不臆造丢弃）；
 * - 设备配置校验：必填 + JSON.parse 真实解析（解析失败报错并保留输入，
 *   不做半吊子格式提示）；提交为解析后的对象原样上送；
 * - 数值边界（旧实现同边界）：楼层 -200..200 整数、端口 0..65535 整数；
 * - 失败留稿：提交失败保留全部输入并提示，写操作不自动重试；
 * - 提交防重复（confirmLoading + submitting 早退）。
 */

import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal, Radio, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  addElevator,
  updateElevator,
} from '@/services/device-elevator/device-elevator.service'
import type {
  ElevatorDriverDto,
  ElevatorDto,
} from '@/services/device-elevator/device-elevator.service.types'

/** 表单值形状（设备配置在表单层为 JSON 文本，提交时解析为对象） */
interface ElevatorFormValues {
  deviceName: string
  driverKey: string
  floors: number
  ip: string
  port: number
  deviceStatus: boolean
  deviceConfig: string
}

interface ElevatorFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: ElevatorDto | null
  /** 驱动集合（页面加载；为空时驱动下拉展示加载失败/空态，不阻塞弹窗打开） */
  drivers: ElevatorDriverDto[]
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位表单） */
  onSucceeded: () => void
}

export function ElevatorFormModal({
  open,
  editTarget,
  drivers,
  onClose,
  onSucceeded,
}: ElevatorFormModalProps) {
  const { t } = useTranslation('deviceElevator')
  const { message } = App.useApp()
  const [form] = Form.useForm<ElevatorFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）；编辑模式同样保护
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑电梯') : t('新增电梯'))

  // 目标切换语义：编辑目标出现时按行记录重填（配置=4 空格缩进 JSON，旧实现同形态）；
  // 编辑目标清除（转新增）时复位干净基线（启用为默认值，旧实现同默认）。
  useEffect(() => {
    if (editTarget) {
      form.setFieldsValue({
        deviceName: editTarget.deviceName ?? '',
        driverKey: editTarget.driverKey ?? '',
        floors: editTarget.floors as number,
        ip: editTarget.ip ?? '',
        port: editTarget.port as number,
        deviceStatus: editTarget.deviceStatus ?? true,
        deviceConfig: JSON.stringify(editTarget.deviceConfig ?? {}, null, 4),
      })
    } else {
      form.resetFields()
    }
    setDirty(false)
  }, [editTarget, form])

  // 有任何输入即视为脏（草稿保留与关页确认的依据）
  const handleValuesChange = useCallback(() => setDirty(true), [])

  /** 切换驱动：以该驱动的 driverProtocol 覆写设备配置 JSON（旧实现同语义） */
  const handleDriverChange = useCallback(
    (value: string) => {
      const driver = drivers.find((item) => item.key === value)
      const protocol = JSON.stringify(driver?.driverProtocol ?? {}, null, 4)
      form.setFieldValue('deviceConfig', protocol)
      setDirty(true)
    },
    [drivers, form],
  )

  /** 清空表单：显式用户动作；提交成功后也走这里复位干净基线 */
  const handleResetDraft = () => {
    form.resetFields()
    setDirty(false)
  }

  const handleClose = () => {
    // 关闭保留草稿（DoD 7）；丢弃路径是显式「清空」按钮
    onClose()
  }

  const handleOk = async () => {
    if (submitting) return
    const values = await form.validateFields()
    // 设备配置必须能解析为 JSON 对象（旧实现同校验语义；失败保留输入不关弹窗）
    let config: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(values.deviceConfig)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not an object')
      }
      config = parsed as Record<string, unknown>
    } catch {
      message.error(t('解析json格式出错'))
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && editTarget) {
        // 编辑：回带原 deviceKey 定位（表单无该输入框，旧实现同边界）
        await updateElevator({
          deviceKey: editTarget.deviceKey,
          deviceName: values.deviceName.trim(),
          driverKey: values.driverKey,
          floors: values.floors,
          deviceStatus: values.deviceStatus,
          ip: values.ip.trim(),
          port: values.port,
          deviceConfig: config,
        })
        message.success(t('更新电梯成功'))
      } else {
        await addElevator({
          deviceName: values.deviceName.trim(),
          driverKey: values.driverKey,
          floors: values.floors,
          deviceStatus: values.deviceStatus,
          ip: values.ip.trim(),
          port: values.port,
          deviceConfig: config,
        })
        message.success(t('新增电梯成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error((isEdit ? t('更新电梯出错') : t('新增电梯出错')) + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('编辑电梯') : t('新增电梯')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      // 草稿弹窗：关闭不销毁内容（新增草稿保留在页签内存）
      destroyOnHidden={false}
      footer={[
        <Button key="reset" onClick={handleResetDraft} disabled={submitting}>
          {t('清空')}
        </Button>,
        <Button key="cancel" onClick={handleClose} disabled={submitting}>
          {t('取消')}
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleOk}>
          {t('确定')}
        </Button>,
      ]}
    >
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal/Drawer 内表单既定参数） */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={handleValuesChange}
        initialValues={{
          deviceName: '',
          driverKey: '',
          floors: undefined,
          ip: '',
          port: undefined,
          deviceStatus: true,
          deviceConfig: '',
        }}
      >
        <Form.Item
          label={t('设备名称')}
          name="deviceName"
          rules={[{ required: true, message: t('请输入设备名称') }]}
        >
          {/* 名称/ip 上限 64 字符（旧实现同边界），showCount 同旧形态 */}
          <Input maxLength={64} showCount placeholder={t('请输入设备名称')} />
        </Form.Item>

        <Form.Item
          label={t('驱动名称')}
          name="driverKey"
          rules={[{ required: true, message: t('请输入驱动名称') }]}
        >
          {/* 驱动下拉：label=驱动名称 value=驱动 key（协议定位键）；切换即覆写配置 */}
          <Select
            placeholder={t('请选择驱动')}
            allowClear={false}
            options={drivers.map((driver) => ({
              label: driver.name ?? driver.key ?? '',
              value: driver.key ?? '',
            }))}
            onChange={handleDriverChange}
          />
        </Form.Item>

        <Form.Item
          label={t('电梯楼层')}
          name="floors"
          rules={[{ required: true, message: t('请输入电梯楼层') }]}
        >
          {/* 楼层整数语义：-200..200 步进 1（旧实现同边界）；提交为协议原样数值 */}
          <InputNumber
            style={{ width: '100%' }}
            placeholder={t('请输入电梯楼层')}
            min={-200}
            max={200}
            step={1}
            precision={0}
          />
        </Form.Item>

        <Form.Item
          label={t('IP地址')}
          name="ip"
          rules={[{ required: true, message: t('请输入ip地址') }]}
        >
          <Input maxLength={64} showCount placeholder={t('请输入ip地址')} />
        </Form.Item>

        <Form.Item
          label={t('端口')}
          name="port"
          rules={[{ required: true, message: t('请输入端口') }]}
        >
          {/* 端口整数语义：0..65535（旧实现同边界） */}
          <InputNumber
            style={{ width: '100%' }}
            placeholder={t('请输入端口')}
            min={0}
            max={65535}
            step={1}
            precision={0}
          />
        </Form.Item>

        <Form.Item
          label={t('是否启用')}
          name="deviceStatus"
          rules={[{ required: true, message: t('请选择是否启用') }]}
        >
          {/* 布尔明确两态（false 是明确状态）；默认启用（旧实现同默认） */}
          <Radio.Group
            options={[
              { value: true, label: t('启用') },
              { value: false, label: t('禁用') },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={t('设备配置')}
          name="deviceConfig"
          rules={[{ required: true, message: t('请输入设备配置') }]}
        >
          {/* JSON 文本编辑区：选中驱动自动填充该驱动协议模板；提交时真实解析校验 */}
          <Input.TextArea
            placeholder={t('请输入设备配置')}
            autoSize={{ minRows: 2, maxRows: 10 }}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
