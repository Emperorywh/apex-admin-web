/**
 * 占位页：菜单复刻阶段仅展示路由名称的空白业务页。
 */

import { useTranslation } from 'react-i18next'
import styles from '@/components/PagePlaceholder/PagePlaceholder.module.css'

interface PagePlaceholderProps {
  /** 路由标题，即 menu 命名空间的中文 key */
  title: string
}

export function PagePlaceholder({ title }: PagePlaceholderProps) {
  const { t } = useTranslation('menu')
  return (
    <div className={styles.placeholder}>
      <h1 className={styles.title}>{t(title)}</h1>
    </div>
  )
}
