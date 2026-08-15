/**
 * 空白布局（规格 §3.1）：登录等无外壳页面的承载布局，只提供全屏容器与 Outlet，
 * 不包含菜单、页签等 BasicLayout 元素。
 */
import { Outlet } from 'react-router'
import styles from './BlankLayout.module.css'

export function BlankLayout() {
  return (
    <div className={styles.blankLayout}>
      <Outlet />
    </div>
  )
}
