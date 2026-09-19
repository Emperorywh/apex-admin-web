/**
 * 新增/编辑动作分组弹窗（P24 整页重写，旧 ActionGroupModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 单弹窗双模式：editTarget 为 null 时新增（addAgvActionGroup），非空时编辑
 *   （updateAgvActionGroup 按 int64 id 定位整组提交 名称+动作 id 集合——旧实现
 *   getFieldsValue(true) 全量提交同边界，名称不 trim 原样提交）；打开时按模式
 *   回填/清空（P32 教训：依赖 open 触发，仅依赖 editTarget 会在「编辑→取消→
 *   再编辑同一行」时因引用不变跳过回填）；
 * - 两字段校验与旧版逐条一致：动作组名称必填；动作组动作必填（multiple
 *   Select，选项 label=动作描述 value=id，旧 fieldNames 同形态）；
 * - 选项数据：打开时经 useStaticOptions 拉取 getAGVActions 全量（P03 代建共享
 *   选项服务；关闭弹窗不重查，页签存活期内复用）；
 * - 失效动作保留原标识并阻止错误保存（P24 专项，P11 同款纪律）：编辑回显中
 *   已不在选项集合的动作 id（已被删除）合成占位选项保留原标识，不静默剔除；
 *   存在失效项时提交校验直接拦截，要求显式移除后再保存——避免以失效 id 提交
 *   导致后端报错或静默丢关联；
 * - 失败保留输入（旧版失败路径不关弹窗不 resetFields 同语义），写操作不自动
 *   重试；关闭即销毁草稿（destroyOnHidden，旧版 handleCancel resetFields 同
 *   语义；弹窗短生命周期，旧版无切页脏保护，保持等价不新增）。
 */

import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Form, Input, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  addAgvActionGroup,
  updateAgvActionGroup,
} from '@/services/action/agv-action-group-manage.service'
import type { AgvActionGroupRowDto } from '@/services/action/agv-action-group-manage.service.types'
import { fetchAGVActions } from '@/services/action/agv-action.service'
import type { AGVActionDto } from '@/services/action/agv-action.service.types'
import { useStaticOptions } from '@/hooks/useStaticOptions'

/** 表单值形状（与旧实现 AGVActionGroupType 一致；id 由编辑目标显式携带不进表单） */
interface ActionGroupFormValues {
  agvActionGroupName: string
  agvActionIds: number[]
}

interface ActionGroupModalProps {
  open: boolean
  /** 编辑目标行快照（null=新增模式） */
  editTarget: AgvActionGroupRowDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表并关闭弹窗） */
  onSucceeded: () => void
}

