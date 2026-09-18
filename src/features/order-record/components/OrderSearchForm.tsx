/**
 * 任务列表搜索表单（P03）。
 *
 * 旧实现：SearchForm（任务名称/类型/状态/车辆 + 创建/终止/执行三段时间范围 +
 * 查询/清空/创建任务/导出 Excel）。
 * 新实现保持同一筛选口径：
 * - 仅收集有值字段为查询参数（所见即所得；空值不写入参数对象）；
 * - 查询与导出共用同一 buildFilters（导出遵循后端筛选与数据范围，DoD 9）；
 * - 车辆选项走共享选项契约（useStaticOptions：scope 取消/防乱序/失败清空），
 *   失败在下拉内呈现状态文本（不设重试按钮），不阻塞列表主查询；
 * - 时间序列化 yyyy-MM-dd HH:mm:ss（与后端 date-time 口径一致，部署时区语义）。
 */

import { Button, Col, DatePicker, Form, Input, Row, Select, Space } from 'antd'
import type { GetProps } from 'antd'
import dayjs from 'dayjs'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { usePermission } from '@/hooks/usePermission'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'
import type { OrderRecordPageParam, OrderState, OrderType } from '@/services/order-record/order.service.types'
import { ORDER_STATE_OPTIONS, ORDER_TYPE_OPTIONS } from './orderRecordOptions'

type RangePickerProps = GetProps<typeof DatePicker.RangePicker>

/** 表单值形状（时间范围为 Dayjs 区间，提交前序列化） */
interface OrderSearchFormValues {
  query?: string
  orderType?: OrderType
  orderState?: OrderState
  vehicleKey?: string
  createTime?: RangePickerProps['value']
  finalTime?: RangePickerProps['value']
  executionTime?: RangePickerProps['value']
}

/** 页面消费的筛选参数（已序列化，可直接进列表查询/导出） */
export type OrderFilters = Pick<
  OrderRecordPageParam,
  | 'query'
  | 'orderType'
  | 'orderState'
  | 'vehicleKey'
  | 'startCreateTime'
  | 'endCreateTime'
  | 'startFinalTime'
  | 'endFinalTime'
  | 'startExecutionTime'
  | 'endExecutionTime'
>

/** 把表单值转为查询参数：仅保留有值字段，时间序列化为后端口径（所见即所得） */
function buildFilters(values: OrderSearchFormValues): OrderFilters {
  const filters: OrderFilters = {}
  if (values.query) filters.query = values.query.trim()
  if (values.orderType) filters.orderType = values.orderType
  if (values.orderState) filters.orderState = values.orderState
  if (values.vehicleKey) filters.vehicleKey = values.vehicleKey
  // RangePicker 被 allowClear 清空后字段值为 null（非 undefined），需显式判空再序列化
  type TimeFilterKey = 'startCreateTime' | 'endCreateTime' | 'startExecutionTime' | 'endExecutionTime' | 'startFinalTime' | 'endFinalTime'
  const ranges: [TimeFilterKey, TimeFilterKey, RangePickerProps['value']][] = [
    ['startCreateTime', 'endCreateTime', values.createTime],
    ['startExecutionTime', 'endExecutionTime', values.executionTime],
    ['startFinalTime', 'endFinalTime', values.finalTime],
  ]
  for (const [startKey, endKey, range] of ranges) {
    const [start, end] = Array.isArray(range) ? range : [null, null]
    if (start) filters[startKey] = (start as dayjs.Dayjs).format('YYYY-MM-DD HH:mm:ss')
    if (end) filters[endKey] = (end as dayjs.Dayjs).format('YYYY-MM-DD HH:mm:ss')
  }
  return filters
}

interface OrderSearchFormProps {
  /** 提交查询（页面负责回首页并触发列表刷新） */
  onSearch: (filters: OrderFilters) => void
  /** 打开创建任务弹窗（按钮受 order-record:create 按钮码控制） */
  onCreate: () => void
  /** 导出 Excel（页面用当前表单值执行导出流程） */
  onExport: (filters: OrderFilters) => void
}

