/**
 * 创建任务弹窗（P03）：真实 createOrderRecord 接入（OpenAPI OrderRecordParam）。
 *
 * 交互与契约要点：
 * - 指定车辆/指定车辆分组互斥（旧实现语义）：二选一，均可空；
 * - 子任务（Form.List）至少一条，每行地图+站点必填、动作/动作分组互斥可选；
 * - 站点选项按「行」独立加载（旧实现全局一份会在多行不同地图时串选项，
 *   属正确性修复）：行内按当前地图请求、AbortController 防乱序、地图变更清空站点；
 * - 草稿（A13/DoD 7）：关闭弹窗不清空输入，草稿保留在页签内存（Activity 缓存），
 *   切页不丢；提交成功才清空。dirty 状态经 useTabDirtyGuard 登记到页签
 *   （LRU 不淘汰脏页签、关闭/刷新统一确认），并提供显式「清空」入口；
 * - 选项全部走共享契约（useStaticOptions），失败在下拉内呈现状态文本（不设重试按钮）；
 * - 提交防重复（confirmLoading）；失败保留输入，写操作不自动重试；
 * - 动作提交形状按 OpenAPI ActionParam 裁剪（剥离 id/审计字段）。
 */

import { useCallback, useRef, useState } from 'react'
import { App, Button, Card, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormListFieldData } from 'antd'
import { X as CloseIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { fetchSimpleMaps, fetchMapSites } from '@/services/map/map.service'
import type { SimpleSiteDto } from '@/services/map/map.service.types'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import { fetchVehicleGroups } from '@/services/vehicle/vehicle-group.service'
import { fetchAGVActions, fetchAGVActionGroups } from '@/services/action/agv-action.service'
import type { AGVActionDto, AGVActionGroupDto } from '@/services/action/agv-action.service.types'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'
import type { VehicleGroupDto } from '@/services/vehicle/vehicle-group.service.types'
import { createOrderRecord } from '@/services/order-record/order.service'
import type {
  CreateOrderRecordParam,
  OrderActionParam,
  OrderMissionParam,
} from '@/services/order-record/order.service.types'

/** 子任务行内站点选项状态：按行独立加载，互不串选项 */
interface MissionSiteOptionsState {
  options: SimpleSiteDto[]
  loading: boolean
  error: boolean
}

interface CreateOrderFormValues {
  orderName: string
  priority?: number
  appointVehicleKey?: string
  appointVehicleGroupKey?: string
  orderMissions?: {
    mapId?: string
    stationId?: string
    agvAction?: number
    agvActionGroup?: number
  }[]
}

interface CreateOrderModalProps {
  open: boolean
  onClose: () => void
  /** 创建成功后回调（页面刷新列表与统计；本组件已自行清空草稿） */
  onCreated: () => void
}

/** 选项对象 → 提交用 ActionParam：按 OpenAPI 剥离 id/审计字段，仅保留协议字段 */
function toActionParam(action: AGVActionDto): OrderActionParam {
  return {
    actionType: action.actionType,
    actionDescription: action.actionDescription,
    blockingType: action.blockingType,
    // 缺 key 的参数项无法被后端解释，提交前过滤（不静默补空串）
    actionParameters: (action.actionParameters ?? [])
      .filter((p) => typeof p.key === 'string')
      .map((p) => ({ key: p.key as string, value: p.value })),
  }
}

export function CreateOrderModal({ open, onClose, onCreated }: CreateOrderModalProps) {
  const { t } = useTranslation('orderRecord')
  const { t: tCommon } = useTranslation('common')
  const { message } = App.useApp()
  const [form] = Form.useForm<CreateOrderFormValues>()
  const [submitting, setSubmitting] = useState(false)

  // 草稿脏标记：只要表单存在任何输入就登记到页签（关页/刷新统一确认、LRU 豁免）
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, t('创建任务'))

  // 共享选项：车辆/分组/地图/动作/动作组（一次性全量只读选项，失败在各下拉内重试）
  const vehicles = useStaticOptions<SimpleVehicleDto>((signal) => fetchSimpleVehicles({ signal }))
  const vehicleGroups = useStaticOptions<VehicleGroupDto>((signal) => fetchVehicleGroups({ signal }))
  const simpleMaps = useStaticOptions((signal) => fetchSimpleMaps({ signal }))
  const agvActions = useStaticOptions<AGVActionDto>((signal) => fetchAGVActions({ signal }))
  const agvActionGroups = useStaticOptions<AGVActionGroupDto>((signal) => fetchAGVActionGroups({ signal }))

  // 站点选项按行缓存：fieldIndex → 状态；在途请求经 AbortController 防旧响应覆盖
  const [siteOptions, setSiteOptions] = useState<Record<number, MissionSiteOptionsState>>({})
  const siteAbortRef = useRef(new Map<number, AbortController>())

  /** 加载某行站点选项：以该行当前地图为准，仅接受最后一次结果（防乱序） */
  const loadSiteOptions = useCallback(
    (field: FormListFieldData) => {
      const mapId: string | undefined = form.getFieldValue(['orderMissions', field.name, 'mapId'])
      if (!mapId) return
      // 取消该行在途请求：仅保留最后一次展开触发的请求结果
      siteAbortRef.current.get(field.name)?.abort()
      const controller = new AbortController()
      siteAbortRef.current.set(field.name, controller)

      setSiteOptions((prev) => ({ ...prev, [field.name]: { options: [], loading: true, error: false } }))
      fetchMapSites(mapId, { signal: controller.signal })
        .then((list) => {
          if (controller.signal.aborted) return
          // 站点按名称自然排序（旧实现同口径），便于在长列表中定位
          const sorted = [...list].sort((a, b) =>
            (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true }),
          )
          setSiteOptions((prev) => ({
            ...prev,
            [field.name]: { options: sorted, loading: false, error: false },
          }))
        })
        .catch((error) => {
          // 主动取消静默；真实失败清空该行选项并标错（不残留旧地图站点冒充）
          if (controller.signal.aborted || isCancelledError(error)) return
          setSiteOptions((prev) => ({ ...prev, [field.name]: { options: [], loading: false, error: true } }))
          message.error(t('查询跨地图节点出错') + apiErrorMessage(error))
        })
    },
    [form, message, t],
  )

  /** 行地图变更：清空该行站点值与已加载选项（父条件变化重置依赖字段，A17） */
  const handleMissionMapChange = useCallback(
    (field: FormListFieldData) => {
      form.setFieldValue(['orderMissions', field.name, 'stationId'], undefined)
      siteAbortRef.current.get(field.name)?.abort()
      setSiteOptions((prev) => {
        const next = { ...prev }
        delete next[field.name]
        return next
      })
    },
    [form],
  )

  // 弹窗关闭时不销毁不重置（草稿保留）；Modal 默认不销毁内容，
  // 表单值留在组件内存 = 页签内存草稿（Activity 缓存保证切页不丢）

  const handleValuesChange = useCallback(() => {
    // 有任何输入即视为脏（创建表单切页保留、关页确认的依据）
    setDirty(true)
  }, [])

  /** 清空草稿：显式用户动作；提交成功后也走这里复位到干净基线 */
  const handleResetDraft = useCallback(() => {
    siteAbortRef.current.forEach((controller) => controller.abort())
    siteAbortRef.current.clear()
    form.resetFields()
    setSiteOptions({})
    setDirty(false)
  }, [form])

  const handleClose = useCallback(() => {
    // 关闭保留草稿（DoD 7）；丢弃路径是显式「清空」按钮，不静默清用户输入
    onClose()
  }, [onClose])

  const handleOk = async () => {
    const values = await form.validateFields()
    if (submitting) return
    setSubmitting(true)
    try {
      const missions: OrderMissionParam[] = (values.orderMissions ?? []).map((mission) => {
        // 车辆动作与动作分组互斥：选动作提交单动作数组；选分组提交组内全部动作
        const selectedAction = agvActions.options?.find((a) => a.id === mission.agvAction)
        const selectedGroup = agvActionGroups.options?.find((g) => g.id === mission.agvActionGroup)
        const actions = selectedAction
          ? [toActionParam(selectedAction)]
          : (selectedGroup?.agvActions ?? []).map(toActionParam)
        return {
          mapId: mission.mapId,
          stationId: mission.stationId,
          actions,
        }
      })
      const params: CreateOrderRecordParam = {
        orderName: values.orderName,
        priority: values.priority,
        appointVehicleKey: values.appointVehicleKey || undefined,
        appointVehicleGroupKey: values.appointVehicleGroupKey || undefined,
        orderMissions: missions,
      }
      await createOrderRecord(params)
      message.success(t('创建订单成功'))
      // 成功才清空草稿（成功基线更新）；失败路径在 catch 中保留输入
      handleResetDraft()
      onCreated()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('创建订单出错') + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** 下拉选项区失败的统一呈现：仅状态文本，不设重试按钮（视觉规范：非表格区域不设重试） */
  const failedNotFound = (error: boolean | undefined) =>
    error ? (
      <span style={{ color: 'var(--app-text-secondary, rgba(0, 0, 0, 0.45))', fontSize: 12 }}>
        {tCommon('加载失败')}
      </span>
    ) : undefined

  return (
    <Modal
      title={t('创建任务')}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      width={640}
      // 草稿弹窗：关闭不销毁内容，表单值保留在页签内存
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
      {/* 标签横排居左（视觉规范）：6/18 分栏，长标签「指定车辆分组」不换行 */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={handleValuesChange}
      >
        <Form.Item
          label={t('任务名称')}
          name="orderName"
          rules={[{ required: true, message: t('请输入订单名称') }]}
        >
          <Input placeholder={t('请输入订单名称')} maxLength={100} />
        </Form.Item>

        <Form.Item label={t('优先级')} name="priority">
          <InputNumber style={{ width: '100%' }} min={0} max={999} placeholder={t('请输入优先级[0-999]')} />
        </Form.Item>

        {/*
          指定车辆/分组互斥（旧实现语义）：选了分组隐藏车辆、选了车辆隐藏分组。
          用 Form.Item shouldUpdate 渲染联动（依赖字段变化重新渲染，防旧值残留）。
        */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.appointVehicleGroupKey !== cur.appointVehicleGroupKey}>
          {({ getFieldValue }) =>
            !getFieldValue('appointVehicleGroupKey') ? (
              <Form.Item label={t('指定车辆')} name="appointVehicleKey">
                <Select
                  placeholder={t('请选择订单指定车辆')}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={vehicles.loading}
                  fieldNames={{ label: 'name', value: 'key' }}
                  options={vehicles.options ?? []}
                  notFoundContent={failedNotFound(vehicles.error)}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.appointVehicleKey !== cur.appointVehicleKey}>
          {({ getFieldValue }) =>
            !getFieldValue('appointVehicleKey') ? (
              <Form.Item label={t('指定车辆组')} name="appointVehicleGroupKey">
                <Select
                  placeholder={t('请选择车辆分组')}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={vehicleGroups.loading}
                  fieldNames={{ label: 'agvGroupName', value: 'agvGroupKey' }}
                  options={vehicleGroups.options ?? []}
                  notFoundContent={failedNotFound(vehicleGroups.error)}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.List
          name="orderMissions"
          rules={[
            {
              // 子任务业务约束：至少一条（对应调度校验 ORDER_MISSION_CAN_NOT_BE_EMPTY）
              validator: async (_, missions) => {
                if (!missions || missions.length < 1) {
                  return Promise.reject(new Error(t('子任务不能为空')))
                }
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <div style={{ display: 'flex', rowGap: 12, flexDirection: 'column' }}>
              {fields.map((field) => (
                <Card
                  size="small"
                  title={`${t('子任务')} ${field.name + 1}`}
                  key={field.key}
                  extra={
                    <CloseIcon
                      size={14}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        // 移除行：清理该行站点选项缓存与在途请求，避免泄漏
                        siteAbortRef.current.get(field.name)?.abort()
                        siteAbortRef.current.delete(field.name)
                        setSiteOptions((prev) => {
                          const next = { ...prev }
                          delete next[field.name]
                          return next
                        })
                        remove(field.name)
                      }}
                    />
                  }
                >
                  <Form.Item
                    label={t('地图名称')}
                    name={[field.name, 'mapId']}
                    rules={[{ required: true, message: t('请选择地图') }]}
                  >
                    <Select
                      placeholder={t('请选择地图')}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      loading={simpleMaps.loading}
                      fieldNames={{ label: 'mapName', value: 'mapId' }}
                      options={simpleMaps.options ?? []}
                      onChange={() => handleMissionMapChange(field)}
                      notFoundContent={failedNotFound(simpleMaps.error)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('站点名称')}
                    name={[field.name, 'stationId']}
                    rules={[{ required: true, message: t('请选择站点') }]}
                  >
                    <Select
                      placeholder={t('请选择站点')}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      loading={siteOptions[field.name]?.loading === true}
                      fieldNames={{ label: 'name', value: 'id' }}
                      options={siteOptions[field.name]?.options ?? []}
                      onOpenChange={(isOpen) => {
                        // 展开下拉时按该行当前地图加载站点（按行独立，防跨行串选项）
                        if (isOpen) loadSiteOptions(field)
                      }}
                      notFoundContent={failedNotFound(siteOptions[field.name]?.error === true)}
                    />
                  </Form.Item>

                  {/* 车辆动作/动作分组互斥可选（旧实现语义；都不选=纯移动子任务） */}
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) =>
                      !getFieldValue(['orderMissions', field.name, 'agvActionGroup']) ? (
                        <Form.Item label={t('车辆动作')} name={[field.name, 'agvAction']}>
                          <Select
                            placeholder={t('请选择车辆动作')}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            loading={agvActions.loading}
                            fieldNames={{ label: 'actionDescription', value: 'id' }}
                            options={agvActions.options ?? []}
                            notFoundContent={failedNotFound(agvActions.error)}
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) =>
                      !getFieldValue(['orderMissions', field.name, 'agvAction']) ? (
                        <Form.Item label={t('动作分组')} name={[field.name, 'agvActionGroup']}>
                          <Select
                            placeholder={t('请选择车辆动作分组')}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            loading={agvActionGroups.loading}
                            fieldNames={{ label: 'actionGroupName', value: 'id' }}
                            options={agvActionGroups.options ?? []}
                            notFoundContent={failedNotFound(agvActionGroups.error)}
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                </Card>
              ))}
              <Button type="dashed" onClick={() => add()} block>
                {t('+ 添加车辆子任务')}
              </Button>
              <Form.ErrorList errors={errors} />
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  )
}
