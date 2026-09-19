/**
 * 新增/编辑车辆动作弹窗（P23 整页重写，旧 ActionModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 双模式：新增（editTarget=null）/编辑（按行记录重填；updateAgvAction 按
 *   int64 主键 id 定位、表单字段整体提交——旧实现 getFieldsValue(true) 全量
 *   提交同边界）；
 * - 表单四字段（旧实现逐项一致）：动作类型（必填）/动作描述（必填）/阻塞类型
 *   （必填，NONE/SOFT/HARD，allowClear）/动作参数集合（Form.List 行内
 *   动作名+动作值+行删除图标，底部「添加动作参数」虚线按钮）；
 * - 未知枚举不丢失（P23 专项验收）：编辑回显的 blockingType 不在枚举集内时，
 *   原值并入下拉选项（label=value 原样），保存原值回传，不静默改写；
 * - 参数 value 非字符串不丢失（P23 专项验收）：历史数据的 value 可能为数字/
 *   数组/对象（OpenAPI 声明 object），回显仅做显示转换（JSON 文本），表单
 *   状态保留原值——用户未改动的行提交时携带原始 value，改动后为新输入文本
 *   （旧实现 Input 受控同语义，仅修复非字符串显示）；
 * - 失败留稿（A13/DoD 7）：关闭弹窗不清空输入，提交失败输入保留；
 *   useTabDirtyGuard 登记脏页签；提交防重复（submitting 早退 + 按钮 loading）；
 *   显式「清空」按钮为唯一丢弃草稿路径（B3 样板升级形态，P22 同款）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Col, Form, Input, Modal, Row, Select } from 'antd'
import { CircleMinus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { addAgvAction, updateAgvAction } from '@/services/action/agv-action-manage.service'
import type {
  AgvActionParameterDto,
  AgvActionRowDto,
} from '@/services/action/agv-action-manage.service.types'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { toValueDisplayText } from '@/utils/display/valueDisplay'

/** 表单值形状（与旧实现 AGVActionType 一致；id 由编辑目标显式携带不进表单） */
interface ActionFormValues {
  actionType: string
  actionDescription: string
  blockingType?: string
  actionParameters?: AgvActionParameterDto[]
}

/** 阻塞类型既定枚举（OpenAPI blockingType enum；label=value 原值，旧实现同款） */
const BLOCKING_OPTIONS = [
  { label: 'NONE', value: 'NONE' },
  { label: 'SOFT', value: 'SOFT' },
  { label: 'HARD', value: 'HARD' },
]

/** 参数 value 的显示文本（仅用于 Input 展示；表单状态保留原值不转换） */
const toDisplayValue = toValueDisplayText

interface ActionFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: AgvActionRowDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位草稿） */
  onSucceeded: () => void
}

