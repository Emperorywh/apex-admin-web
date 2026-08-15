/**
 * 演示模式常驻 Badge（规格 §13.2）：demo 会话期间在 Header 显示「演示模式」标识。
 * - 显示条件：sessionSource === demo（fallback 切换或 force 归一后的 demo 会话）；
 *   force 构建下所有请求由 demo adapter 承载，会话语义等同 demo；
 * - 常驻展示、不可关闭；非 demo 会话渲染 null；
 * - 本组件位于可整体剔除的 src/features/demo/（规格 §13.3），Header 以静态条件 + 动态 import 挂接。
 */
import { Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { SESSION_SOURCES } from '@/constants/auth/auth.constants'
import { COMMON_NAMESPACE } from '@/i18n/i18n'
import type { RootState } from '@/store/store'

export function DemoBadge() {
  const { t } = useTranslation()
  const sessionSource = useSelector((state: RootState) => state.user.sessionSource)
  // force 构建下全部请求由 demo adapter 承载（规格 §13.1），会话按 demo 语义标识
  const isDemoSession =
    sessionSource === SESSION_SOURCES.DEMO || import.meta.env.VITE_DEMO_MODE === 'force'
  if (!isDemoSession) {
    return null
  }
  return (
    <Tag color="warning" aria-label={t('演示模式', { ns: COMMON_NAMESPACE })}>
      {t('演示模式', { ns: COMMON_NAMESPACE })}
    </Tag>
  )
}
