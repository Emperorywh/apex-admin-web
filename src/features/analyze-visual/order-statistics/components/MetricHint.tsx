/**
 * 统计口径提示（P33 私有组件；形态参考旧 SPEC_metric_calculation_hint 的 InfoHint：
 * 图标 + Tooltip 展示计算公式与口径说明）。
 *
 * - 图标用 lucide CircleHelp（目标项目图标体系，不引入 @ant-design/icons）；
 * - 键盘可达：外层 span tabIndex=0，聚焦/失焦受控 Tooltip open（鼠标 hover 由
 *   Tooltip 原生处理，两者叠加不冲突——旧无障碍设计同款）；
 * - 内容由调用方传入已翻译 ReactNode，本组件不持有文案。
 */

import { useState } from 'react'
import { Tooltip } from 'antd'
import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from '@/features/analyze-visual/order-statistics/components/MetricHint.module.css'

interface MetricHintProps {
  /** 口径说明（已本地化）；不传则不渲染图标 */
  content?: ReactNode
  /** 图标的可访问名称（已本地化，读屏用） */
  label: string
}

export function MetricHint({ content, label }: MetricHintProps) {
  const [focused, setFocused] = useState(false)
  if (!content) return null

  return (
    <Tooltip
      placement="bottom"
      // 长口径文案自动换行，宽度约束由样式层 overlayInnerStyle 等价承担
      overlayInnerStyle={{ maxWidth: 320 }}
      mouseEnterDelay={0.2}
      open={focused ? true : undefined}
      onOpenChange={(open) => {
        // 键盘聚焦期间强制展示；失焦后交还鼠标行为
        if (!open && focused) setFocused(false)
      }}
      title={content}
    >
      {/* role/aria-label：读屏可感知这是一个可查看说明的按钮语义 */}
      <span
        className={styles.trigger}
        tabIndex={0}
        role="button"
        aria-label={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <CircleHelp size={13} strokeWidth={2} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