export function ActionFormModal({ open, editTarget, onClose, onSucceeded }: ActionFormModalProps) {
  const { t } = useTranslation('agvAction')
  const { message } = App.useApp()
  const [form] = Form.useForm<ActionFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑动作') : t('新增动作'))

  /** 有任何输入即视为脏（四字段与参数行统一走这里） */
  const markDirty = useCallback(() => setDirty(true), [])

  /**
   * 阻塞类型选项：既定枚举 + 编辑回显的未知原值并入（P23 专项「已有动作参数
   * 不因未知枚举丢失」——选项缺失会让 antd Select 把 value 显示成裸值且提交
   * 后无法再次回显，并入后回显/保存均为原值）。
   */
  const blockingOptions = useMemo(() => {
    const value = editTarget?.blockingType
    if (!value || BLOCKING_OPTIONS.some((option) => option.value === value)) {
      return BLOCKING_OPTIONS
    }
    return [...BLOCKING_OPTIONS, { label: value, value }]
  }, [editTarget])

  /** 编辑态回填 / 新增态复位（编辑目标出现时重填；转新增时复位干净基线） */
  useEffect(() => {
    if (!open) return
    if (editTarget) {
      form.setFieldsValue({
        actionType: editTarget.actionType ?? '',
        actionDescription: editTarget.actionDescription ?? '',
        blockingType: editTarget.blockingType,
        actionParameters: (editTarget.actionParameters ?? []).map((item) => ({
          key: item.key ?? '',
          // 非字符串 value 原值进表单状态（显示经 getValueProps 转换，不丢原值）
          value: item.value,
        })),
      })
    } else {
      form.resetFields()
    }
    setDirty(false)
  }, [open, editTarget, form])

  /** 提交：新增四字段；编辑按 id 定位整体提交（校验链与旧实现一致：必填三项
   * 由表单 rules 拦截，参数行内动作名/动作值逐行必填） */
  const handleOk = async () => {
    if (submitting) return
    let values: ActionFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const payload: {
      id?: number
      actionType: string
      actionDescription: string
      blockingType?: string
      actionParameters?: AgvActionParameterDto[]
    } = {
      actionType: values.actionType,
      actionDescription: values.actionDescription,
      blockingType: values.blockingType,
      actionParameters: values.actionParameters ?? [],
    }
    if (isEdit && editTarget) {
      payload.id = editTarget.id as number
    }
    setSubmitting(true)
    try {
      if (isEdit && editTarget) {
        await updateAgvAction(payload)
        message.success(t('编辑动作成功'))
      } else {
        await addAgvAction(payload)
        message.success(t('添加动作成功'))
      }
      // 成功才复位并刷新列表；失败路径保留输入（写操作不自动重试）
      form.resetFields()
      setDirty(false)
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        const reason = t(isEdit ? '编辑动作出错：{{msg}}' : '添加动作出错：{{msg}}', {
          msg: apiErrorMessage(error),
        })
        message.error(reason)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = useCallback(() => {
    // 关闭保留草稿（DoD 7）；丢弃路径是显式「清空」按钮
    onClose()
  }, [onClose])

  /** 清空草稿：显式用户动作（复位到干净基线） */
  const handleResetDraft = useCallback(() => {
    form.resetFields()
    setDirty(false)
  }, [form])

  return (
    <Modal
      title={isEdit ? t('编辑动作') : t('新增动作')}
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
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal 内表单既定参数，旧实现同款） */}
      <Form
        name="agv-action-form"
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={markDirty}
      >
        <Form.Item<ActionFormValues>
          label={t('动作类型')}
          name="actionType"
          rules={[{ required: true, message: t('请输入动作类型!') }]}
        >
          <Input placeholder={t('请输入动作类型')} />
        </Form.Item>

        <Form.Item<ActionFormValues>
          label={t('动作描述')}
          name="actionDescription"
          rules={[{ required: true, message: t('请输入动作描述!') }]}
        >
          <Input placeholder={t('请输入动作描述')} />
        </Form.Item>

        <Form.Item<ActionFormValues>
          label={t('阻塞类型')}
          name="blockingType"
          rules={[{ required: true, message: t('请选择阻塞类型!') }]}
        >
          <Select allowClear placeholder={t('请选择阻塞类型')} options={blockingOptions} />
        </Form.Item>

        {/* 动作参数集合：Form.List 直接置于 Form 下（旧实现同结构——参数行
            占表单全宽，无「动作参数」标签列）；行内 动作名/动作值 + 行删除图标
            （Row 11/11/2 布局逐项一致；无参数时不显示行，仅保留添加按钮） */}
        <Form.List name="actionParameters">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Row key={key}>
                  <Col span={11}>
                    <Form.Item<AgvActionParameterDto>
                      {...restField}
                      name={[name, 'key']}
                      rules={[{ required: true, message: t('请输入动作名') }]}
                    >
                      <Input placeholder={t('动作名')} />
                    </Form.Item>
                  </Col>
                  <Col span={11}>
                    <Form.Item<AgvActionParameterDto>
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true, message: t('请输入动作值') }]}
                      // 非字符串 value 只转显示：用户改动即存新文本，未改动
                      // 保留原始值（对象/数组/数字）随表单原样提交
                      getValueProps={(value) => ({ value: toDisplayValue(value) })}
                    >
                      <Input placeholder={t('动作值')} />
                    </Form.Item>
                  </Col>
                  <Col span={2} style={{ textAlign: 'center' }}>
                    {/* 行删除（旧实现 MinusCircleOutlined 同语义） */}
                    <CircleMinus
                      size={16}
                      style={{ cursor: 'pointer', marginTop: 8 }}
                      onClick={() => remove(name)}
                    />
                  </Col>
                </Row>
              ))}
              <Form.Item noStyle>
                <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>
                  {t('添加动作参数')}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  )
}
