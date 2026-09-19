/**
 * 新增/编辑交通灯弹窗（P17）：真实 addTrafficLight/updateTrafficLight 接入。
 *
 * 旧实现（C:\code\dd\src\pages\TriResource\TrafficLights\EditTrafficLight）逐项
 * 等价迁移 + P14–P16 表单样板升级：
 * - 新增模式（editTarget=null）：草稿保留（A13/DoD 7）——关闭弹窗不清空输入，
 *   草稿留页签内存（Activity 缓存切页不丢），提交成功才清空；显式「清空」入口；
 * - 编辑模式（editTarget 非 null）：打开时按行记录重填（旧实现同语义）；
 *   请求参数以 2 空格缩进 JSON 字符串回显（旧实现同形态）；
 *   编辑提交回带原 deviceKey 定位（表单无 deviceKey 输入框，旧实现同边界）；
 * - 驱动切换（任务卡「驱动参数」核验点）：选中驱动即以其 driverProtocol 覆写
 *   请求参数 JSON（旧实现同语义，4 空格缩进原样）；清除选择同样清空请求参数；
 * - 请求参数校验（旧实现同语义）：非空时必须 JSON.parse 真实解析（失败提示
 *   「请求参数JSON格式不正确」并保留输入、不提交）；空值原样承载（旧实现空串
 *   直传，不在前端改写协议形态）；提交为解析后的对象；
 * - 字段与旧版表单逐项一致：交通灯名称（必填，maxLength 64）/设备驱动（必填）/
 *   请求地址 deviceConfig.url（必填）/请求参数 deviceConfig.requestParam（选填
 *   TextArea rows=10）/响应成功表达式 deviceConfig.responseSuccessExpression（必填）/
 *   到点通知 syncWaitResponse（Switch 是/否，默认否——label「到点通知」为旧版
 *   表单原样，rule 文案「请选择是否同步等待响应」亦旧版原样，label 与语义的
 *   错位为旧版既存事实，等价迁移不改写，登记 P17.md）；
 * - 契约形态：deviceConfig 为通用 map（OpenAPI additionalProperties），旧键集
 *   url/requestParam/responseSuccessExpression 原样承载；旧 UI 无 ip/port/
 *   deviceStatus 三字段（新契约可选），不发明 UI；
 * - 失败留稿：提交失败保留全部输入并提示，写操作不自动重试；
 * - 提交防重复（confirmLoading + submitting 早退）。
 */

import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  addTrafficLight,
  updateTrafficLight,
} from '@/services/device-traffic-light/device-traffic-light.service'
import type {
  TrafficLightDriverDto,
  TrafficLightDto,
} from '@/services/device-traffic-light/device-traffic-light.service.types'

/** 表单值形状（与旧实现嵌套 deviceConfig 字段路径一致；请求参数为 JSON 文本） */
interface TrafficLightFormValues {
  deviceName: string
  driverKey: string
  deviceConfig: {
    url: string
    requestParam?: string
    responseSuccessExpression: string
  }
  syncWaitResponse: boolean
}

interface TrafficLightsFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: TrafficLightDto | null
  /** 驱动集合（页面加载；为空时驱动下拉展示空态，不阻塞弹窗打开） */
  drivers: TrafficLightDriverDto[]
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位表单） */
  onSucceeded: () => void
}

