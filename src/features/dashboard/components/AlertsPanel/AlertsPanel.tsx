/**
 * 最近告警面板：级别 / 内容 / 影响对象 / 时间 / 状态（复刻设计稿）。
 */

import { useTranslation } from 'react-i18next'
import type { AlertItem, AlertSeverity } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/AlertsPanel/AlertsPanel.module.css'

interface AlertsPanelProps {
  alerts: AlertItem[]
  /** 未处理告警总数 */
  pendingCount: number
}

/** 级别 → 胶囊类 */
const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  P1: 'ds-pill ds-pill-red',
  P2: 'ds-pill ds-pill-orange',
  P3: 'ds-pill ds-pill-yellow',
}

/** 级别 → 图标颜色 */
const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  P1: '#e5484d',
  P2: '#e8860c',
  P3: '#e8860c',
}

function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  const color = SEVERITY_COLOR[severity]
  return (
    <svg className={styles.warnIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l9 16H3L12 3z" fill={color} />
      <circle cx="12" cy="14" r="1.2" fill="#fff" />
      <path d="M12 8v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function AlertsPanel({ alerts, pendingCount }: AlertsPanelProps) {
  const { t } = useTranslation('dashboard')

  return (
    <div className="ds-card ds-card-p">
      <div className={styles.head}>
        <div className="ds-card-title">{t('最近告警')}</div>
        <a
          href="#"
          className="ds-red-link"
          onClick={(event) => {
            event.preventDefault()
          }}
        >
          {pendingCount} {t('条未处理')} <span className={styles.caret}>›</span>
        </a>
      </div>
      <div className={styles.tableHead}>
        <div>{t('级别')}</div>
        <div>{t('告警内容')}</div>
        <div>{t('影响对象')}</div>
        <div>{t('首次发生')}</div>
        <div>{t('状态')}</div>
      </div>
      {alerts.map((alert) => (
        <div key={alert.id} className={styles.row}>
          <div className={styles.sev}>
            <SeverityIcon severity={alert.severity} />
          </div>
          <div>
            <strong>{t(alert.title)}</strong>
            <span>{t(alert.detail)}</span>
          </div>
          <div>
            <small>{t(alert.target)}</small>
          </div>
          <div>
            <small>{alert.occurredAt}</small>
          </div>
          <div>
            <span className={SEVERITY_CLASS[alert.severity]}>{alert.severity}</span>
          </div>
        </div>
      ))}
      <div className={styles.footer}>
        <a
          href="#"
          className="ds-link"
          style={{ color: '#7c88a0' }}
          onClick={(event) => {
            event.preventDefault()
          }}
        >
          {t('查看全部告警')} →
        </a>
      </div>
    </div>
  )
}
