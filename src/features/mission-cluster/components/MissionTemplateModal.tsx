/**
 * 创建/编辑/复制任务工艺模板弹窗（P20 整页重写，旧 MissionCreate/MissionModal
 * 等价迁移）。
 *
 * 交互与契约要点：
 * - 单弹窗三态（旧实现 isModify+modifyRow 组合同形态）：mode=create 创建 /
 *   mode=edit 编辑（updateOrderTemplate 按 int64 id 定位整模板替换）/ mode=copy
 *   复制（回显目标行数据、提交走创建且不携带 id——旧实现复制即 isModify=false
 *   的整表单回显同语义）；
 * - 表单结构与旧版逐项一致：模板名称（必填）/指定车辆与指定车辆分组互斥显示
 *   （分组有值时隐藏车辆下拉、反之亦然；切换时互斥清理对方字段值，收敛旧实现
 *   「隐藏字段值残留提交」的模糊边界——OpenAPI 声明两字段语义互斥二选一）/
 *   子任务 Form.List（至少 1 条，「子任务不能为空」整组校验）；
 * - 子任务卡内：地图（必填，切换地图清空本卡站点=旧 onMissionMapIdChange 同
 *   语义）/站点（必填，下拉展开时按地图 id 拉取 getCrossMapStations 并按
 *   mapId 缓存共享——旧实现同款缓存键，同地图的多个子任务复用同一份选项）/
 *   动作 Form.List：动作类型/动作描述（必填文本）/阻塞类型（必填，NONE/SOFT/
 *   HARD；编辑回显未知原值并入选项=P23 同款纪律，不因未知枚举丢失）/动作参数
 *   Form.List（动作名+动作值行内控件 Row 11/11/2 旧同布局；value 非字符串仅转
 *   显示、未改动行提交原始值=P23 守恒纪律）；
 * - 提交组装（显式按 OpenAPI 字段，行为等价旧 getFieldsValue(true) 全量——
 *   后端只消费声明字段）：创建/复制 body=OrderTemplateParam；编辑另带 id（从
 *   target 显式携带）；appointVehicleKey/appointVehicleGroupKey 互斥兜底（分组
 *   优先，正常路径二者天然互斥）；
 * - 打开时按模式回填/清空（依赖 open 触发=P32 教训：复制与编辑可能指向同一
 *   行引用，仅依赖 target 会跳过回填）；选项经 useStaticOptions 打开时拉取
 *   （P03 代建共享选项服务）；关闭销毁草稿（destroyOnHidden，旧 handleCancel
 *   resetFields 同语义；失败保留输入=旧失败路径不关弹窗同语义）。
 */

import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Col, Form, Input, Modal, Row, Select } from 'antd'
import type { FormListFieldData } from 'antd'
import { CircleMinus, Plus, X as CloseIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  createOrderTemplate,
  updateOrderTemplate,
} from '@/services/order-template/order-template-manage.service'
import type { TemplateRowDto } from '@/services/order-template/order-template-manage.service.types'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import { fetchVehicleGroups } from '@/services/vehicle/vehicle-group.service'
import { fetchSimpleMaps } from '@/services/map/map.service'
import { fetchCrossMapStations } from '@/services/cross-map/cross-map.service'
import type { SimpleStationDto } from '@/services/cross-map/cross-map.service.types'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { toValueDisplayText } from '@/utils/display/valueDisplay'

/** 表单值形状（与旧实现 OrderGroupType/Actions 一致；id 由编辑目标显式携带不进表单） */
interface TemplateFormValues {
  orderTemplateName: string
  appointVehicleKey?: string
  appointVehicleGroupKey?: string
  orderMissions?: MissionFormValues[]
}

/** 子任务卡表单值（与旧实现 OrderMissionType 一致） */
interface MissionFormValues {
  mapId?: string
  stationId?: string
  actions?: ActionFormValues[]
}

/** 动作卡表单值（与旧实现 Actions 一致；参数 value 宽松类型守恒） */
interface ActionFormValues {
  actionType?: string
  actionDescription?: string
  blockingType?: string
  actionParameters?: { key?: string; value?: unknown }[]
}

/** 阻塞类型既定枚举（OpenAPI blockingType enum，后端受控未知值 500——P23 已实证；
 *  label=value 原值，旧实现 blockingOptions 同款） */
const BLOCKING_OPTIONS = [
  { label: 'NONE', value: 'NONE' },
  { label: 'SOFT', value: 'SOFT' },
  { label: 'HARD', value: 'HARD' },
]

