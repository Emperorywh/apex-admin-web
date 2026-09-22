import type { ReactNode } from 'react'
import styles from './WorkflowSummaryRow.module.css'

/** 动作、HTTP 和等待节点共用单行摘要，图标固定宽度，长内容省略以保护端口位置。 */
export function WorkflowSummaryRow({
	icon,
	children,
}: {
	icon: ReactNode
	children: ReactNode
}) {
	return (
		<div className={styles.summary}>
			{icon}
			<span>{children}</span>
		</div>
	)
}
