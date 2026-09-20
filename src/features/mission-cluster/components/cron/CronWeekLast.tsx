/**
 * cron 周字段「本月最后一个星期 N」控件（旧 FromToLast 等价迁移）。
 * 生成片段形态 `NL`（L=最后一天语义，N=星期几 1-7，旧同取值域）；
 * 仅在周字段处于「最后一个星期 N」模式时可编辑。
 */

import { InputNumber, Space, Typography } from 'antd'
import type { InputNumberProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_FIELD_INDEX,
  parseCronSegmentNumber,
  spliceCronSegment,
} from '@/features/mission-cluster/components/cron/cronConfig'

interface CronWeekLastProps {
  /** 当前完整表达式（内部态，经 Popover 传入） */
  expression: string
  /** 当前选中的模式（=fromLast 时才可编辑） */
  mode: string
  /** 片段更新回调（父级负责写回完整表达式） */
  triggerChange: (value: string) => void
}

export function CronWeekLast({ expression, mode, triggerChange }: CronWeekLastProps) {
  const { t } = useTranslation('orderFlow')
  const fieldIndex = CRON_FIELD_INDEX['周']

  /** 星期几变化：替换本段为 `valueL`（旧 onLastChange 同语义） */
  const handleLastChange: InputNumberProps['onChange'] = (value) => {
    if (!expression || mode !== 'fromLast' || value === null) return
    triggerChange(spliceCronSegment(expression, fieldIndex, `${value}L`))
  }

  const active = mode === 'fromLast'
  const segment = expression.split(' ')[fieldIndex] ?? ''

  return (
    <Space size={4} wrap>
      <Typography.Text>{t('本月最后一个星期')}</Typography.Text>
      <InputNumber
        placeholder={t('请输入周几')}
        min={1}
        max={7}
        precision={0}
        disabled={!active}
        value={active ? parseCronSegmentNumber(segment, 'L', 0) : null}
        onChange={handleLastChange}
      />
    </Space>
  )
}