/** 弹窗模式：创建 / 编辑（携带 id 更新）/ 复制（回显后走创建） */
export type MissionTemplateModalMode = 'create' | 'edit' | 'copy'

interface MissionTemplateModalProps {
  open: boolean
  mode: MissionTemplateModalMode
  /** 回显目标行快照（mode=create 时为 null） */
  target: TemplateRowDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表并关闭弹窗） */
  onSucceeded: () => void
}

export function MissionTemplateModal({
  open,
  mode,
  target,
  onClose,
  onSucceeded,
}: MissionTemplateModalProps) {
  // 跨命名空间：主体文案走 orderTemplate，选项加载失败走 common「加载失败」
  // （AGENTS 第 6 节 nsMode fallback，无前缀 key 按数组顺序回退）
  const { t } = useTranslation(['orderTemplate', 'common'], { nsMode: 'fallback' })
  const { message } = App.useApp()
  const [form] = Form.useForm<TemplateFormValues>()
  // 提交中状态：驱动确认按钮 loading，防止重复提交
  const [submitting, setSubmitting] = useState(false)

  // 弹窗标题三态（旧实现 isModify/modifyRow 组合同语义）
  const title =
    mode === 'edit' ? t('编辑任务') : mode === 'copy' ? t('复制任务') : t('创建任务')

  /* --------------------------- 选项数据（打开时拉取） --------------------------- */

  // 车辆/车辆分组/地图全量选项：弹窗打开时才加载（关闭不重查，页签存活期内复用）
  const vehicleOptions = useStaticOptions(() => fetchSimpleVehicles(), open)
  const vehicleGroupOptions = useStaticOptions(() => fetchVehicleGroups(), open)
  const mapOptions = useStaticOptions(() => fetchSimpleMaps(), open)

  /**
   * 站点选项缓存（旧实现 stationsMap 同款）：键=地图 id，同地图的多个子任务
   * 复用同一份选项；下拉展开时按本卡当前地图幂等拉取（失败后重新展开即重查，
   * 可见恢复路径）。
   */
  const [stationsMap, setStationsMap] = useState<Record<string, SimpleStationDto[]>>({})

  /** 按地图 id 拉取站点选项并写入缓存（幂等：已缓存仍重查对齐旧实现 onOpenChange 行为） */
  const loadStations = useCallback(
    async (mapId: string) => {
      try {
        const list = await fetchCrossMapStations(mapId)
        setStationsMap((prev) => ({ ...prev, [mapId]: list }))
      } catch (error) {
        // 旧实现同语义：查询站点失败如实反馈，不清空其他地图的已缓存选项
        if (!isCancelledError(error)) {
          message.warning(`${t('查询跨地图节点出错')}${apiErrorMessage(error)}`)
        }
      }
    },
    [message, t],
  )

  /* ------------------------------ 打开时回填 / 清空 ------------------------------ */

  /** 弹窗打开时按模式回填 / 清空表单（依赖 open 触发=P32 教训：复制与编辑可能
   *  指向同一行引用，仅依赖 target 会因引用不变跳过回填） */
  useEffect(() => {
    if (!open) return
    if (target) {
      // 旧实现同语义：先重置再赋值，避免残留上一个工艺的数据
      form.resetFields()
      // 回显时把每个子任务的站点按 mapId 合成缓存条目（旧实现 initialStations
      // 同款——回显下拉需要立即可用选项，不依赖用户重新展开触发加载）
      const initialStations: Record<string, SimpleStationDto[]> = {}
      for (const mission of target.orderMissions ?? []) {
        const mapId = mission.mapId
        if (!mapId) continue
        const entry: SimpleStationDto | null =
          mission.stationId === null || mission.stationId === undefined
            ? null
            : { id: mission.stationId, name: mission.stationName ?? '' }
        if (!entry) continue
        if (!initialStations[mapId]) initialStations[mapId] = []
        initialStations[mapId].push(entry)
      }
      setStationsMap(initialStations)
      form.setFieldsValue({
        orderTemplateName: target.orderTemplateName ?? '',
        appointVehicleKey: target.appointVehicleKey ?? undefined,
        appointVehicleGroupKey: target.appointVehicleGroupKey ?? undefined,
        orderMissions: (target.orderMissions ?? []).map((mission) => ({
          mapId: mission.mapId,
          stationId: mission.stationId,
          actions: (mission.actions ?? []).map((action) => ({
            actionType: action.actionType,
            actionDescription: action.actionDescription,
            blockingType: action.blockingType,
            actionParameters: (action.actionParameters ?? []).map((param) => ({
              key: param.key,
              // 非字符串 value 原值进表单状态（显示经 getValueProps 转换=P23 守恒）
              value: param.value,
            })),
          })),
        })),
      })
    } else {
      // 创建模式：主动清空 + 站点缓存复位，避免上一轮回显残留带入（旧版同语义）
      form.resetFields()
      setStationsMap({})
    }
  }, [open, target, form])

  /* --------------------------- 订阅表单值（渲染联动） --------------------------- */

  // 订阅整棵子任务树：驱动「车辆/分组互斥显隐」「站点选项按卡当前地图」「阻塞
  // 类型未知值并入选项」随输入实时重算（Form.useWatch 深层路径监听）
  const missionsWatch = Form.useWatch('orderMissions', form)

  /** 下拉选项区失败的统一呈现：仅状态文本，不设重试按钮（非表格区域按钮纪律，
   *  P10 CrossMapModal 同款） */
  const failedNotFound = (error: boolean | undefined) =>
    error ? (
      <span style={{ color: 'var(--app-text-secondary, rgba(0, 0, 0, 0.45))', fontSize: 12 }}>
        {t('加载失败')}
      </span>
    ) : undefined

  /* ------------------------------- 提交（防重复） ------------------------------- */

  /** 弹窗确认：校验通过后按模式调用创建/更新（旧版 handleOk 同结构；失败保留
   *  输入不关弹窗，写操作不自动重试） */
  const handleOk = async () => {
    if (submitting) return
    let values: TemplateFormValues
    try {
      values = await form.validateFields()
    } catch {
      // 校验失败：antd 已在各字段下方呈现错误（含「子任务不能为空」整组错误）
      return
    }
    // 显式按 OpenAPI 组装（后端只消费声明字段）；车辆/分组互斥兜底：分组优先，
    // 正常路径二者天然互斥（切换时已互斥清理）
    const appointVehicleGroupKey = values.appointVehicleGroupKey || undefined
    const appointVehicleKey = appointVehicleGroupKey
      ? undefined
      : values.appointVehicleKey || undefined
    const payload = {
      orderTemplateName: values.orderTemplateName,
      appointVehicleKey,
      appointVehicleGroupKey,
      orderMissions: (values.orderMissions ?? []).map((mission) => ({
        mapId: mission.mapId ?? '',
        stationId: mission.stationId ?? '',
        actions: (mission.actions ?? []).map((action) => ({
          actionType: action.actionType ?? '',
          actionDescription: action.actionDescription ?? '',
          blockingType: action.blockingType ?? '',
          actionParameters: (action.actionParameters ?? []).map((param) => ({
            key: param.key ?? '',
            value: param.value,
          })),
        })),
      })),
    }
    setSubmitting(true)
    try {
      if (mode === 'edit' && target) {
        await updateOrderTemplate({ ...payload, id: target.id as number })
        message.success(t('更新任务成功'))
      } else {
        // 创建与复制都走创建（复制不携带回显行的 id——旧实现同语义）
        await createOrderTemplate(payload)
        message.success(t('创建任务成功'))
      }
      // 成功才关闭并刷新列表；失败路径保留输入
      onSucceeded()
    } catch (error) {
      // 失败保留输入；取消（切页/弹窗销毁引发的请求中止）不打错误提示
      if (!isCancelledError(error)) {
        message.error(
          t(mode === 'edit' ? '更新任务出错：{{msg}}' : '创建任务出错：{{msg}}', {
            msg: apiErrorMessage(error),
          }),
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* ------------------------------- 渲染（三层嵌套） ------------------------------- */

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      // 关闭即销毁草稿（旧版 handleCancel resetFields 同语义，等价迁移）
      destroyOnHidden
      confirmLoading={submitting}
      okText={t('确定')}
      cancelText={t('取消')}
      // 三层嵌套卡片在默认宽度内放不下：旧版同表单在窄 Modal 中多层挤压不可读，
      // 本实现加宽到 720 保证子任务/动作卡与参数两列输入可用（展示差异登记）
      width={720}
    >
      <Form
        name="missionTemplateForm"
        form={form}
        // 弹窗内表单参数（AGENTS 第 3 节：labelCol 6 / wrapper 18）
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
      >
        <Form.Item<TemplateFormValues>
          label={t('模板名称')}
          name="orderTemplateName"
          rules={[{ required: true, message: t('请输入模板名称') }]}
        >
          <Input placeholder={t('请输入模板名称')} />
        </Form.Item>

        {/* 指定车辆：仅当未选车辆分组时显示（旧实现 shouldUpdate 条件渲染同形态；
            互斥 onChange 清理对方字段，收敛旧实现隐藏字段值残留提交的模糊边界） */}
        <Form.Item<TemplateFormValues> noStyle shouldUpdate>
          {({ getFieldValue }) =>
            !getFieldValue('appointVehicleGroupKey') ? (
              <Form.Item<TemplateFormValues>
                label={t('指定车辆')}
                name="appointVehicleKey"
                rules={[{ required: false, message: t('请选择指定车辆') }]}
              >
                <Select
                  placeholder={t('请选择订单指定车辆')}
                  allowClear
                  showSearch
                  loading={vehicleOptions.loading}
                  optionFilterProp="label"
                  notFoundContent={failedNotFound(vehicleOptions.error)}
                  options={(vehicleOptions.options ?? []).map((item) => ({
                    label: String(item.name ?? ''),
                    value: String(item.key ?? ''),
                  }))}
                  onChange={(value?: string) => {
                    // 互斥清理：选了车辆就清掉车辆分组（allowClear 清空同样触发）
                    if (value) form.setFieldValue('appointVehicleGroupKey', undefined)
                  }}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        {/* 指定车辆分组：仅当未选车辆时显示（与上方互斥成对） */}
        <Form.Item<TemplateFormValues> noStyle shouldUpdate>
          {({ getFieldValue }) =>
            !getFieldValue('appointVehicleKey') ? (
              <Form.Item<TemplateFormValues>
                label={t('指定车辆分组')}
                name="appointVehicleGroupKey"
                rules={[{ required: false, message: t('请选择车辆分组') }]}
              >
                <Select
                  placeholder={t('请选择车辆分组')}
                  allowClear
                  showSearch
                  loading={vehicleGroupOptions.loading}
                  optionFilterProp="label"
                  notFoundContent={failedNotFound(vehicleGroupOptions.error)}
                  options={(vehicleGroupOptions.options ?? []).map((item) => ({
                    label: String(item.agvGroupName ?? ''),
                    value: String(item.agvGroupKey ?? ''),
                  }))}
                  onChange={(value?: string) => {
                    // 互斥清理：选了车辆分组就清掉指定车辆
                    if (value) form.setFieldValue('appointVehicleKey', undefined)
                  }}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        {/* 子任务列表：至少 1 条（旧实现整组校验「子任务不能为空」同文案） */}
        <Form.List
          name="orderMissions"
          rules={[
            {
              validator: async (_, orderMissions: MissionFormValues[] | undefined) => {
                if (!orderMissions || orderMissions.length < 1) {
                  return Promise.reject(new Error(t('子任务不能为空')))
                }
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <div style={{ display: 'flex', rowGap: 16, flexDirection: 'column' }}>
              {fields.map((field: FormListFieldData) => {
                // 本卡当前值（useWatch 订阅驱动：地图变化即时反映到站点选项/清空联动）
                const missionValue = missionsWatch?.[field.name]
                const currentMapId = typeof missionValue?.mapId === 'string' ? missionValue.mapId : ''
                const stations = stationsMap[currentMapId] ?? []
                return (
                  <Card
                    size="small"
                    title={t('子任务 {index}', { index: field.name + 1 })}
                    key={field.key}
                    extra={
                      <CloseIcon
                        size={14}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
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
                        loading={mapOptions.loading}
                        optionFilterProp="label"
                        notFoundContent={failedNotFound(mapOptions.error)}
                        options={(mapOptions.options ?? []).map((item) => ({
                          label: String(item.mapName ?? ''),
                          value: String(item.mapId ?? ''),
                        }))}
                        onChange={() => {
                          // 切换地图清空本卡已选站点（旧 onMissionMapIdChange 同语义）
                          form.setFieldValue(['orderMissions', field.name, 'stationId'], undefined)
                        }}
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
                        options={stations.map((item) => ({
                          label: String(item.name ?? ''),
                          value: String(item.id ?? ''),
                        }))}
                        onOpenChange={(isOpen) => {
                          // 展开下拉时按本卡当前地图幂等拉取（旧 onNodeIdOpenChange
                          // 同语义；失败后重新展开即重查=可见恢复路径）
                          if (isOpen && currentMapId) void loadStations(currentMapId)
                        }}
                      />
                    </Form.Item>

                    {/* 动作列表：卡内 Form.List（旧实现同结构） */}
                    <Form.List name={[field.name, 'actions']}>
                      {(actionFields, { add: addAction, remove: removeAction }) => (
                        <div style={{ display: 'flex', rowGap: 16, flexDirection: 'column' }}>
                          {actionFields.map(({ key: actionKey, name: actionName, ...restActionField }) => {
                            // 本动作卡当前阻塞类型：未知原值并入选项（P23 同款纪律，
                            // 已有数据不因未知枚举丢失；未改动行保存原值回传）
                            const currentBlocking = missionsWatch?.[field.name]?.actions?.[actionName]?.blockingType
                            const blockingOptions =
                              currentBlocking &&
                              !BLOCKING_OPTIONS.some((option) => option.value === currentBlocking)
                                ? [...BLOCKING_OPTIONS, { label: currentBlocking, value: currentBlocking }]
                                : BLOCKING_OPTIONS
                            return (
                              <Card
                                size="small"
                                title={t('动作 {index}', { index: actionName + 1 })}
                                key={actionKey}
                                extra={
                                  <CloseIcon
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                      removeAction(actionName)
                                    }}
                                  />
                                }
                              >
                                <Form.Item<ActionFormValues>
                                  {...restActionField}
                                  label={t('动作类型')}
                                  name={[actionName, 'actionType']}
                                  rules={[{ required: true, message: t('请输入动作类型!') }]}
                                >
                                  <Input placeholder={t('请输入动作类型')} />
                                </Form.Item>

                                <Form.Item<ActionFormValues>
                                  {...restActionField}
                                  label={t('动作描述')}
                                  name={[actionName, 'actionDescription']}
                                  rules={[{ required: true, message: t('请输入动作描述!') }]}
                                >
                                  <Input placeholder={t('请输入动作描述')} />
                                </Form.Item>

                                <Form.Item<ActionFormValues>
                                  {...restActionField}
                                  label={t('阻塞类型')}
                                  name={[actionName, 'blockingType']}
                                  rules={[{ required: true, message: t('请选择阻塞类型!') }]}
                                >
                                  <Select
                                    allowClear
                                    placeholder={t('请选择阻塞类型')}
                                    options={blockingOptions}
                                  />
                                </Form.Item>

                                {/* 动作参数集合：卡内 Form.List（行内 动作名/动作值+
                                    行删除图标；无参数时不显示行仅保留添加按钮） */}
                                <Form.List name={[actionName, 'actionParameters']}>
                                  {(parameterFields, { add: addParameter, remove: removeParameter }) => (
                                    <>
                                      {parameterFields.map(({ key: paramKey, name: paramName, ...restParamField }) => (
                                        <Row key={paramKey}>
                                          <Col span={11}>
                                            <Form.Item
                                              {...restParamField}
                                              name={[paramName, 'key']}
                                              rules={[{ required: true, message: t('请输入动作名') }]}
                                            >
                                              <Input placeholder={t('动作名')} />
                                            </Form.Item>
                                          </Col>
                                          <Col span={11}>
                                            <Form.Item
                                              {...restParamField}
                                              name={[paramName, 'value']}
                                              rules={[{ required: true, message: t('请输入动作值') }]}
                                              // 非字符串 value 只转显示（P23 守恒纪律）：
                                              // 用户改动即存新文本，未改动保留原始值
                                              // （对象/数组/数字）随表单原样提交
                                              getValueProps={(value) => ({
                                                value: toValueDisplayText(value),
                                              })}
                                            >
                                              <Input placeholder={t('动作值')} />
                                            </Form.Item>
                                          </Col>
                                          <Col span={2} style={{ textAlign: 'center' }}>
                                            <CircleMinus
                                              size={16}
                                              style={{ cursor: 'pointer', marginTop: 8 }}
                                              onClick={() => removeParameter(paramName)}
                                            />
                                          </Col>
                                        </Row>
                                      ))}
                                      <Form.Item noStyle>
                                        <Button
                                          type="dashed"
                                          onClick={() => addParameter()}
                                          block
                                          icon={<Plus size={14} />}
                                        >
                                          {t('添加子任务动作参数')}
                                        </Button>
                                      </Form.Item>
                                    </>
                                  )}
                                </Form.List>
                              </Card>
                            )
                          })}

                          <Button
                            type="dashed"
                            onClick={() => addAction()}
                            block
                            icon={<Plus size={14} />}
                          >
                            {t('添加子任务动作')}
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </Card>
                )
              })}
              <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>
                {t('添加子任务')}
              </Button>
              {/* Form.List 顶层校验错误（子任务不能为空）走官方 ErrorList 呈现 */}
              <Form.ErrorList errors={errors} />
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  )
}