export function ActionGroupModal({ open, editTarget, onClose, onSucceeded }: ActionGroupModalProps) {
  const { t } = useTranslation('agvActionGroup')
  const { message } = App.useApp()
  const [form] = Form.useForm<ActionGroupFormValues>()
  // 提交中状态：驱动确认按钮 loading，防止重复提交
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 车辆动作全量选项：弹窗打开时才加载（关闭不重查）
  const actionOptions = useStaticOptions<AGVActionDto>(() => fetchAGVActions(), open)

  // 订阅已选动作集合（Form 值变化驱动重渲染——失效识别/提交拦截随移除实时解除）
  const selectedActionIds: number[] | undefined = Form.useWatch('agvActionIds', form)

  /** 弹窗打开时按模式回填 / 清空表单（旧版同语义，依赖 open 触发） */
  useEffect(() => {
    if (!open) return
    if (editTarget) {
      form.setFieldsValue({
        agvActionGroupName: editTarget.actionGroupName ?? '',
        // 组内动作 id 集合按服务端权威顺序回填（旧实现 agvActions.map(id) 同形态）
        agvActionIds: (editTarget.agvActions ?? [])
          .map((item) => item.id)
          .filter((id): id is number => typeof id === 'number'),
      })
    } else {
      // 新增模式：主动清空，避免上一轮编辑的残留值带入（旧版同语义）
      form.resetFields()
    }
  }, [open, editTarget, form])

  /**
   * 失效动作识别：已选 id 中不在当前选项集合的条目（动作已被删除）。
   * 选项尚未加载完成（loading）时不判定，避免把「还没拿到选项」误报成失效。
   */
  const missingIds = useMemo(() => {
    if (actionOptions.loading || actionOptions.error || actionOptions.options === null) return []
    const known = new Set((actionOptions.options ?? []).map((item) => item.id as number))
    return (selectedActionIds ?? []).filter((id) => !known.has(id))
    // selectedActionIds 经 Form.useWatch 订阅，用户增删选项即时驱动本值重算
  }, [
    actionOptions.options,
    actionOptions.loading,
    actionOptions.error,
    selectedActionIds,
  ])

  /**
   * 动作选项：真实选项 + 失效合成选项——编辑回填中已不在选项集合的 id 合成
   * 占位项保留原标识（裸 id 不猜名称语义），防止 antd Select 对缺失 value 只
   * 显示裸数字而无任何说明（P11 失效合成条目同款纪律）。
   */
  const selectOptions = useMemo(() => {
    const real = (actionOptions.options ?? []).map((item) => ({
      label: String(item.actionDescription ?? ''),
      value: item.id as number,
    }))
    const known = new Set(real.map((item) => item.value))
    const missing = missingIds
      .filter((id) => !known.has(id))
      .map((id) => ({ label: t('动作 #{{id}}（已失效）', { id }), value: id }))
    return [...real, ...missing]
  }, [actionOptions.options, missingIds, t])

  /** 弹窗确认：校验通过后按模式调用新增/更新（旧版 handleOk 同结构） */
  const handleOk = async () => {
    if (submitting) return
    let values: ActionGroupFormValues
    try {
      values = await form.validateFields()
    } catch {
      // 校验失败：antd 已在字段下方呈现错误，无需额外处理
      return
    }
    // 失效动作阻止错误保存（P24 专项）：要求显式移除后再保存（P11 同款句式）
    if (missingIds.length > 0) {
      message.error(
        t('组内 {{count}} 个动作已失效（已被删除），请先移除后再保存', {
          count: missingIds.length,
        }),
      )
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && editTarget) {
        await updateAgvActionGroup({
          id: editTarget.id as number,
          agvActionGroupName: values.agvActionGroupName,
          agvActionIds: values.agvActionIds,
        })
        message.success(t('编辑动作组成功'))
      } else {
        await addAgvActionGroup({
          agvActionGroupName: values.agvActionGroupName,
          agvActionIds: values.agvActionIds,
        })
        message.success(t('新增动作组成功'))
      }
      // 成功才关闭并刷新列表；失败路径保留输入（写操作不自动重试）
      onSucceeded()
    } catch (error) {
      // 失败保留输入；取消（切页/弹窗销毁引发的请求中止）不打错误提示
      if (!isCancelledError(error)) {
        message.error(
          t(isEdit ? '编辑动作组出错：{{msg}}' : '新增动作组出错：{{msg}}', {
            msg: apiErrorMessage(error),
          }),
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('编辑车辆动作分组') : t('新增车辆动作分组')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      // 关闭即销毁草稿（旧版 handleCancel resetFields 同语义，等价迁移）
      destroyOnHidden
      confirmLoading={submitting}
      okText={t('确定')}
      cancelText={t('取消')}
    >
      {/* 失效动作说明（专项验收）：识别失效项 + 明示保存被阻止的解除路径 */}
      {missingIds.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          description={t('组内 {{count}} 个动作已失效（已被删除），请先移除后再保存', {
            count: missingIds.length,
          })}
        />
      ) : null}

      <Form
        form={form}
        // 弹窗内表单参数（AGENTS 第 3 节：labelCol 6 / wrapper 18，登录页同参数；
        // 旧版 8/16 为项目内统一前形态，行为等价）
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
      >
        <Form.Item<ActionGroupFormValues>
          label={t('动作组名称')}
          name="agvActionGroupName"
          rules={[{ required: true, message: t('请输入动作组名称!') }]}
        >
          <Input placeholder={t('请输入动作组名称')} />
        </Form.Item>

        <Form.Item<ActionGroupFormValues>
          label={t('动作组动作')}
          name="agvActionIds"
          rules={[{ required: true, message: t('请选择动作组动作!') }]}
        >
          {/* 多选下拉：label=动作描述 value=id（旧 fieldNames 同形态）；选项加载
              中不误报失效——loading 态 missingIds 恒为空数组 */}
          <Select
            placeholder={t('请选择动作组动作')}
            options={selectOptions}
            mode="multiple"
            loading={actionOptions.loading}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
