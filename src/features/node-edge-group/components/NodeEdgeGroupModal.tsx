/**
 * 新增/编辑多地图点边组合弹窗（P11 整页重写，旧 PointEdgeCombinationModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 双模式：新增（editTarget=null）/编辑（按行记录重填；updateSystemNodeEdgeGroup
 *   按 int64 主键 systemNodeEdgeGroupId 定位、mapNodeEdgeGroupIds 整体替换——
 *   旧实现同边界：编辑时名称与点边组合集合均可改，系统 key 不可改不提交）；
 * - 点/边/地图组合标识与顺序按真实契约提交：mapNodeEdgeGroupIds 为 string id
 *   数组，顺序即用户在穿梭框中的添加顺序，原样提交不做重排（协议无排序字段，
 *   顺序语义由数组顺序承载）；
 * - 失效关联可识别并阻止错误保存（P11 专项验收，较 P04 更严）：编辑回显中已选
 *   点边组合 id 不在 getAllSimpleNodeEdgeGroups 当前集合（组合在地图编辑侧被删除
 *   或当前账号不可见）时，合成条目保留原名称标识并标注不可用（不静默替换、
 *   不静默移除）；存在失效项时提交校验直接拦截，要求显式移除后再保存——
 *   避免以失效 id 提交导致后端报错或静默丢关联；
 * - 选择与移动分离（「选择取消不污染草稿」）：穿梭框勾选态（selectedKeys）与
 *   已选集合（targetKeys）分离受控，勾选后取消不改变已选集合；取消按钮关闭
 *   弹窗保留草稿（页签内存），丢弃路径是显式「清空」按钮；
 * - 草稿保留（A13/DoD 7）：关闭弹窗不清空输入，失败留稿；写操作不自动重试；
 *   useTabDirtyGuard 登记脏页签；提交防重复（submitting 早退 + 按钮 loading）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Spin, Transfer } from 'antd'
import type { TransferProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  createSystemNodeEdgeGroup,
  fetchAllSimpleNodeEdgeGroups,
  updateSystemNodeEdgeGroup,
} from '@/services/node-edge-group/node-edge-group.service'
import type {
  SimpleNodeEdgeGroupOptionDto,
  SystemNodeEdgeGroupDto,
} from '@/services/node-edge-group/node-edge-group.service.types'

/** 穿梭框条目：真实选项与失效合成条目共用形状（title 即展示名） */
interface NodeEdgeGroupItem {
  key: string
  title: string
}

/** 表单值形状（字段名与协议 DTO 同名；已选集合经受控 targetKeys 镜像） */
interface NodeEdgeGroupFormValues {
  systemNodeEdgeGroupName: string
  mapNodeEdgeGroupIds?: string[]
}

interface NodeEdgeGroupModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: SystemNodeEdgeGroupDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位草稿） */
  onSucceeded: () => void
}

