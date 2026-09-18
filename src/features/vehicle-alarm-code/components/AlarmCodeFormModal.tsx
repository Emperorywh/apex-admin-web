/**
 * 新增/编辑车辆告警码弹窗（P08）：真实 addVehicleAlarmCode/updateVehicleAlarmCode 接入。
 *
 * 交互与契约要点：
 * - 新增模式（editTarget=null）：草稿保留（A13/DoD 7）——关闭弹窗不清空输入，
 *   草稿留页签内存（Activity 缓存切页不丢），提交成功才清空；显式「清空」入口；
 * - 编辑模式（editTarget 非 null）：打开时按行记录重填（旧实现同语义）；
 *   编辑目标清除（转新增）时复位干净基线，编辑值绝不残留误导提交；
 * - 失败留稿：提交失败保留全部输入并提示，写操作不自动重试，
 *   是否调整或放弃由用户显式操作；
 * - 多语言行（Form.List）：语言/告警描述必填、处理建议选填（旧实现同边界）；
 *   提交按旧行为过滤掉未选语言的残行，已填行整体提交（数组可为空）；
 * - 告警码上限 128 字符（旧实现 maxLength 同边界）；
 * - 提交防重复（confirmLoading + submitting 早退）。
 */

import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Modal, Select } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { addAlarmCode, updateAlarmCode } from '@/services/vehicle/vehicle-alarm-code.service'
import type { AlarmCodeRecord, AlarmCodeRecordDto } from '@/services/vehicle/vehicle-alarm-code.service.types'
import { ALARM_LOCALE_OPTIONS } from '@/features/vehicle-alarm-code/constants'

/** 表单值形状（多语言行为 Form.List 受控数组；行内字段与协议 DTO 同名） */
interface AlarmCodeFormValues {
  alarmCode: string
  alarmCodeRecords?: Array<Pick<AlarmCodeRecordDto, 'locale' | 'desc' | 'hint'>>
}

interface AlarmCodeFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: AlarmCodeRecord | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位表单） */
  onSucceeded: () => void
}

export function AlarmCodeFormModal({ open, editTarget, onClose, onSucceeded }: AlarmCodeFormModalProps) {
  const { t } = useTranslation('vehicleAlarmCode')
  const { message } = App.useApp()
  const [form] = Form.useForm<AlarmCodeFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入（含行增删）即登记到页签（关页/刷新统一确认、LRU 豁免）
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑车辆告警码') : t('新增车辆告警码'))

  // 目标切换语义：编辑目标出现时按行记录重填；编辑目标清除（转新增）时复位
  // 干净基线。新增模式自身的草稿保留不受影响（新增期间 editTarget 恒为 null）。
  useEffect(() => {
    if (editTarget) {
      form.setFieldsValue({
        alarmCode: editTarget.alarmCode ?? '',
        alarmCodeRecords: (editTarget.alarmCodeRecords ?? []).map((item) => ({
          locale: item.locale,
          desc: item.desc,
          hint: item.hint,
        })),
      })
    } else {
      form.resetFields()
    }
    setDirty(false)
  }, [editTarget, form])

  // 有任何输入即视为脏（Form.List 增删行不一定触发 onValuesChange，显式补标记）
  const handleValuesChange = useCallback(() => setDirty(true), [])
  const markDirty = useCallback(() => setDirty(true), [])

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
      // 多语言记录整体选填，但已添加的行经校验后 locale/desc/hint 均已填写；
      // 过滤掉 locale 为空的残行（旧行为兜底同款），空行集提交空数组
      const records = (values.alarmCodeRecords ?? []).filter((item) => !!item?.locale)
      if (isEdit && editTarget) {
        await updateAlarmCode({
          id: editTarget.id as number,
          alarmCode: values.alarmCode.trim(),
          alarmCodeRecords: records,
        })
        message.success(t('更新车辆告警码成功'))
      } else {
        await addAlarmCode({
          alarmCode: values.alarmCode.trim(),
          alarmCodeRecords: records,
        })
        message.success(t('创建车辆告警码成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        const reason = t(isEdit ? '更新车辆告警码出错：{{msg}}' : '创建车辆告警码出错：{{msg}}', {
          msg: apiErrorMessage(error),
        })
        message.error(reason)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('编辑车辆告警码') : t('新增车辆告警码')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      // 草稿弹窗：关闭不销毁内容（新增草稿保留在页签内存）
      destroyOnHidden={false}
      width={800}
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
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal/Drawer 内表单既定参数）；
          多语言卡片内嵌套行以固定 px 标签宽对齐（span 随嵌套容器变窄，不适用） */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={handleValuesChange}
        initialValues={{ alarmCode: '', alarmCodeRecords: [] }}
      >
        <Form.Item
          label={t('告警码')}
          name="alarmCode"
          rules={[{ required: true, message: t('请输入告警码') }]}
        >
          {/* 告警码上限 128 字符（旧实现同边界） */}
          <Input maxLength={128} placeholder={t('请输入告警码')} />
        </Form.Item>

        <Form.Item label={t('多语言描述')}>
          <Form.List name="alarmCodeRecords">
            {(fields, { add, remove }) => (
              <>
                {/* 行容器纵向排布；空列表时仅渲染「添加」按钮 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                  {fields.map(({ key, name }) => (
                    // 单条多语言记录：语言(身份)+删除按钮一行，下方描述/建议两行
                    <div
                      key={key}
                      style={{
                        border: '1px solid var(--apex-border, #d9d9d9)',
                        borderRadius: 8,
                        padding: '8px 12px 0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Form.Item
                          label={t('语言')}
                          name={[name, 'locale']}
                          rules={[{ required: true, message: t('请选择语言') }]}
                          labelCol={{ flex: '0 0 96px' }}
                          wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}
                          style={{ flex: 1, marginBottom: 12 }}
                        >
                          <Select
                            placeholder={t('请选择语言')}
                            allowClear
                            options={ALARM_LOCALE_OPTIONS}
                          />
                        </Form.Item>
                        {/* 删除当前记录：图标按钮（旧实现为图标点击，语义不变） */}
                        <Button
                          type="text"
                          danger
                          icon={<Trash2 size={16} />}
                          title={t('删除该语言')}
                          onClick={() => {
                            remove(name)
                            markDirty()
                          }}
                        />
                      </div>
                      <Form.Item
                        label={t('告警描述')}
                        name={[name, 'desc']}
                        rules={[{ required: true, message: t('请输入告警描述') }]}
                        labelCol={{ flex: '0 0 96px' }}
                        wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}
                      >
                        <Input.TextArea
                          placeholder={t('请输入告警描述')}
                          autoSize={{ minRows: 2, maxRows: 6 }}
                        />
                      </Form.Item>
                      <Form.Item
                        label={t('处理建议')}
                        name={[name, 'hint']}
                        labelCol={{ flex: '0 0 96px' }}
                        wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}
                      >
                        <Input.TextArea
                          placeholder={t('请输入处理建议（选填）')}
                          autoSize={{ minRows: 2, maxRows: 6 }}
                        />
                      </Form.Item>
                    </div>
                  ))}
                </div>
                <Button type="dashed" block icon={<Plus size={14} />} onClick={() => { add(); markDirty() }}>
                  {t('添加多语言描述')}
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  )
}
