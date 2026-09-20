/**
 * cron 字段「步长」控件（旧 FromToInterval 等价迁移）：从 X 开始，每 Y 执行一次。
 * 生成片段形态 `X/Y`；仅在本字段处于「步长」模式时可编辑。
 */

import { InputNumber, Space, Typography } from 'antd'
import type { InputNumberProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_FIELD_INDEX,
  parseCronSegmentNumber,
  spliceCronSegment,
} from '@/features/mission-cluster/components/cron/cronConfig'

interface CronFromToIntervalProps {
  /** 字段名（CRON_FIELD_INDEX 查找键） */
  field: string
  min: number
  max: number
  /** 当前完整表达式（内部态，经 Popover 传入） */
  expression: string
  /** 当前选中的模式（=fromInterval 时才可编辑） */
  mode: string
  /** 片段更新回调（父级负责写回完整表达式） */
  triggerChange: (value: string) => void
}

export function CronFromToInterval({
  field,
  min,
  max,
  expression,
  mode,
  triggerChange,
}: CronFromToIntervalProps) {
  const { t } = useTranslation('orderFlow')
  const fieldIndex = CRON_FIELD_INDEX[field]

  /** 起始值变化：替换本段为 `value/原步长`（旧 onFromChange 同语义） */
  const handleFromChange: InputNumberProps['onChange'] = (value) => {
    if (!expression || value === null) return
    const segment = expression.split(' ')[fieldIndex] ?? ''
    const step = segment.split('/')?.[1]
    triggerChange(spliceCronSegment(expression, fieldIndex, `${value}/${step}`))
  }

  /** 步长值变化：替换本段为 `原起始/value`（旧 onIntervalChange 同语义） */
  const handleIntervalChange: InputNumberProps['onChange'] = (value) => {
    if (!expression || value === null) return
    const segment = expression.split(' ')[fieldIndex] ?? ''
    const start = segment.split('/')?.[0]
    triggerChange(spliceCronSegment(expression, fieldIndex, `${start}/${value}`))
  }

  const active = mode === 'fromInterval'
  const segment = expression.split(' ')[fieldIndex] ?? ''

  return (
    <Space size={4} wrap>
      <Typography.Text>{t('从')}</Typography.Text>
      <InputNumber
        placeholder={t('起始值')}
        min={min}
        max={max}
        disabled={!active}
        value={active ? parseCronSegmentNumber(segment, '/', 0) : null}
        onChange={handleFromChange}
      />
      <Typography.Text>{t('{{text}}开始，每', { text: t(field) })}</Typography.Text>
      <InputNumber
        placeholder={t('间隔值')}
        min={min}
        max={max}
        disabled={!active}
        value={active ? parseCronSegmentNumber(segment, '/', 1) : null}
        onChange={handleIntervalChange}
      />
      <Typography.Text>{t('{{text}}执行一次', { text: t(field) })}</Typography.Text>
    </Space>
  )
}
