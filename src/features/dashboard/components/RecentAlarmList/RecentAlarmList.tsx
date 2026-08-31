/**
 * RecentAlarmList：最新告警列表（级别胶囊 + 消息 + 车辆/代码 + 时间，单行布局）。
 */

import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import type { AlarmLevel, RecentAlarmItem } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/RecentAlarmList/RecentAlarmList.module.css'

/** 告警级别 → 文案 key 与色调 */
const LEVEL_META: Record<AlarmLevel, { label: string; toneClass: string }> = {
  ERROR: { label: '严重', toneClass: 'pillError' },
  WARN: { label: '警告', toneClass: 'pillWarn' },
  INFO: { label: '提示', toneClass: 'pillInfo' },
}

interface RecentAlarmListProps {
  alarms: RecentAlarmItem[]
}

export function RecentAlarmList({ alarms }: RecentAlarmListProps) {
  const { t } = useTranslation('dashboard')

  if (alarms.length === 0) {
    return (
      <div className={styles.empty}>
        <TriangleAlert size={20} strokeWidth={2} />
        <span>{t('暂无告警')}</span>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {alarms.map((alarm) => {
        const meta = LEVEL_META[alarm.level]
        return (
          <li key={alarm.id} className={styles.row}>
            <span className={`${styles.pill} ${styles[meta.toneClass]}`}>{t(meta.label)}</span>
            <span className={styles.message} title={alarm.message}>
              {alarm.message}
            </span>
            <span className={styles.who} title={`${alarm.vehicleName} · ${alarm.alarmCode}`}>
              {alarm.vehicleName} · {alarm.alarmCode}
            </span>
            <span className={styles.time}>{alarm.raisedAt.slice(11)}</span>
          </li>
        )
      })}
    </ul>
  )
}