export function OrderSearchForm({ onSearch, onCreate, onExport }: OrderSearchFormProps) {
  const { t } = useTranslation('orderRecord')
  const { t: tCommon } = useTranslation('common')
  const [form] = Form.useForm<OrderSearchFormValues>()

  // 按钮码权限：创建入口无权限隐藏（DoD 3；与旧实现 §7.1 一致）
  const { hasPerm } = usePermission()
  const canCreate = hasPerm(PERM_BUTTON.ORDER_RECORD_CREATE)

  // 车辆选项：共享契约一次加载（列表主查询不依赖它，失败仅影响该下拉）
  const vehicles = useStaticOptions<SimpleVehicleDto>((signal) => fetchSimpleVehicles({ signal }))

  const handleSearch = useCallback(
    (values: OrderSearchFormValues) => {
      onSearch(buildFilters(values))
    },
    [onSearch],
  )

  const handleReset = useCallback(() => {
    // 「清空」同时复位表单 UI 与查询条件（旧实现缺陷修复：两者必须同步）
    form.resetFields()
    onSearch({})
  }, [form, onSearch])

  const handleExport = useCallback(() => {
    // 导出直接取表单当前值：与列表查询同一 buildFilters 口径
    onExport(buildFilters(form.getFieldsValue()))
  }, [form, onExport])

  return (
    <Form
      form={form}
      layout="horizontal"
      colon={false}
      labelCol={{ flex: '0 0 104px' }}
      /* wrapper 弹性基准必须为 0 且禁用 min-width:auto：
         RangePicker 等宽 min-content 控件会把 wrapper 挤到 ant-row 的下一行，
         视觉上退回「标签在上」的竖排（antd 行容器默认允许换行） */
      wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}
      autoComplete="off"
      onFinish={handleSearch}
    >
      {/* 统一 4 列栅格（span 6×4）：五个筛选字段+三个时间范围在两行内同宽对齐，
          1920 及以下视口均不溢出（旧 5+4+4+5+5 排布在最右字段被视口裁切）；
          标签横排居左（视觉规范），104px 固定标签宽保证各行控件左缘对齐 */}
      <Row gutter={[12, 0]}>
        <Col span={6}>
          <Form.Item label={t('任务名称/编号')} name="query">
            <Input allowClear placeholder={t('任务名称/编号')} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('任务类型')} name="orderType">
            <Select
              allowClear
              placeholder={t('请选择任务类型')}
              options={ORDER_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }))}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('任务状态')} name="orderState">
            <Select
              allowClear
              placeholder={t('请选择任务状态')}
              options={ORDER_STATE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }))}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('任务车辆')} name="vehicleKey">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('请选择任务车辆')}
              loading={vehicles.loading}
              fieldNames={{ label: 'name', value: 'key' }}
              options={vehicles.options ?? []}
              notFoundContent={
                // 选项失败只呈现状态文本：视觉规范——非表格区域不设重试按钮
                vehicles.error ? tCommon('加载失败') : undefined
              }
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={[12, 0]}>
        <Col span={6}>
          <Form.Item label={t('创建时间')} name="createTime">
            <DatePicker.RangePicker
              allowEmpty={[true, true]}
              allowClear
              showTime={{ format: 'HH:mm' }}
              style={{ width: '100%' }}
              placeholder={[t('开始创建时间'), t('结束创建时间')]}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('执行时间')} name="executionTime">
            <DatePicker.RangePicker
              allowEmpty={[true, true]}
              allowClear
              showTime={{ format: 'HH:mm' }}
              style={{ width: '100%' }}
              placeholder={[t('执行开始时间'), t('执行结束时间')]}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('终止时间')} name="finalTime">
            <DatePicker.RangePicker
              allowEmpty={[true, true]}
              allowClear
              showTime={{ format: 'HH:mm' }}
              style={{ width: '100%' }}
              placeholder={[t('终止开始时间'), t('终止结束时间')]}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label=" ">
            {/* wrap：1366 视口下标签占宽后按钮组换行而非溢出（按钮可达优先于单行） */}
            <Space wrap size={8}>
              {/* 仅「创建任务」保留实心主按钮：查询是筛选动作，不与页面主 CTA 争夺层级 */}
              <Button htmlType="submit">
                {t('查询')}
              </Button>
              <Button onClick={handleReset}>{t('清空')}</Button>
              {/* 创建任务：无权限隐藏（按钮码 order-record:create） */}
              {canCreate ? <Button type="primary" onClick={onCreate}>{t('创建任务')}</Button> : null}
              <Button onClick={handleExport}>{t('导出Excel')}</Button>
            </Space>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  )
}
