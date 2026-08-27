/**
 * 仪表盘页头：标题 + 系统状态 + 时间范围胶囊 + 刷新按钮（复刻设计稿 page-header）。
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown } from 'antd'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { DASHBOARD_RANGE_OPTIONS, type DashboardRange } from '@/constants/dashboard/dashboard.constants'
import styles from '@/features/dashboard/components/DashboardHeader/DashboardHeader.module.css'

interface DashboardHeaderProps {
  refreshing: boolean
  onRefresh: () => void
}

export function DashboardHeader({ refreshing, onRefresh }: DashboardHeaderProps) {
  const { t } = useTranslation('dashboard')
  const [range, setRange] = useState<DashboardRange>(DASHBOARD_RANGE_OPTIONS[0])

  return (
    <div className={styles.header}>
      <div className={styles.titleWrap}>
        <h1 className={styles.title}>{t('运营总览')}</h1>
        <div className={styles.systemOk}>
          <span className={styles.dot} />
          <span>{t('系统运行正常')}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <Dropdown
          trigger={['click']}
          menu={{
            selectable: true,
            selectedKeys: [range],
            items: DASHBOARD_RANGE_OPTIONS.map((option) => ({ key: option, label: t(option) })),
            onClick: ({ key }) => setRange(key as DashboardRange),
          }}
        >
          <button type="button" className="ds-control">
            <span>{t(range)}</span>
            <ChevronDown size={14} />
          </button>
        </Dropdown>
        <button type="button" className="ds-control" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? styles.spinning : undefined} />
          <span>{t('刷新')}</span>
        </button>
      </div>
    </div>
  )
}
