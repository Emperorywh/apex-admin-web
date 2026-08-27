/**
 * 实时事件面板：演示推送流；页面隐藏（Activity hidden）时自动暂停定时器，
 * 重新激活后恢复——展示 usePageActive 的 DOM 型副作用治理（SPEC §5.2）。
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Pause, Play } from 'lucide-react'
import { usePageActive } from '@/hooks/usePageActive'
import { pushDemoEvent } from '@/services/dashboard/dashboard.service'
import type { EventItem, EventLevel } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/EventFeedPanel/EventFeedPanel.module.css'

interface EventFeedPanelProps {
  initialEvents: EventItem[]
}

/** 实时事件流演示刷新间隔（毫秒） */
const EVENT_FEED_PUSH_INTERVAL_MS = 6_000

/** 实时事件流在页面保留的最大条数（容量，条） */
const EVENT_FEED_MAX_ITEMS = 8

/** 级别 → 标签类 */
const LEVEL_CLASS: Record<EventLevel, string> = {
  info: 'ds-tag ds-tag-green',
  warn: 'ds-tag ds-tag-orange',
  error: 'ds-tag ds-tag-red',
}

const LEVEL_LABEL: Record<EventLevel, string> = {
  info: '信息',
  warn: '预警',
  error: '错误',
}

export function EventFeedPanel({ initialEvents }: EventFeedPanelProps) {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { isActive } = usePageActive()
  const [events, setEvents] = useState<EventItem[]>(initialEvents)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  /* 演示推送：页面激活且未暂停时定时插入新事件 */
  useEffect(() => {
    if (!isActive || paused) return
    const timer = setInterval(() => {
      void pushDemoEvent()
        .then((item) => {
          setEvents((prev) => [item, ...prev].slice(0, EVENT_FEED_MAX_ITEMS))
        })
        .catch(() => {
          // 演示推送失败静默忽略
        })
    }, EVENT_FEED_PUSH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isActive, paused])

  return (
    <div className={styles.side}>
      <div className={styles.head}>
        <div className={styles.title}>{t('实时事件')}</div>
        <div className={styles.actions}>
          <button type="button" className="ds-control" onClick={() => setPaused((prev) => !prev)}>
            {paused ? <Play size={15} /> : <Pause size={15} />}
            <span>{paused ? tCommon('恢复') : tCommon('全部事件')}</span>
          </button>
        </div>
      </div>
      <div className={styles.list} style={{ opacity: paused ? 0.58 : 1 }}>
        {events.map((event) => (
          <div key={event.id} className={styles.event}>
            <div className={styles.time}>{event.time}</div>
            <div className={styles.main}>
              <strong>{t(event.title)}</strong>
              {event.lines.map((line) => (
                <span key={line}>{t(line)}</span>
              ))}
            </div>
            <div className={LEVEL_CLASS[event.level]}>{t(LEVEL_LABEL[event.level])}</div>
          </div>
        ))}
      </div>
      <button type="button" className={styles.ghost} onClick={() => setPaused((prev) => !prev)}>
        {t('查看全部事件')} <ArrowRight size={15} />
      </button>
    </div>
  )
}