export function NodeEdgeGroupModal({
  open,
  editTarget,
  onClose,
  onSucceeded,
}: NodeEdgeGroupModalProps) {
  const { t } = useTranslation('nodeEdgeGroup')
  const { t: tCommon } = useTranslation('common')
  const { message } = App.useApp()
  const [form] = Form.useForm<NodeEdgeGroupFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 穿梭框选中态（受控）：targetKeys 即表单 mapNodeEdgeGroupIds 的镜像（保持
  // 用户添加顺序原样提交），selectedKeys 为两侧条目的勾选态（与 targetKeys
  // 分离，勾选后取消不污染已选集合）
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑多地图点边组合') : t('创建多地图点边组合'))

  // 点边组合选项（页面私有契约 getAllSimpleNodeEdgeGroups）：仅弹窗打开时加载；
  // 提交成功后关闭再打开自然重查，地图编辑侧的增删随之反映
  const options = useStaticOptions<SimpleNodeEdgeGroupOptionDto>(
    (signal) => fetchAllSimpleNodeEdgeGroups({ signal }),
    open,
  )

  // 目标切换语义：编辑目标出现时按行记录重填（点边组合 id 从明细嵌套结构
  // nodeEdgeGroups[].nodeEdgeGroup.id 提取，旧实现同口径）；编辑目标清除
  // （转新增）时复位干净基线——编辑值对新增场景不再有效，绝不能残留误导提交。
  // 新增模式自身的草稿保留不受影响（新增期间 editTarget 恒为 null，本 effect 不重跑）。
  useEffect(() => {
    if (editTarget) {
      const ids =
        editTarget.nodeEdgeGroups
          ?.map((item) => item.nodeEdgeGroup?.id ?? '')
          .filter((id) => id !== '') ?? []
      form.setFieldsValue({
        systemNodeEdgeGroupName: editTarget.nodeEdgeGroupName ?? '',
        mapNodeEdgeGroupIds: ids,
      })
      setTargetKeys(ids)
    } else {
      form.resetFields()
      setTargetKeys([])
    }
    setSelectedKeys([])
    setDirty(false)
  }, [editTarget, form])

  // 有任何输入即视为脏（草稿保留与关页确认的依据）；穿梭框移动与名称输入都会触发
  const handleValuesChange = useCallback(() => setDirty(true), [])

  /** 清空草稿：显式用户动作；提交成功后也走这里复位到干净基线 */
  const handleResetDraft = useCallback(() => {
    form.resetFields()
    setTargetKeys([])
    setSelectedKeys([])
    setDirty(false)
  }, [form])

  const handleClose = useCallback(() => {
    // 关闭保留草稿（DoD 7）；丢弃路径是显式「清空」按钮
    onClose()
  }, [onClose])

  /**
   * 失效关联识别：已选 id 中不在当前选项集合的条目（组合被删除或当前不可见）。
   * 选项尚未加载完成（loading）时不判定，避免把「还没拿到选项」误报成失效。
   */
  const missingIds = useMemo(() => {
    if (options.loading || options.error || options.options === null) return []
    const known = new Set((options.options ?? []).map((item) => item.id as string))
    return targetKeys.filter((id) => !known.has(id))
  }, [options.options, options.loading, options.error, targetKeys])

  /** 提交：编辑按 id 定位整体替换；创建提交名称与已选集合（协议原样）。
   * 存在失效关联时直接拦截（阻止错误保存），要求显式移除后再保存。 */
  const handleOk = async () => {
    const values = await form.validateFields()
    if (submitting) return
    if (missingIds.length > 0) {
      message.error(
        t('组合内 {{count}} 个点边组合已失效，请先在列表中移除后再保存', {
          count: missingIds.length,
        }),
      )
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && editTarget) {
        await updateSystemNodeEdgeGroup({
          systemNodeEdgeGroupId: editTarget.id as number,
          systemNodeEdgeGroupName: values.systemNodeEdgeGroupName.trim(),
          mapNodeEdgeGroupIds: targetKeys,
        })
        message.success(t('更新多地图点边组合成功'))
      } else {
        await createSystemNodeEdgeGroup({
          systemNodeEdgeGroupName: values.systemNodeEdgeGroupName.trim(),
          mapNodeEdgeGroupIds: targetKeys,
        })
        message.success(t('创建多地图点边组合成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        const reason = t(
          isEdit ? '更新多地图点边组合出错：{{msg}}' : '创建多地图点边组合出错：{{msg}}',
          { msg: apiErrorMessage(error) },
        )
        message.error(reason)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 穿梭框数据源 = 真实选项 + 失效合成条目：编辑回填中已不在选项集合的 id
  // 合成占位条目保留原名称标识（名称缺失退回裸 id），防止 antd Transfer 对
  // 缺失 key 只显示裸 key 而无任何说明（不猜名称语义）
  const transferDataSource = useMemo<NodeEdgeGroupItem[]>(() => {
    const realItems: NodeEdgeGroupItem[] = (options.options ?? []).map((item) => ({
      key: item.id as string,
      title: String(item.name ?? item.id ?? ''),
    }))
    const knownTitles = new Map(
      (editTarget?.nodeEdgeGroups ?? [])
        .map((item) => [item.nodeEdgeGroup?.id, item.nodeEdgeGroup?.name] as const)
        .filter(([id]) => typeof id === 'string' && id !== ''),
    )
    const missingItems: NodeEdgeGroupItem[] = missingIds.map((id) => ({
      key: id,
      title: String(knownTitles.get(id) ?? id),
    }))
    return [...realItems, ...missingItems]
  }, [options.options, missingIds, editTarget])

  /** 穿梭框条目渲染：失效合成条目在原名称后附不可用说明（P04 同款呈现） */
  const renderItem: TransferProps<NodeEdgeGroupItem>['render'] = (item) => {
    const isMissing = !(options.options ?? []).some((option) => option.id === item.key)
    return isMissing ? `${item.title}（${t('已不可用')}）` : item.title
  }

  /** 穿梭框移动：同步表单值（保持用户添加顺序）；Key 收敛为 string */
  const handleTransferChange: TransferProps<NodeEdgeGroupItem>['onChange'] = (
    nextTargetKeys,
  ) => {
    const keys = nextTargetKeys.map(String)
    setTargetKeys(keys)
    form.setFieldValue('mapNodeEdgeGroupIds', keys)
    setDirty(true)
  }

  /** 两侧条目勾选态：勾选不等于移动，单独受控防误移（取消勾选不污染已选集合） */
  const handleSelectChange: TransferProps<NodeEdgeGroupItem>['onSelectChange'] = (
    sourceSelectedKeys,
    targetSelectedKeys,
  ) => {
    setSelectedKeys([...sourceSelectedKeys.map(String), ...targetSelectedKeys.map(String)])
  }

  /** 穿梭框搜索：本地过滤（旧实现同语义，按展示名匹配） */
  const filterOption = (inputValue: string, item: NodeEdgeGroupItem) => {
    return item.title.toLowerCase().includes(inputValue.toLowerCase())
  }

  /** 穿梭框空态三态呈现：加载中转圈 / 失败状态文本（无重试按钮）/ 默认空文案 */
  const transferNotFound = options.loading ? (
    <Spin size="small" />
  ) : options.error ? (
    <span style={{ color: 'var(--app-text-secondary, rgba(0, 0, 0, 0.45))', fontSize: 12 }}>
      {tCommon('加载失败')}
    </span>
  ) : undefined

  return (
    <Modal
      title={isEdit ? t('编辑多地图点边组合') : t('创建多地图点边组合')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      width={1150}
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
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal 内表单既定参数） */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={handleValuesChange}
        initialValues={{ systemNodeEdgeGroupName: '', mapNodeEdgeGroupIds: [] }}
      >
        <Form.Item
          label={t('组合名称')}
          name="systemNodeEdgeGroupName"
          rules={[{ required: true, message: t('请输入组合名称') }]}
        >
          {/* 名称上限 64 字（旧实现 maxLength 同边界） */}
          <Input maxLength={64} showCount placeholder={t('请输入组合名称')} allowClear />
        </Form.Item>

        {/* mapNodeEdgeGroupIds 实际值以受控 targetKeys 为准（穿梭框移动时同步，
            顺序即添加顺序原样提交）；表单字段承担「已选至少一个」校验与脏标记 */}
        <Form.Item
          label={t('点边组合')}
          name="mapNodeEdgeGroupIds"
          rules={[
            { required: true, message: t('请选择点边组合') },
            {
              validator: (_, value: string[] | undefined) =>
                !value || value.length < 1
                  ? Promise.reject(new Error(t('至少选择一个点边组合')))
                  : Promise.resolve(),
            },
          ]}
        >
          <Transfer<NodeEdgeGroupItem>
            dataSource={transferDataSource}
            render={renderItem}
            targetKeys={targetKeys}
            selectedKeys={selectedKeys}
            onChange={handleTransferChange}
            onSelectChange={handleSelectChange}
            filterOption={filterOption}
            showSearch={{ placeholder: t('请输入点边组合名称') }}
            titles={[t('可选点边组合'), t('已选点边组合')]}
            actions={[t('加入'), t('移除')]}
            locale={{ notFoundContent: transferNotFound }}
            styles={{ section: { width: 380, height: 400 } }}
          />
        </Form.Item>
      </Form>

      {/* 失效关联说明（专项验收）：识别失效项 + 明示保存被阻止的解除路径 */}
      {missingIds.length > 0 ? (
        <span style={{ color: 'var(--app-warning-color, #d46b08)', fontSize: 12 }}>
          {t(
            '已选 {{count}} 个点边组合已删除或当前不可见，已保留原标识；保存被暂停，移除后才能保存',
            { count: missingIds.length },
          )}
        </span>
      ) : null}
    </Modal>
  )
}
