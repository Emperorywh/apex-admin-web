/**
 * 新增/编辑载具类型弹窗（P06）：真实 createCarrier/updateCarrier 接入。
 *
 * 交互与契约要点：
 * - 新增模式（editTarget=null）：草稿保留（A13/DoD 7）——关闭弹窗不清空输入，
 *   草稿留页签内存（Activity 缓存切页不丢），提交成功才清空；显式「清空」入口；
 * - 编辑模式（editTarget 非 null）：打开时按行记录重填（旧实现同语义）；
 *   编辑目标清除（转新增）时复位干净基线，编辑值绝不残留误导提交；
 * - 失败留稿（P06 专项验收）：提交失败保留全部输入并提示，写操作不自动重试，
 *   是否调整或放弃由用户显式操作；
 * - 尺寸校验（P06 专项验收）：长度/宽度必填、正数（min=1，旧实现同边界），
 *   单位 mm 为协议原样展示，不添加旧实现没有的 precision/max 限制；
 * - 提交防重复（confirmLoading + submitting 早退）。
 */

import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { addCarrier, updateCarrier } from '@/services/vehicle/carrier.service'
import type { CarrierRecordDto } from '@/services/vehicle/carrier.service.types'

/** 表单值形状（名称/编码字符串 + 长宽毫米数；InputNumber 产出 number|null） */
interface CarrierFormValues {
  carrierName: string
  carrierCode: string
  carrierLength: number
  carrierWidth: number
}

interface CarrierFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: CarrierRecordDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位表单） */
  onSucceeded: () => void
}

export function CarrierFormModal({ open, editTarget, onClose, onSucceeded }: CarrierFormModalProps) {
  const { t } = useTranslation('carrierType')
  const { message } = App.useApp()
  const [form] = Form.useForm<CarrierFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）；编辑模式同样保护
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑载具类型') : t('新增载具类型'))

  // 目标切换语义：编辑目标出现时按行记录重填；编辑目标清除（转新增）时复位
  // 干净基线。新增模式自身的草稿保留不受影响（新增期间 editTarget 恒为 null）。
  useEffect(() => {
    if (editTarget) {
      form.setFieldsValue({
        carrierName: editTarget.carrierName ?? '',
        carrierCode: editTarget.carrierCode ?? '',
        carrierLength: editTarget.carrierLength as number,
        carrierWidth: editTarget.carrierWidth as number,
      })
    } else {
      form.resetFields()
    }
    setDirty(false)
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
      if (isEdit && editTarget) {
        await updateCarrier({
          id: editTarget.id as number,
          carrierName: values.carrierName.trim(),
          carrierCode: values.carrierCode.trim(),
          carrierLength: values.carrierLength,
          carrierWidth: values.carrierWidth,
        })
        message.success(t('编辑载具类型成功'))
      } else {
        await addCarrier({
          carrierName: values.carrierName.trim(),
          carrierCode: values.carrierCode.trim(),
          carrierLength: values.carrierLength,
          carrierWidth: values.carrierWidth,
        })
        message.success(t('添加载具类型成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error((isEdit ? t('编辑载具类型出错') : t('添加载具类型出错')) + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('编辑载具类型') : t('新增载具类型')}
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
        initialValues={{ carrierName: '', carrierCode: '', carrierLength: undefined, carrierWidth: undefined }}
      >
        <Form.Item
          label={t('载具名称')}
          name="carrierName"
          rules={[{ required: true, message: t('请输入载具名称') }]}
        >
          {/* 名称/编码上限 64 字符（旧实现同边界），showCount 同旧形态 */}
          <Input maxLength={64} showCount placeholder={t('请输入载具名称')} />
        </Form.Item>

        <Form.Item
          label={t('载具编码')}
          name="carrierCode"
          rules={[{ required: true, message: t('请输入载具编码') }]}
        >
          <Input maxLength={64} showCount placeholder={t('请输入载具编码')} />
        </Form.Item>

        <Form.Item
          label={t('载具长度(mm)')}
          name="carrierLength"
          rules={[{ required: true, message: t('请输入载具长度') }]}
        >
          {/* 尺寸为毫米整数语义，正数下界 min=1（旧实现同边界）；提交为协议原样数值 */}
          <InputNumber min={1} style={{ width: '100%' }} placeholder={t('请输入载具长度')} />
        </Form.Item>

        <Form.Item
          label={t('载具宽度(mm)')}
          name="carrierWidth"
          rules={[{ required: true, message: t('请输入载具宽度') }]}
        >
          <InputNumber min={1} style={{ width: '100%' }} placeholder={t('请输入载具宽度')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
