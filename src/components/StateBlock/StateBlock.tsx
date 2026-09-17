/**
 * 统一状态块（T00.5 表格公共设施，DoD 3/6 的状态区分要求）。
 *
 * 独立组件：不包裹 ApexTableReact——表格区域因失败/权限/缺口无法出数据时，
 * 页面用它替换表格或叠加在数据区上方，自行决定呈现位置。
 *
 * 三个语义变体对应三类必须与「真实空数据」区分的状态（禁止空数组冒充成功）：
 * - noPermission：已登录但无该数据/操作的权限（区别于接口失败）；
 * - gap：接口能力确认缺失/暂缓，操作被禁用并展示原因（G 缺口登记的页面呈现）；
 * - offline：请求真正失败，远端区域已清空，提供显式重试（onRetry 存在才出按钮）。
 *
 * 文案走 i18next common 命名空间（key 即中文）；description 可传自定义
 * 已翻译内容覆盖默认值（如具体缺口原因）。
 */

import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { Button } from 'antd'
import { CircleSlash, CloudOff, ShieldOff } from 'lucide-react'
import styles from '@/components/StateBlock/StateBlock.module.css'

export type StateBlockVariant = 'noPermission' | 'gap' | 'offline'

interface StateBlockProps {
  /** 状态语义：决定图标与默认文案 */
  variant: StateBlockVariant
  /** 补充说明（需已翻译）；不传时用该语义的默认说明 */
  description?: ReactNode
  /** 失败重试回调；仅 offline 且提供该回调时渲染重试按钮 */
  onRetry?: () => void
  /** 覆盖重试按钮文案（common 中文 key），默认「重新加载」 */
  retryLabel?: string
  /** 块最小高度，默认自适应（表格内嵌场景通常由容器决定） */
  minHeight?: number | string
}

/** 各语义的图标与默认文案 key（common 命名空间中文 key） */
const VARIANT_PRESETS: Record<
  StateBlockVariant,
  { icon: typeof ShieldOff; titleKey: string; descriptionKey: string }
> = {
  noPermission: {
    icon: ShieldOff,
    titleKey: '暂无访问权限',
    descriptionKey: '当前账号没有查看此内容的权限，请联系管理员开通',
  },
  gap: {
    icon: CircleSlash,
    titleKey: '该功能暂不可用',
    descriptionKey: '所需接口能力尚未就绪，相关操作已禁用',
  },
  offline: {
    icon: CloudOff,
    titleKey: '加载失败',
    descriptionKey: '无法获取数据，请检查网络或服务状态后重试',
  },
}

export function StateBlock({ variant, description, onRetry, retryLabel, minHeight }: StateBlockProps) {
  const { t } = useTranslation('common')
  const preset = VARIANT_PRESETS[variant]
  const Icon = preset.icon

  return (
    // role/status + aria-live：状态变化对读屏可感知（表格错误态的可访问性底线）
    <div className={styles.wrap} style={minHeight !== undefined ? { minHeight } : undefined} role="status">
      <span className={styles.icon} aria-hidden="true">
        <Icon size={22} strokeWidth={2} />
      </span>
      <p className={styles.title}>{t(preset.titleKey)}</p>
      <p className={styles.description}>{description ?? t(preset.descriptionKey)}</p>
      {/* 重试是显式用户动作：不自动重发失败请求（写操作不自动重试的同一纪律） */}
      {variant === 'offline' && onRetry ? (
        <Button size="small" onClick={onRetry}>
          {retryLabel ? t(retryLabel) : t('重新加载')}
        </Button>
      ) : null}
    </div>
  )
}
