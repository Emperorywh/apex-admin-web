/**
 * 菜单分组图标：语义色线框与内嵌面板材质。
 * 路由 → 色调映射见同目录 iconTones.ts，统一菜单的图标语义色。
 */

import type { CSSProperties, ReactNode } from 'react'
import type { IconTone } from '@/layouts/BasicLayout/components/IconTile/iconTones'
import styles from '@/layouts/BasicLayout/components/IconTile/IconTile.module.css'

interface IconTileProps {
	tone: IconTone
	/** 图标底座边长（px） */
	size?: number
	/** 圆角（px） */
	radius?: number
	children: ReactNode
}

export function IconTile({
	tone,
	size = 22,
	radius = 5,
	children,
}: IconTileProps) {
	const style: CSSProperties = {
		width: size,
		height: size,
		borderRadius: radius,
	}
	return (
		<span
			className={`${styles.tile} ${styles[tone]}`}
			style={style}
			aria-hidden="true"
		>
			{children}
		</span>
	)
}
