/**
 * 接入/编辑车辆弹窗（P05）：真实 addVehicle/updateVehicle 接入。
 *
 * 交互与契约要点：
 * - 新增模式（editTarget=null）：草稿保留（A13/DoD 7）——关闭弹窗不清空输入，
 *   草稿留页签内存（Activity 缓存切页不丢），提交成功才清空；显式「清空」入口；
 * - 编辑模式（editTarget 非 null）：打开时按行记录重填（旧实现同语义），
 *   关联上报车辆固定为行 key 且禁用（后端以 key 定位，不可改）；
 * - 字段与校验与旧 VehicleModal 等价：名称/类型/关联上报车辆/调度状态/五个尺寸，
 *   数值 precision 3（米），偏移量可为负（车头为负、车尾为正）；
 * - 未关联上报车辆选项走 getUnRelationSimpleVehicles（弹窗打开时加载，
 *   提交成功后刷新；失败在下拉内呈现状态文本，不设重试按钮）；
 * - 提交防重复（confirmLoading）；失败保留输入，写操作不自动重试。
 */

import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal, Radio, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { addVehicle, updateVehicle } from '@/services/vehicle/vehicle-manage.service'
import { fetchUnrelationSimpleVehicles } from '@/services/vehicle/vehicle-manage.service'
import type { VehicleRecordDto } from '@/services/vehicle/vehicle-manage.service.types'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'
import { toFormParam } from '@/features/vehicle-list/vehicleListOptions'

/** 表单值形状（与 VehicleFormParam 对齐，agvType 允许暂缺由校验兜底） */
interface VehicleFormValues {
  agvName: string
  agvType?: number
  agvKey?: string
  dispatchState: 'ENABLE' | 'DISABLE'
  length: number
  width: number
  loadLength: number
  loadWidth: number
  centerOffset: number
}

interface VehicleFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: VehicleRecordDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表与选项；本组件已自行复位表单） */
  onSucceeded: () => void
}

export function VehicleFormModal({ open, editTarget, onClose, onSucceeded }: VehicleFormModalProps) {
  const { t } = useTranslation('vehicleList')
  const { t: tCommon } = useTranslation('common')
  const { message } = App.useApp()
  const [form] = Form.useForm<VehicleFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）；编辑模式同样保护
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑车辆') : t('添加车辆'))

  // 未关联上报车辆选项：仅新增模式且弹窗打开时加载（编辑时 agvKey 固定禁用，无需选项），
  // 提交成功后关闭再打开会重新查询，删除车辆后的选项变化自然反映
  const unrelations = useStaticOptions<SimpleVehicleDto>(
    (signal) => fetchUnrelationSimpleVehicles({ signal }),
    open && !isEdit,
  )

  // 目标切换语义：编辑目标出现时按行记录重填；编辑目标清除（转新增）时复位干净
  // 基线——编辑值对新增场景不再有效，绝不能残留成「新增草稿」误导提交。
  // 新增模式自身的草稿保留不受影响：新增期间 editTarget 恒为 null，本 effect 不重跑。
  useEffect(() => {
    if (editTarget) {
      form.setFieldsValue(toFormParam(editTarget))
    } else {
      form.resetFields()
      setDirty(false)
    }
  }, [editTarget, form])

  // 有任何输入即视为脏（草稿保留与关页确认的依据）
  const handleValuesChange = useCallback(() => setDirty(true), [])

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
    const values = await form.validateFields()
    if (submitting) return
    setSubmitting(true)
    try {
      const params = {
        agvKey: (values.agvKey ?? '').trim(),
        agvName: values.agvName.trim(),
        agvType: values.agvType,
        length: values.length,
        width: values.width,
        loadLength: values.loadLength,
        loadWidth: values.loadWidth,
        centerOffset: values.centerOffset,
        dispatchState: values.dispatchState,
      }
      if (isEdit) {
        await updateVehicle(params)
        message.success(t('编辑车辆成功'))
      } else {
        await addVehicle(params)
        message.success(t('添加车辆成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error((isEdit ? t('编辑车辆出错') : t('添加车辆出错')) + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** 选项下拉失败的统一呈现：仅状态文本，不设重试按钮（视觉规范） */
  const optionFailed = unrelations.error ? (
    <span style={{ color: 'var(--app-text-secondary, rgba(0, 0, 0, 0.45))', fontSize: 12 }}>
      {tCommon('加载失败')}
    </span>
  ) : undefined

  return (
    <Modal
      title={isEdit ? t('编辑车辆') : t('添加车辆')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      width={560}
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
        initialValues={{ dispatchState: 'ENABLE' }}
      >
        <Form.Item
          label={t('车辆名称')}
          name="agvName"
          rules={[{ required: true, message: t('请输入车辆名称') }]}
        >
          <Input maxLength={64} showCount placeholder={t('请输入车辆名称')} />
        </Form.Item>

        <Form.Item
          label={t('车辆类型')}
          name="agvType"
          rules={[{ required: true, message: t('请选择车辆类型') }]}
        >
          <Select
            placeholder={t('请选择车辆类型')}
            options={[
              { value: 2, label: t('小车') },
              { value: 1, label: t('叉车') },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={t('关联上报车辆')}
          name="agvKey"
          rules={[{ required: true, message: t('请选择关联上报车辆') }]}
        >
          {/* 编辑模式固定行 key（后端以 key 定位），选项仅新增时开放选择 */}
          <Select
            showSearch
            disabled={isEdit}
            placeholder={t('请选择关联上报车辆')}
            loading={unrelations.loading}
            optionFilterProp="label"
            fieldNames={{ label: 'name', value: 'key' }}
            options={unrelations.options ?? []}
            notFoundContent={optionFailed}
          />
        </Form.Item>

        <Form.Item
          label={t('调度状态')}
          name="dispatchState"
          rules={[{ required: true, message: t('请选择调度状态') }]}
        >
          <Radio.Group
            options={[
              { value: 'ENABLE', label: t('启用') },
              { value: 'DISABLE', label: t('禁用') },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={t('长(m)')}
          name="length"
          rules={[{ required: true, message: t('请输入车辆长度') }]}
        >
          <InputNumber min={0} max={100} precision={3} placeholder={t('请输入车辆长度')} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={t('宽(m)')}
          name="width"
          rules={[{ required: true, message: t('请输入车辆宽度') }]}
        >
          <InputNumber min={0} max={100} precision={3} placeholder={t('请输入车辆宽度')} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={t('载货长(m)')}
          name="loadLength"
          rules={[{ required: true, message: t('请输入车辆载货长度') }]}
        >
          <InputNumber min={0} max={100} precision={3} placeholder={t('请输入车辆载货长度')} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={t('载货宽(m)')}
          name="loadWidth"
          rules={[{ required: true, message: t('请输入车辆载货宽度') }]}
        >
          <InputNumber min={0} max={100} precision={3} placeholder={t('请输入车辆载货宽度')} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={t('偏移量(m)')}
          name="centerOffset"
          tooltip={t('车辆实际运动中心距离配置长、宽矩形中心的距离长度，实际运动中心靠近车尾为正数，靠近车头为负数')}
          rules={[{ required: true, message: t('请输入车辆中心偏移量') }]}
        >
          <InputNumber
            min={-100}
            max={100}
            precision={3}
            placeholder={t('车辆中心偏移量 = (车头长 - 车尾长) / 2')}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
