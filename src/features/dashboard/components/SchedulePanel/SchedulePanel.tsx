/**
 * 日程 / 待办面板：迷你月历（dayjs 计算）+ 今日待办（复刻设计稿）。
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import type { SchedulePanelModel } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/SchedulePanel/SchedulePanel.module.css'

interface SchedulePanelProps {
  model: SchedulePanelModel
}

export function SchedulePanel({ model }: SchedulePanelProps) {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')

  /** 计算当月日历网格：前置补齐 + 后置补齐，共整周 */
  const calendarCells = useMemo(() => {
    const first = dayjs(`${model.year}-${String(model.month).padStart(2, '0')}-01`)
    const daysInMonth = first.daysInMonth()
    const lead = first.day()
    const cells: Array<{ day: number; dim: boolean }> = []
    for (let i = 0; i < lead; i += 1) cells.push({ day: first.subtract(lead - i, 'day').date(), dim: true })
    for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day, dim: false })
    let tail = 1
    while (cells.length % 7 !== 0) {
      cells.push({ day: first.add(1, 'month').date(tail).date(), dim: true })
      tail += 1
    }
    return cells
  }, [model.year, model.month])

  const weekdayHeads = useMemo(
    () =>
      dayjs.locale() === 'zh-cn'
        ? ['日', '一', '二', '三', '四', '五', '六']
        : ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    [],
  )

  return (
    <div className="ds-card ds-card-p">
      <div className={styles.head}>
        <div className="ds-card-title">{t('日程 / 待办')}</div>
        <div className={styles.todoHead}>
          {t('今日待办')}　<span className={styles.todoCount}>{model.todos.length}</span>
        </div>
      </div>
      <div className={styles.grid}>
        <div>
          <div className={styles.month}>
            {model.year}
            {t('年')}
            {model.month}
            {t('月')}
          </div>
          <div className={styles.calendar}>
            {weekdayHeads.map((head, index) => (
              <div key={`${head}-${index}`} className={styles.calendarHead}>
                {t(head)}
              </div>
            ))}
            {calendarCells.map((cell, index) => (
              <div
                key={`${cell.day}-${index}`}
                className={[
                  styles.day,
                  cell.dim ? styles.dayDim : '',
                  !cell.dim && cell.day === model.today ? styles.dayActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {cell.day}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className={styles.todoList}>
            {model.todos.map((todo) => (
              <div key={todo.id} className={styles.todoItem}>
                <div className={styles.todoDot} />
                <div className={styles.todoTime}>{todo.time}</div>
                <div className={styles.todoMain}>
                  <strong>{t(todo.title)}</strong>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.newSchedule}>
            <a
              href="#"
              className="ds-link"
              onClick={(event) => {
                event.preventDefault()
              }}
            >
              + {tCommon('新建日程')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
