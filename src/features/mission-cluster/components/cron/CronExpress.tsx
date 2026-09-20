/**
 * cron 时间表达式输入控件（旧 FlowModal/CronExpress 等价迁移，受控表单控件）：
 * 文本框直接编辑 + 「表达式」按钮打开六段构建器 Popover。
 *
 * 与旧实现的等价性边界（逐点核对）：
 * - 内部 expression 态仅在构建器触发变更时同步（旧 triggerChange 同款）；
 *   手动输入只经 onChange 写回表单、不回写内部态——手动编辑后再打开构建器，
 *   构建器仍以内部态为基底（旧同边界，不擅自改语义）；
 * - 表单值为空时输入框显示内部态默认值 `* * * * * ?`（旧 `value || cronValue`
 *   同款），该默认串不会自动提交为表单值，用户必须显式输入或经构建器生成；
 * - 不推算「下一次执行时间」：部署时区与调度器语义在后端，未确认不展示猜测
 *   （P21 专项验收纪律）。
 */

import { useState } from 'react'
import { Button, Input, Popover } from 'antd'
import { Table2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CRON_DEFAULT_EXPRESSION } from '@/features/mission-cluster/components/cron/cronConfig'
import { CronTabs } from '@/features/mission-cluster/components/cron/CronTabs'

interface CronExpressProps {
  /** antd Form 注入的受控值（可空：未编辑时展示内部默认表达式） */
  value?: string
  /** antd Form 注入的变更回调 */
  onChange?: (value: string) => void
}

export function CronExpress({ value, onChange }: CronExpressProps) {
  const { t } = useTranslation('orderFlow')

  // 构建器基底表达式（内部态；仅构建器交互时同步，旧 cronValue 同边界）
  const [expression, setExpression] = useState<string>(CRON_DEFAULT_EXPRESSION)

  /** 构建器触发变更：同步内部态 + 写回表单（旧 triggerChange 同款） */
  const triggerChange = (next: string) => {
    setExpression(next)
    onChange?.(next)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Input
        style={{ flex: 1, minWidth: 0 }}
        value={value || expression}
        placeholder={t('请选择时间表达式')}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {/* 触发方式保持旧默认 hover（旧 Popover 未设 trigger 同款） */}
      <Popover
        content={<CronTabs expression={expression} triggerChange={triggerChange} />}
      >
        <Button type="primary" icon={<Table2 size={14} />}>
          {t('表达式')}
        </Button>
      </Popover>
    </div>
  )
}
