/**
 * 全局静态壁纸：背景图 src/assets/images/background.png（cover 铺满，不变形）。
 * 固定在视口最底层（z-index:-1），不拦截指针；App 根组件挂载一次，登录页与主布局共用。
 */

import styles from '@/components/Wallpaper/Wallpaper.module.css'

export function Wallpaper() {
  return <div className={styles.wall} aria-hidden="true" />
}
