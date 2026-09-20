/**
 * cron 字段「指定」控件（旧 FromToChecbox 等价迁移）：勾选具体值集合。
 * 生成片段形态 `v1,v2,...`（顺序按控件值序，不按勾选序——旧 Checkbox.Group 同形）；
 * 仅在本字段处于「指定」模式时可编辑与解析，其余模式禁用并显示空集合。
 */

import { useMemo } from 'react'
import { Checkbox, Space, Typography } from 'antd'
import type { GetProp } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  CRON_FIELD_INDEX,
  buildCronCheckboxOptions,
  spliceCronSegment,
} from '@/features/mission-cluster/components/cron/cronConfig'

interface CronFromToCheckboxProps {
  /** 字段名（CRON_FIELD_INDEX 查找键） */
  field: string
  /** 当前完整表达式（内部态，经 Popover 传入） */
  expression: string
  /** 当前选中的模式（=fromCheckbox 时才可编辑与解析） */
  mode: string
  /** 片段更新回调（父级负责写回完整表达式） */
  triggerChange: (value: string) => void
}

export function CronFromToCheckbox({ field, expression, mode, triggerChange }: CronFromToCheckboxProps) {
  const { t } = useTranslation('orderFlow')
  const fieldIndex = CRON_FIELD_INDEX[field]

  // 选项集合只随字段切换（旧 useMemo([text]) 同口径）
  const options = useMemo(() => buildCronCheckboxOptions(field), [field])

  /** 勾选变化：本段替换为逗号连接的值集合（旧 onCheckboxChange 同语义） */
  const handleCheckboxChange: GetProp<typeof Checkbox.Group, 'onChange'> = (checkedValues) => {
    if (!expression || mode !== 'fromCheckbox') return
    triggerChange(spliceCronSegment(expression, fieldIndex, checkedValues.join(',')))
  }

  const active = mode === 'fromCheckbox'

  return (
    <Space direction="vertical" size={4}>
      <Typography.Text>{t('指定')}</Typography.Text>
      <Checkbox.Group
        style={{ width: 600 }}
        disabled={!active}
        /*
         * 仅在「指定」模式下解析本字段片段；表达式可能缺段（下标越界），
         * 以 ?? '' 兜底避免 undefined.split 异常——其余模式组件已禁用，
         * 传空数组即可（旧实现同款兜底）。
         */
        value={
          active
            ? (expression.split(' ')[fieldIndex] ?? '').split(',')
            : []
        }
        options={options}
        onChange={handleCheckboxChange}
      />
    </Space>
  )
}
