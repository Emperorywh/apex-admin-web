/**
 * 迁移过渡占位页（T00.4）：
 * 页面迁移任务未完成的叶子在运行路径上统一呈现本占位——
 * 不加载页面代码（不发请求、无模板假数据），并明确告知用户功能尚未开放。
 * 对应页面任务完成后由统筹移除路由 meta.migrationPending 标记，本组件自动退场。
 */

import { useTranslation } from 'react-i18next'
import { Wrench } from 'lucide-react'
import styles from '@/components/MigrationPending/MigrationPending.module.css'

interface MigrationPendingProps {
  /** 页面标题（menu 命名空间的中文 key） */
  title: string
}

export function MigrationPending({ title }: MigrationPendingProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  return (
    <div className={styles.wrap}>
      <span className={styles.icon} aria-hidden="true">
        <Wrench size={22} strokeWidth={2} />
      </span>
      <h1 className={styles.title}>{t(title)}</h1>
      <p className={styles.hint}>{tCommon('该功能正在迁移中，迁移完成后开放使用')}</p>
    </div>
  )
}
