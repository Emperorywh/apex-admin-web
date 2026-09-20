/**
 * 故障明细筛选表单（P36 私有；旧明细筛选区等价迁移，P03 OrderSearchForm 栅格形态）。
 *
 * 交互契约：
 * - Form 值即编辑中的草稿：点「查询」才整体应用为查询条件（onFinish 提交），
 *   避免文本输入逐字符触发请求；「重置」清空草稿并立即按空条件回首页查询；
 * - 常用条件平铺（级别/类型/来源/状态/告警码），其余收进「更多筛选」折叠区
 *   （来源标识/来源名称/关联任务/发生时间范围/恢复时间范围，旧实现同边界）；
 * - 表单纪律（AGENTS §3）：horizontal 标签居左、colon=false、
 *   labelCol 固定 104px、wrapper 弹性基准 0 且禁用 min-width:auto；
 * - 状态筛选三态映射：未处理 → isClosed=false、已关闭 → isClosed=true、
 *   全部 → 不传（false 是有效筛选值，转换层不得用 `|| undefined` 兜底）；
 * - 级别/来源直接以协议枚举为值（旧实现的领域值二次映射不再保留）。
 *
 * 类型动态选项：接口无类型字典，由页面层从已加载记录的 alarmType 累计去重
 * （取并集随翻页逐步补全），本组件仅展示。
 */

import { useMemo, useState } from 'react'
import { Button, Col, DatePicker, Form, Input, Row, Select, Space } from 'antd'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FaultDetailFilterValues } from '@/features/analyze-visual/fault-alert/filterModel'
import { FILTER_DATE_TIME_FORMAT } from '@/features/analyze-visual/fault-alert/filterModel'
import styles from '@/features/analyze-visual/fault-alert/components/FaultDetailFilter.module.css'

/** 空草稿/时间格式/草稿→协议参数的纯函数见 filterModel.ts（与组件分离的 fast-refresh 纪律） */

interface FaultDetailFilterProps {
  /** 类型动态选项（页面层从已加载记录累计去重，原文展示） */
  alarmTypeOptions: string[]
  /** 查询提交中（按钮 loading；查询期间允许继续编辑草稿） */
  searching?: boolean
  /** 提交草稿（已通过 antd Form 校验；时间范围为 Dayjs 原值） */
  onSearch: (values: FaultDetailFilterValues) => void
  /** 重置（表单内部清空草稿，页面层同步回首页查询） */
  onReset: () => void
}

export function FaultDetailFilter({
  alarmTypeOptions,
  searching,
  onSearch,
  onReset,
}: FaultDetailFilterProps) {
  const { t } = useTranslation('report-fault')
  const [form] = Form.useForm<FaultDetailFilterValues>()
  // 「更多筛选」折叠区显隐（旧实现同交互：默认收起）
  const [moreVisible, setMoreVisible] = useState(false)

  // 类型下拉选项：全部 + 动态去重集合（原文 value/label，后端自由字符串不翻译）
  const alarmTypeSelectOptions = useMemo(
    () => [
      { value: '', label: t('全部类型') },
      ...alarmTypeOptions.map((type) => ({ value: type, label: type })),
    ],
    [alarmTypeOptions, t],
  )

  return (
    <Form<FaultDetailFilterValues>
      form={form}
      layout="horizontal"
      colon={false}
      labelCol={{ flex: '0 0 104px' }}
      wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}
      onFinish={(values) => onSearch(values)}
      className={styles.form}
    >
      <Row gutter={[12, 0]}>
        <Col span={6}>
          <Form.Item label={t('告警级别')} name="alarmLevel">
            <Select
              allowClear
              placeholder={t('全部级别')}
              options={[
                { value: 'FATAL', label: t('严重') },
                { value: 'WARNING', label: t('重要') },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('告警类型')} name="alarmType">
            {/* 类型为后端自由字符串：showSearch 按选项文本过滤，原文提交 */}
            <Select
              showSearch
              optionFilterProp="label"
              allowClear
              placeholder={t('全部类型')}
              options={alarmTypeSelectOptions}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('告警来源')} name="sourceType">
            <Select
              allowClear
              placeholder={t('全部来源')}
              options={[
                { value: 'VEHICLE', label: t('车辆') },
                { value: 'DEVICE', label: t('设备') },
                { value: 'SERVER', label: t('服务器') },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('关闭状态')} name="closedState">
            <Select
              allowClear
              placeholder={t('全部状态')}
              options={[
                { value: 'open', label: t('未处理') },
                { value: 'closed', label: t('已关闭') },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={t('告警码')} name="alarmCode">
            <Input allowClear placeholder={t('请输入告警码')} onPressEnter={() => form.submit()} />
          </Form.Item>
        </Col>
        {/* 操作按钮组：Space wrap 保证 1366 视口标签占宽后按钮换行而非溢出 */}
        <Col span={18}>
          <Form.Item label=" " className={styles.actions}>
            <Space wrap>
              <Button type="primary" loading={searching} onClick={() => form.submit()}>
                {t('查询')}
              </Button>
              <Button
                onClick={() => {
                  // 重置：清空全部草稿并通知页面按空条件回首页查询
                  form.resetFields()
                  onReset()
                }}
              >
                {t('重置')}
              </Button>
              <Button type="link" onClick={() => setMoreVisible((visible) => !visible)}>
                {moreVisible ? t('收起筛选') : t('更多筛选')}
                {moreVisible ? (
                  <ChevronUp size={14} aria-hidden="true" />
                ) : (
                  <ChevronDown size={14} aria-hidden="true" />
                )}
              </Button>
            </Space>
          </Form.Item>
        </Col>
      </Row>
      {moreVisible && (
        <Row gutter={[12, 0]}>
          <Col span={6}>
            <Form.Item label={t('来源标识')} name="sourceKey">
              <Input allowClear placeholder={t('请输入来源标识')} onPressEnter={() => form.submit()} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={t('来源名称')} name="sourceName">
              <Input allowClear placeholder={t('请输入来源名称')} onPressEnter={() => form.submit()} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={t('关联任务')} name="orderKey">
              <Input allowClear placeholder={t('请输入关联任务')} onPressEnter={() => form.submit()} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={t('发生时间')} name="startTimeRange">
              <DatePicker.RangePicker
                showTime
                format={FILTER_DATE_TIME_FORMAT}
                placeholder={[t('开始时间'), t('结束时间')]}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={t('恢复时间')} name="endTimeRange">
              <DatePicker.RangePicker
                showTime
                format={FILTER_DATE_TIME_FORMAT}
                placeholder={[t('开始时间'), t('结束时间')]}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
    </Form>
  )
}
