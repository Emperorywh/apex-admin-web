/**
 * 新增/编辑车辆分组弹窗（P04）：真实 addVehicleGroup/updateVehicleGroup 接入。
 *
 * 交互与契约要点：
 * - 新增模式（editTarget=null）：草稿保留（A13/DoD 7）——关闭弹窗不清空输入，
 *   草稿留页签内存（Activity 缓存切页不丢），提交成功才清空；显式「清空」入口；
 * - 编辑模式（editTarget 非 null）：打开时按行记录重填（旧实现同语义）——
 *   组内车辆回填沿用旧实现口径消费 simpleAGVs 的 key 集合（缺失时回退
 *   agvKeys 契约超集）；编辑目标清除（转新增）时复位干净基线；
 * - 失效关联（P04 专项验收）：组内车辆 key 已不在 getSimpleVehicles 返回
 *   （车辆被删除或当前账号不可见）时，合成条目保留原标识并标注「已不可用」，
 *   不静默替换、不静默移除——保存按原样提交，是否解除由用户显式操作；
 * - 车辆选项走共享契约 getSimpleVehicles（contracts.md 第 5 节唯一 operation），
 *   仅弹窗打开时加载；失败在穿梭框空态与下方呈现状态文本，不设重试按钮；
 * - 提交防重复（confirmLoading）；失败保留输入，写操作不自动重试。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Spin, Transfer } from 'antd'
import type { TransferProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import { addVehicleGroup, updateVehicleGroup } from '@/services/vehicle/vehicle-group.service'
import type { VehicleGroupRecordDto } from '@/services/vehicle/vehicle-group.service.types'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'

/** 穿梭框条目：真实选项与失效合成条目共用形状（title 即展示名） */
interface GroupVehicleItem {
  key: string
  title: string
}

interface GroupFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: VehicleGroupRecordDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位表单） */
  onSucceeded: () => void
}

