/**
 * cron 周字段「第 N 个星期 M」控件（旧 FromToWhich 等价迁移）。
 * 生成片段形态 `N#M`（N=本月第几个星期 1-4，M=星期几 1-7，旧同取值域）；
 * 仅在周字段处于「第 N 个星期 M」模式时可编辑。
 */

import { InputNumber, Space, Typography } from 'antd'
import type { InputNumberProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_FIELD_INDEX,
  parseCronSegmentNumber,
  spliceCronSegment,
} from '@/features/mission-cluster/components/cron/cronConfig'

interface CronWeekWhichProps {
  /** 当前完整表达式（内部态，经 Popover 传入） */
  expression: string
  /** 当前选中的模式（=fromWhich 时才可编辑） */
  mode: string
  /** 片段更新回调（父级负责写回完整表达式） */
  triggerChange: (value: string) => void
}

export function CronWeekWhich({ expression, mode, triggerChange }: CronWeekWhichProps) {
  const { t } = useTranslation('orderFlow')
  const fieldIndex = CRON_FIELD_INDEX['周']

  /** 第几个星期变化：替换本段为 `value#原星期`（旧 onFromChange 同语义） */
  const handleWhichChange: InputNumberProps['onChange'] = (value) => {
    if (!expression || mode !== 'fromWhich' || value === null) return
    const segment = expression.split(' ')[fieldIndex] ?? ''
    const weekday = segment.split('#')?.[1]
    triggerChange(spliceCronSegment(expression, fieldIndex, `${value}#${weekday}`))
  }

  /** 星期几变化：替换本段为 `原第几个#value`（旧 onWhichChange 同语义） */
  const handleWeekdayChange: InputNumberProps['onChange'] = (value) => {
    if (!expression || mode !== 'fromWhich' || value === null) return
    const segment = expression.split(' ')[fieldIndex] ?? ''
    const which = segment.split('#')?.[0]
    triggerChange(spliceCronSegment(expression, fieldIndex, `${which}#${value}`))
  }

  const active = mode === 'fromWhich'
  const segment = expression.split(' ')[fieldIndex] ?? ''

  return (
    <Space size={4} wrap>
      <Typography.Text>{t('第')}</Typography.Text>
      <InputNumber
        placeholder={t('周')}
        min={1}
        max={4}
        precision={0}
        disabled={!active}
        value={active ? parseCronSegmentNumber(segment, '#', 0) : null}
        onChange={handleWhichChange}
      />
      <Typography.Text>{t('周，的星期')}</Typography.Text>
      <InputNumber
        placeholder={t('周几')}
        min={1}
        max={7}
        precision={0}
        disabled={!active}
        value={active ? parseCronSegmentNumber(segment, '#', 1) : null}
        onChange={handleWeekdayChange}
      />
    </Space>
  )
}
