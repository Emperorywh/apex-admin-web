/**
 * cron 周字段 Tab（旧 WeekTab 等价迁移）。
 *
 * 与通用字段（CronFieldTab）的差异点（逐项对照旧 WeekTab）：
 * - 无「范围 a-b」选项；「步长」取值域 1-7（每几周的星期语义，旧同款）；
 * - 额外提供「第 N 个星期 M（N#M）」与「本月最后一个星期 N（NL）」两个扩展模式，
 *   默认片段分别为 `1#1` 与 `1L`（旧 useRef 同值）；
 * - 「每周 / 不指定 ?」与其他模式切换前同样把目标位之前的 `*` 收敛为 `0`
 *   （旧 replaceToZero 同款）；表达式为空时不触发（旧 `if (!cronValue) return` 同款）。
 */

import { useState } from 'react'
import { Radio } from 'antd'
import type { RadioGroupProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_FIELD_INDEX,
  collapseLeadingWildcards,
  spliceCronSegment,
} from '@/features/mission-cluster/components/cron/cronConfig'
import { CronFromToInterval } from '@/features/mission-cluster/components/cron/CronFromToInterval'
import { CronFromToCheckbox } from '@/features/mission-cluster/components/cron/CronFromToCheckbox'
import { CronWeekWhich } from '@/features/mission-cluster/components/cron/CronWeekWhich'
import { CronWeekLast } from '@/features/mission-cluster/components/cron/CronWeekLast'

interface CronWeekTabProps {
  /** 当前完整表达式（内部态，经 Popover 传入） */
  expression: string
  /** 片段更新回调（父级负责写回完整表达式并同步表单） */
  triggerChange: (value: string) => void
}

export function CronWeekTab({ expression, triggerChange }: CronWeekTabProps) {
  const { t } = useTranslation('orderFlow')

  // 当前选中的模式（挂载默认「每周」，不随表达式回显同步——旧实现同边界）
  const [mode, setMode] = useState<string>('*')
  const fieldIndex = CRON_FIELD_INDEX['周']

  /** 模式切换：收敛前置通配后写入该模式默认片段（旧 onRadioChange 同款） */
  const handleModeChange: RadioGroupProps['onChange'] = (event) => {
    const nextMode = event.target.value as string
    setMode(nextMode)
    if (!expression) return
    // 旧 replaceToZero：周位之前的 `*` 收敛为 `0`
    const collapsed = collapseLeadingWildcards(expression, fieldIndex)
    if (nextMode === '*' || nextMode === '?') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, nextMode))
      return
    }
    if (nextMode === 'fromInterval') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, '1/2'))
      return
    }
    if (nextMode === 'fromWhich') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, '1#1'))
      return
    }
    if (nextMode === 'fromLast') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, '1L'))
      return
    }
    if (nextMode === 'fromCheckbox') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, '1'))
    }
  }

  return (
    <Radio.Group
      onChange={handleModeChange}
      value={mode}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <Radio value="*">{t('每周')}</Radio>
      <Radio value="?">{t('不指定')}</Radio>
      <Radio value="fromInterval">
        <CronFromToInterval
          field="周"
          min={1}
          max={7}
          expression={expression}
          mode={mode}
          triggerChange={triggerChange}
        />
      </Radio>
      <Radio value="fromWhich">
        <CronWeekWhich expression={expression} mode={mode} triggerChange={triggerChange} />
      </Radio>
      <Radio value="fromLast">
        <CronWeekLast expression={expression} mode={mode} triggerChange={triggerChange} />
      </Radio>
      {/* 旧实现勾选行以 inline 布局嵌入（同通用字段行） */}
      <Radio value="fromCheckbox" style={{ display: 'inline', whiteSpace: 'normal' }}>
        <CronFromToCheckbox
          field="周"
          expression={expression}
          mode={mode}
          triggerChange={triggerChange}
        />
      </Radio>
    </Radio.Group>
  )
}