export function GroupFormModal({ open, editTarget, onClose, onSucceeded }: GroupFormModalProps) {
  const { t } = useTranslation('vehicleGroup')
  const { t: tCommon } = useTranslation('common')
  const { message } = App.useApp()
  const [form] = Form.useForm<{ groupName: string; vehicleKeys: string[] }>()
  const [submitting, setSubmitting] = useState(false)
  const isEdit = editTarget !== null

  // 穿梭框选中态（受控）：targetKeys 即表单 vehicleKeys 的镜像，selectedKeys 为
  // 两侧条目的勾选态（与 targetKeys 分离，避免误把勾选当移动）
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）；编辑模式同样保护
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑车辆分组') : t('新增车辆分组'))

  // 车辆选项（共享契约）：仅弹窗打开时加载，提交成功后关闭再打开自然重查，
  // 车辆接入/删除后的集合变化随之反映
  const vehicles = useStaticOptions<SimpleVehicleDto>(
    (signal) => fetchSimpleVehicles({ signal }),
    open,
  )

  // 目标切换语义：编辑目标出现时按行记录重填；编辑目标清除（转新增）时复位
  // 干净基线——编辑值对新增场景不再有效，绝不能残留误导提交。新增模式自身的
  // 草稿保留不受影响（新增期间 editTarget 恒为 null，本 effect 不重跑）。
  useEffect(() => {
    if (editTarget) {
      const keys =
        editTarget.simpleAGVs
          ?.map((agv) => agv.key ?? '')
          .filter((key) => key !== '') ??
        editTarget.agvKeys ??
        []
      form.setFieldsValue({ groupName: editTarget.agvGroupName ?? '', vehicleKeys: keys })
      setTargetKeys(keys)
    } else {
      form.resetFields()
      setTargetKeys([])
    }
    setSelectedKeys([])
    setDirty(false)
  }, [editTarget, form])

  // 有任何输入即视为脏（草稿保留与关页确认的依据）；穿梭框移动与名称输入都会触发
  const handleValuesChange = useCallback(() => setDirty(true), [])

  /** 清空表单：显式用户动作；提交成功后也走这里复位干净基线 */
  const handleResetDraft = () => {
    form.resetFields()
    setTargetKeys([])
    setSelectedKeys([])
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
        await updateVehicleGroup({
          groupKey: editTarget.agvGroupKey ?? '',
          groupName: values.groupName.trim(),
          vehicleKeys: targetKeys,
        })
        message.success(t('更新车辆组成功'))
      } else {
        await addVehicleGroup({
          groupName: values.groupName.trim(),
          vehicleKeys: targetKeys,
        })
        message.success(t('添加车辆组成功'))
      }
      // 成功才清空草稿并复位；失败路径保留输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error((isEdit ? t('更新车辆组出错') : t('添加车辆组出错')) + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 穿梭框数据源 = 真实车辆选项 + 失效合成条目：编辑回填中已不在选项集合的 key
  // （车辆被删除/当前账号不可见）合成占位条目保留原标识，防止 antd Transfer 对
  // 缺失 key 只显示裸 key 而无任何说明
  const transferDataSource = useMemo<GroupVehicleItem[]>(() => {
    const realItems: GroupVehicleItem[] = (vehicles.options ?? []).map((vehicle) => ({
      // 共享选项服务已过滤空 key；类型层仍是可选字段，这里统一收敛为 string
      key: String(vehicle.key),
      title: String(vehicle.name ?? vehicle.key ?? ''),
    }))
    const knownKeys = new Set(realItems.map((item) => item.key))
    const missingKeys = targetKeys.filter((key) => !knownKeys.has(key))
    const missingItems: GroupVehicleItem[] = missingKeys.map((key) => ({ key, title: key }))
    return [...realItems, ...missingItems]
  }, [vehicles.options, targetKeys])

  // 失效条目数量（保留原标识的用户提示依据）
  const missingCount = useMemo(() => {
    const knownKeys = new Set((vehicles.options ?? []).map((vehicle) => String(vehicle.key)))
    return targetKeys.filter((key) => !knownKeys.has(key)).length
  }, [vehicles.options, targetKeys])

  /** 穿梭框条目渲染：失效合成条目在原标识后附不可用说明（不猜名称语义） */
  const renderItem: TransferProps<GroupVehicleItem>['render'] = (item) => {
    const isMissing = (vehicles.options ?? []).every((vehicle) => String(vehicle.key) !== item.key)
    return isMissing ? `${item.title}（${t('已不可用')}）` : item.title
  }

  /** 穿梭框移动：同步表单值（vehicleKeys 交给校验与提交读取）；Key 收敛为 string */
  const handleTransferChange: TransferProps<GroupVehicleItem>['onChange'] = (nextTargetKeys) => {
    const keys = nextTargetKeys.map(String)
    setTargetKeys(keys)
    form.setFieldValue('vehicleKeys', keys)
    setDirty(true)
  }

  /** 两侧条目勾选态：勾选不等于移动，单独受控防误移；Key 收敛为 string */
  const handleSelectChange: TransferProps<GroupVehicleItem>['onSelectChange'] = (
    sourceSelectedKeys,
    targetSelectedKeys,
  ) => {
    setSelectedKeys([...sourceSelectedKeys.map(String), ...targetSelectedKeys.map(String)])
  }

  /** 穿梭框搜索：本地过滤（旧实现同语义，按展示名匹配） */
  const filterOption = (inputValue: string, item: GroupVehicleItem) => {
    return item.title.toLowerCase().includes(inputValue.toLowerCase())
  }

  /** 穿梭框空态三态呈现：加载中转圈 / 失败状态文本（无重试按钮）/ 默认空文案 */
  const transferNotFound = vehicles.loading ? (
    <Spin size="small" />
  ) : vehicles.error ? (
    <span style={{ color: 'var(--app-text-secondary, rgba(0, 0, 0, 0.45))', fontSize: 12 }}>
      {tCommon('加载失败')}
    </span>
  ) : undefined

  return (
    <Modal
      title={isEdit ? t('编辑车辆分组') : t('新增车辆分组')}
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
      {/* 标签横排居左（视觉规范）：6/18 分栏（Modal/Drawer 内表单既定参数） */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={handleValuesChange}
        initialValues={{ groupName: '', vehicleKeys: [] }}
      >
        <Form.Item
          label={t('分组名称')}
          name="groupName"
          rules={[{ required: true, message: t('请输入分组名称') }]}
        >
          <Input maxLength={64} showCount placeholder={t('请输入分组名称')} />
        </Form.Item>

        {/* vehicleKeys 实际值以受控 targetKeys 为准（穿梭框移动时同步），
            表单字段仅承担「已输入」的脏标记语义，不设必填（旧实现同语义） */}
        <Form.Item label={t('选择车辆')} name="vehicleKeys">
          <Transfer<GroupVehicleItem>
            dataSource={transferDataSource}
            render={renderItem}
            targetKeys={targetKeys}
            selectedKeys={selectedKeys}
            onChange={handleTransferChange}
            onSelectChange={handleSelectChange}
            filterOption={filterOption}
            showSearch={{ placeholder: t('根据名称搜索') }}
            titles={[t('车辆列表'), t('已添加')]}
            actions={[t('添加'), t('撤回')]}
            locale={{ notFoundContent: transferNotFound }}
            styles={{ section: { width: 330, height: 400 } }}
          />
        </Form.Item>
      </Form>

      {/* 失效关联说明（专项验收）：保留原标识 + 明示保存语义，是否解除由用户决定 */}
      {missingCount > 0 ? (
        <span style={{ color: 'var(--app-warning-color, #d46b08)', fontSize: 12 }}>
          {t('组内 {{count}} 辆车已删除或当前不可见，已保留原标识；保存将原样提交，移除请在此操作', { count: missingCount })}
        </span>
      ) : null}
    </Modal>
  )
}
