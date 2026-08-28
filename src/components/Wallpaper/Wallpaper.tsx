/**
 * 全局动态壁纸：Sonoma 风格流体渐变（基底层 --app-canvas + 光斑/绸带 --app-wall-*）。
 * 固定在视口最底层（z-index:-1），不拦截指针；App 根组件挂载一次，登录页与主布局共用。
 */

import styles from '@/components/Wallpaper/Wallpaper.module.css'

export function Wallpaper() {
  return (
    <div className={styles.wall} aria-hidden="true">
      <div className={styles.blobA} />
      <div className={styles.blobB} />
      <div className={styles.blobC} />
      <div className={styles.ribbon} />
      <div className={styles.sheen} />
      <div className={styles.grain} />
    </div>
  )
}
