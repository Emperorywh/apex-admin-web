/**
 * 登录页与控制台共用的深海军蓝监控背景；仅提供低对比网格，不拦截指针。
 */

import styles from '@/components/Wallpaper/Wallpaper.module.css'

export function Wallpaper() {
	return <div className={styles.wall} aria-hidden="true" />
}
