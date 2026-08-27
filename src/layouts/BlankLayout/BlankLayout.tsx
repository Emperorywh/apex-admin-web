/**
 * 空白布局：无外壳页面的容器（登录、显式错误页）。
 */

import type { ReactNode } from 'react'
import styles from '@/layouts/BlankLayout/BlankLayout.module.css'

export function BlankLayout({ children }: { children: ReactNode }) {
  return <div className={styles.blank}>{children}</div>
}
