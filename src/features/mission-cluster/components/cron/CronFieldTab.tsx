/**
 * cron 字段通用 Tab（旧 SecondTab/MinuteTab/HourTab/DayTab/MonthTab 五个近似
 * 组件的配置化等价合并）：单选在「每 X / 不指定(?) / 范围 / 步长 / 指定」间切换，
 * 切换即按旧同款默认片段生成表达式；各模式的取值域与默认值逐字段对齐旧实现。
 *
 * 与旧实现的逐点对照（等价性依据）：
 * - 秒：切「每秒」整表重置为 `* * * * * ?`（旧 case "*" 同款，其余字段不保留）；
 * - 分/小时/日/月：切换前先把目标位之前的 `*` 收敛为 `0`（旧 replaceToZero 同款），
 *   日/月额外提供「不指定 ?」；秒位之前无前置字段，收敛为空操作故仅整表重置；
 * - 范围/步长/指定的默认片段与取值域逐字段核对（秒 1-59/0-59、分 1-59/0-59、
 *   小时 0-23/0-23、日 1-31、月 1-12；默认片段 1-2、1/2、指定值秒/分/小时=0、
 *   日/月=1，旧 useRef 同值）。
 */

import { useState } from 'react'
import { Radio } from 'antd'
import type { RadioGroupProps } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_DEFAULT_EXPRESSION,
  CRON_FIELD_INDEX,
  collapseLeadingWildcards,
  spliceCronSegment,
} from '@/features/mission-cluster/components/cron/cronConfig'
import type { CronFieldConfig } from '@/features/mission-cluster/components/cron/cronConfig'
import { CronFromTo } from '@/features/mission-cluster/components/cron/CronFromTo'
import { CronFromToInterval } from '@/features/mission-cluster/components/cron/CronFromToInterval'
import { CronFromToCheckbox } from '@/features/mission-cluster/components/cron/CronFromToCheckbox'

interface CronFieldTabProps {
  config: CronFieldConfig
  /** 当前完整表达式（内部态，经 Popover 传入） */
  expression: string
  /** 片段更新回调（父级负责写回完整表达式并同步表单） */
  triggerChange: (value: string) => void
}

export function CronFieldTab({ config, expression, triggerChange }: CronFieldTabProps) {
  const { t } = useTranslation('orderFlow')

  // 当前选中的模式（旧 radioValue 同名状态；挂载默认「每 X」，不随表达式回显同步
  // ——旧实现同边界，表达式以触发行为准）
  const [mode, setMode] = useState<string>('*')

  const fieldIndex = CRON_FIELD_INDEX[config.field]

  /** 模式切换：先按需收敛前置通配，再写入该模式的默认片段（旧 onRadioChange 同款） */
  const handleModeChange: RadioGroupProps['onChange'] = (event) => {
    const nextMode = event.target.value as string
    setMode(nextMode)
    if (!expression) return
    // 旧 replaceToZero：目标位之前的 `*` 收敛为 `0`（秒位无前置字段不受影响）
    const collapsed = collapseLeadingWildcards(expression, fieldIndex)
    if (nextMode === '*') {
      // 旧 SecondTab 特例：「每秒」重置整表为默认全通配（周位 `?`）
      triggerChange(
        config.everyResetsAll
          ? CRON_DEFAULT_EXPRESSION
          : spliceCronSegment(collapsed, fieldIndex, '*'),
      )
      return
    }
    if (nextMode === '?') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, '?'))
      return
    }
    if (nextMode === 'fromTo') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, '1-2'))
      return
    }
    if (nextMode === 'fromInterval') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, '1/2'))
      return
    }
    if (nextMode === 'fromCheckbox') {
      triggerChange(spliceCronSegment(collapsed, fieldIndex, config.defaultCheckbox))
    }
  }

  return (
    <Radio.Group
      onChange={handleModeChange}
      value={mode}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <Radio value="*">{t(config.everyLabel)}</Radio>
      {config.supportUnspecified ? <Radio value="?">{t('不指定')}</Radio> : null}
      {config.supportRange ? (
        <Radio value="fromTo">
          <CronFromTo
            field={config.field}
            min={config.rangeMin}
            max={config.rangeMax}
            expression={expression}
            mode={mode}
            triggerChange={triggerChange}
          />
        </Radio>
      ) : null}
      <Radio value="fromInterval">
        <CronFromToInterval
          field={config.field}
          min={config.intervalMin}
          max={config.intervalMax}
          expression={expression}
          mode={mode}
          triggerChange={triggerChange}
        />
      </Radio>
      {/* 旧实现勾选行以 inline 布局嵌入（style display:inline 同款；Radio 行内容
          可换行容纳 600px 勾选组） */}
      <Radio value="fromCheckbox" style={{ display: 'inline', whiteSpace: 'normal' }}>
        <CronFromToCheckbox
          field={config.field}
          expression={expression}
          mode={mode}
          triggerChange={triggerChange}
        />
      </Radio>
    </Radio.Group>
  )
}