export function TrafficLightsFormModal({
  open,
  editTarget,
  drivers,
  onClose,
  onSucceeded,
}: TrafficLightsFormModalProps) {
  const { t } = useTranslation('deviceTrafficLight')
  const { message } = App.useApp()
  const [form] = Form.useForm<TrafficLightFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）；编辑模式同样保护
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑交通灯') : t('新增交通灯'))

  // 目标切换语义：编辑目标出现时按行记录重填（请求参数=2 空格缩进 JSON，旧实现
  // 同形态）；编辑目标清除（转新增）时复位干净基线（到点通知默认否，旧实现同默认）。
  useEffect(() => {
    if (editTarget) {
      const config = editTarget.deviceConfig
      form.setFieldsValue({
        deviceName: editTarget.deviceName ?? '',
        driverKey: editTarget.driverKey ?? '',
        deviceConfig: {
          // deviceConfig 为通用 map（协议值可能是任意类型）：仅接受字符串形态，
          // 其余按缺失处理留空（不猜协议形态）
          url: typeof config?.url === 'string' ? config.url : '',
          requestParam: config?.requestParam
            ? JSON.stringify(config.requestParam, null, 2)
            : undefined,
          responseSuccessExpression:
            typeof config?.responseSuccessExpression === 'string'
              ? config.responseSuccessExpression
              : '',
        },
        syncWaitResponse: editTarget.syncWaitResponse ?? false,
      })
    } else {
      form.resetFields()
    }
    setDirty(false)
  }, [editTarget, form])

  // 有任何输入即视为脏（草稿保留与关页确认的依据）
  const handleValuesChange = useCallback(() => setDirty(true), [])

  /** 切换驱动：以该驱动的 driverProtocol 覆写请求参数 JSON（旧实现同语义，4 空格缩进） */
  const handleDriverChange = useCallback(
    (value: string) => {
      const driver = drivers.find((item) => item.key === value)
      const protocol = driver?.driverProtocol
        ? JSON.stringify(driver.driverProtocol, null, 4)
        : undefined
      form.setFieldValue(['deviceConfig', 'requestParam'], protocol)
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
    // 请求参数非空时必须能解析为 JSON 对象（旧实现同校验语义；失败保留输入不关弹窗；
    // 空值原样承载为 undefined→不下发该键，与旧实现「空串直传」的差异仅在前端
    // 未输入时的键缺席，后端 map 形态下两者等价）
    let requestParam: Record<string, unknown> | undefined
    const rawParam = values.deviceConfig.requestParam
    if (rawParam !== undefined && rawParam !== null && rawParam !== '') {
      try {
        const parsed: unknown = JSON.parse(rawParam)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('not an object')
        }
        requestParam = parsed as Record<string, unknown>
      } catch {
        message.warning(t('请求参数JSON格式不正确'))
        return
      }
    }
    // deviceConfig 键集=旧实现 buildSubmitValues 原样（url/requestParam/responseSuccessExpression）
    const deviceConfig: Record<string, unknown> = {
      url: values.deviceConfig.url,
      responseSuccessExpression: values.deviceConfig.responseSuccessExpression,
    }
    if (requestParam !== undefined) {
      deviceConfig.requestParam = requestParam
    }
    setSubmitting(true)
    try {
      if (isEdit && editTarget) {
        // 编辑：回带原 deviceKey 定位（表单无该输入框，旧实现同边界）
        await updateTrafficLight({
          deviceKey: editTarget.deviceKey,
          deviceName: values.deviceName.trim(),
          driverKey: values.driverKey,
          syncWaitResponse: values.syncWaitResponse,
          deviceConfig,
        })
        message.success(t('编辑交通灯成功'))
      } else {
        await addTrafficLight({
          deviceName: values.deviceName.trim(),
          driverKey: values.driverKey,
          syncWaitResponse: values.syncWaitResponse,
          deviceConfig,
        })
        message.success(t('新增交通灯成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error((isEdit ? t('编辑交通灯出错') : t('新增交通灯出错')) + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('编辑交通灯') : t('新增交通灯')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      // 草稿弹窗：关闭不销毁内容（新增草稿保留在页签内存）
      destroyOnHidden={false}
      width={1000}
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
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal/Drawer 内表单既定参数，旧实现同分栏） */}
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
          deviceConfig: {
            url: '',
            requestParam: undefined,
            responseSuccessExpression: '',
          },
          syncWaitResponse: false,
        }}
      >
        <Form.Item
          label={t('交通灯名称')}
          name="deviceName"
          rules={[{ required: true, message: t('请输入交通灯名称') }]}
        >
          {/* 名称上限 64 字符（旧实现同边界；旧版无 showCount 不加） */}
          <Input maxLength={64} placeholder={t('请输入交通灯名称')} />
        </Form.Item>

        <Form.Item
          label={t('设备驱动')}
          name="driverKey"
          rules={[{ required: true, message: t('请选择设备驱动') }]}
        >
          {/* 驱动下拉：label=驱动名称 value=驱动 key（协议定位键）；切换即覆写请求参数 */}
          <Select
            placeholder={t('请选择设备驱动')}
            allowClear
            options={drivers.map((driver) => ({
              label: driver.name ?? driver.key ?? '',
              value: driver.key ?? '',
            }))}
            onChange={handleDriverChange}
          />
        </Form.Item>

        <Form.Item
          label={t('请求地址')}
          name={['deviceConfig', 'url']}
          rules={[{ required: true, message: t('请输入请求地址') }]}
        >
          <Input placeholder={t('请输入请求地址')} />
        </Form.Item>

        <Form.Item
          label={t('请求参数')}
          name={['deviceConfig', 'requestParam']}
        >
          {/* JSON 文本编辑区：选中驱动自动填充该驱动协议模板；提交时真实解析校验 */}
          <Input.TextArea
            placeholder={t('请输入JSON格式请求参数')}
            rows={10}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label={t('响应成功表达式')}
          name={['deviceConfig', 'responseSuccessExpression']}
          rules={[{ required: true, message: t('请输入响应成功表达式') }]}
        >
          <Input placeholder={t('请输入响应成功表达式')} />
        </Form.Item>

        <Form.Item
          label={t('到点通知')}
          name="syncWaitResponse"
          valuePropName="checked"
          rules={[{ required: true, message: t('请选择是否同步等待响应') }]}
        >
          {/* label「到点通知」为旧版表单原样（与 rule 文案的错位为旧版既存事实）；
              Switch 布尔明确两态，默认否（旧实现 initialValue=false 同默认） */}
          <Switch checkedChildren={t('是')} unCheckedChildren={t('否')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
