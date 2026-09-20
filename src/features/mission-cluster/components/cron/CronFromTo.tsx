/**
 * cron 字段「范围」控件（旧 FromToInput 等价迁移）：从 a 到 b，每 X 执行一次。
 * 生成片段形态 `a-b`；仅在本字段处于「范围」模式时可编辑。
 */

import { InputNumber, Space, Typography } from 'antd'
import type { InputNumberProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_FIELD_INDEX,
  parseCronSegmentNumber,
  spliceCronSegment,
} from '@/features/mission-cluster/components/cron/cronConfig'

interface CronFromToProps {
  /** 字段名（CRON_FIELD_INDEX 查找键） */
  field: string
  min: number
  max: number
  /** 当前完整表达式（内部态，经 Popover 传入） */
  expression: string
  /** 当前选中的模式（=fromTo 时才可编辑） */
  mode: string
  /** 片段更新回调（父级负责写回完整表达式） */
  triggerChange: (value: string) => void
}

export function CronFromTo({ field, min, max, expression, mode, triggerChange }: CronFromToProps) {
  const { t } = useTranslation('orderFlow')
  const fieldIndex = CRON_FIELD_INDEX[field]

  /** 起始值变化：替换本段为 `value-原终点`（旧 onFromChange 同语义） */
  const handleFromChange: InputNumberProps['onChange'] = (value) => {
    if (!expression || mode !== 'fromTo' || value === null) return
    const segment = expression.split(' ')[fieldIndex] ?? ''
    const end = segment.split('-')?.[1]
    triggerChange(spliceCronSegment(expression, fieldIndex, `${value}-${end}`))
  }

  /** 结束值变化：替换本段为 `原起点-value`（旧 onToChange 同语义） */
  const handleToChange: InputNumberProps['onChange'] = (value) => {
    if (!expression || mode !== 'fromTo' || value === null) return
    const segment = expression.split(' ')[fieldIndex] ?? ''
    const start = segment.split('-')?.[0]
    triggerChange(spliceCronSegment(expression, fieldIndex, `${start}-${value}`))
  }

  const active = mode === 'fromTo'
  const segment = expression.split(' ')[fieldIndex] ?? ''

  return (
    <Space size={4} wrap>
      <Typography.Text>{t('从')}</Typography.Text>
      <InputNumber
        placeholder={t('起始值')}
        min={min}
        max={max}
        disabled={!active}
        value={active ? parseCronSegmentNumber(segment, '-', 0) : null}
        onChange={handleFromChange}
      />
      <Typography.Text>{t('到')}</Typography.Text>
      <InputNumber
        placeholder={t('结束值')}
        min={min}
        max={max}
        disabled={!active}
        value={active ? parseCronSegmentNumber(segment, '-', 1) : null}
        onChange={handleToChange}
      />
      <Typography.Text>{t('每{{text}}执行一次', { text: t(field) })}</Typography.Text>
    </Space>
  )
}
