/**
 * 任务统计筛选表单（P33 私有；数量/效率两个页签共享，效率页签无任务状态字段
 * ——OpenAPI OrderEfficiencyStatisticsParam 契约不含 orderStates，旧页同口径）。
 *
 * 布局与旧实现对应：数量页签 Row1=开始/结束/类型/状态，Row2=车辆+查询；
 * 效率页签 Row1=开始/结束/类型/车辆，Row2=查询。表单规范沿用 P03 确立的
 * 筛选栏样板（标签横排 104px、wrapper 弹性基准 0 禁 min-width:auto）；
 * 查询按钮为普通 submit 按钮（查询是筛选动作，不与页面主 CTA 争夺层级，P03 同款）。
 *
 * 时间参数：DatePicker（dayjs 值）提交时序列化 "yyyy-MM-dd HH:mm:ss"（部署时区
 * 语义，OpenAPI date-time），未选择发空串——旧实现 dateString || "" 同语义。
 */

import { Button, Col, DatePicker, Form, Row, Select, Space } from 'antd'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { ORDER_STATE_OPTIONS, ORDER_TYPE_OPTIONS } from '@/constants/order/orderDisplayOptions'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'
import type { OrderEfficiencyStatisticsParam, OrderQuantityStatisticsParam } from '@/services/report-order/report-order.service.types'
import styles from '@/features/analyze-visual/order-statistics/components/OrderStatisticsFilter.module.css'

/** 表单值形状（时间为 Dayjs 单值；集合为协议原值数组） */
interface OrderStatisticsFilterValues {
  startTime?: dayjs.Dayjs | null
  endTime?: dayjs.Dayjs | null
  orderTypes?: string[]
  orderStates?: string[]
  vehicleKeys?: string[]
}

interface OrderStatisticsFilterProps {
  /** 是否展示任务状态筛选（数量页签 true；效率页签契约无此字段传 false） */
  withOrderState: boolean
  /** 查询进行中：查询按钮转圈（旧实现 Button loading 同语义） */
  loading: boolean
  /** 提交查询：param 已序列化，可直接传给服务层 */
  onSearch: (param: OrderQuantityStatisticsParam | OrderEfficiencyStatisticsParam) => void
}

/** 表单值 → 查询参数：时间未选发空串；集合仅在有值时携带（旧实现同口径） */
function buildParam(values: OrderStatisticsFilterValues, withOrderState: boolean) {
  const param: OrderQuantityStatisticsParam = {
    startTime: values.startTime ? values.startTime.format('YYYY-MM-DD HH:mm:ss') : '',
    endTime: values.endTime ? values.endTime.format('YYYY-MM-DD HH:mm:ss') : '',
  }
  if (values.orderTypes?.length) param.orderTypes = values.orderTypes
  if (withOrderState && values.orderStates?.length) param.orderStates = values.orderStates
  if (values.vehicleKeys?.length) param.vehicleKeys = values.vehicleKeys
  return param
}

export function OrderStatisticsFilter({ withOrderState, loading, onSearch }: OrderStatisticsFilterProps) {
  // 双命名空间 fallback：本页私有文案在 report-order，筛选标签与枚举 label
  // （开始时间/任务类型/工作任务等）复用 orderRecord 既有译文，路由 meta 已声明齐
  const { t } = useTranslation(['report-order', 'orderRecord'], { nsMode: 'fallback' })
  const { t: tCommon } = useTranslation('common')
  const [form] = Form.useForm<OrderStatisticsFilterValues>()

  // 任务车辆选项：T00 共享选项契约（fetchSimpleVehicles；失败仅影响该下拉，
  // 下拉内呈现状态文本不设重试按钮——按钮纪律）
  const vehicles = useStaticOptions<SimpleVehicleDto>((signal) => fetchSimpleVehicles({ signal }))

  const handleFinish = (values: OrderStatisticsFilterValues) => {
    onSearch(buildParam(values, withOrderState))
  }

  return (
    <Form
      form={form}
      layout="horizontal"
      colon={false}
      labelCol={{ flex: '0 0 104px' }}
      /* wrapper 弹性基准为 0 且禁用 min-width:auto：日期等宽 min-content 控件
         不得把 wrapper 挤到标签下一行（视觉规范：标签横排居左） */
      wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}
      autoComplete="off"
      onFinish={handleFinish}
    >
      <Row gutter={[12, 0]}>
        <Col span={6}>
          <Form.Item label={t('开始时间')} name="startTime">
            <DatePicker
              style={{ width: '100%' }}
              placeholder={t('请选择开始时间')}
              showTime
              allowClear
              needConfirm
              preserveInvalidOnBlur
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('结束时间')} name="endTime">
            <DatePicker
              style={{ width: '100%' }}
              placeholder={t('请选择结束时间')}
              showTime
              allowClear
              needConfirm
              preserveInvalidOnBlur
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('任务类型')} name="orderTypes">
            <Select
              mode="multiple"
              allowClear
              placeholder={t('请选择任务类型')}
              options={ORDER_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }))}
            />
          </Form.Item>
        </Col>
        {withOrderState ? (
          <Col span={6}>
            <Form.Item label={t('任务状态')} name="orderStates">
              <Select
                mode="multiple"
                allowClear
                placeholder={t('请选择任务状态')}
                options={ORDER_STATE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }))}
              />
            </Form.Item>
          </Col>
        ) : (
          <Col span={6}>
            <Form.Item label={t('任务车辆')} name="vehicleKeys">
              <VehicleSelect vehicles={vehicles} notFoundContent={tCommon('加载失败')} />
            </Form.Item>
          </Col>
        )}
      </Row>
      <Row gutter={[12, 0]}>
        {withOrderState ? (
          <Col span={6}>
            <Form.Item label={t('任务车辆')} name="vehicleKeys">
              <VehicleSelect vehicles={vehicles} notFoundContent={tCommon('加载失败')} />
            </Form.Item>
          </Col>
        ) : null}
        <Col span={6}>
          <Form.Item label=" " className={styles.queryItem}>
            {/* wrap：1366 视口下标签占宽后按钮换行而非溢出（按钮可达优先） */}
            <Space wrap size={8}>
              <Button htmlType="submit" loading={loading}>
                {t('查询')}
              </Button>
            </Space>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  )
}

/** 任务车辆多选下拉（label=车辆名称、value=车辆 key；按名称搜索） */
function VehicleSelect({
  vehicles,
  notFoundContent,
}: {
  vehicles: { options: SimpleVehicleDto[] | null; loading: boolean; error: boolean }
  notFoundContent: string
}) {
  // 车辆下拉的占位/搜索走双命名空间 fallback（与宿主筛选表单一致）
  const { t } = useTranslation(['report-order', 'orderRecord'], { nsMode: 'fallback' })
  return (
    <Select
      mode="multiple"
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={t('请选择任务车辆')}
      loading={vehicles.loading}
      fieldNames={{ label: 'name', value: 'key' }}
      options={vehicles.options ?? []}
      popupMatchSelectWidth={350}
      notFoundContent={
        // 选项失败只呈现状态文本（不设重试按钮）；真实空集合显示默认无数据
        vehicles.error ? notFoundContent : undefined
      }
    />
  )
}
