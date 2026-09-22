import {
	Bot,
	Box,
	CircleStop,
	Clock3,
	GitBranch,
	Globe,
	Play,
	ScanLine,
} from 'lucide-react'
import type { WorkflowKind } from '../../workflow.model'
import styles from './WorkflowIcon.module.css'

/** 节点类型图标与颜色保持固定，供卡片、配置面板、动作库和预览共享；size 只调整图形尺寸。 */
export function WorkflowIcon({
	kind,
	actionId,
	size = 15,
}: {
	kind: WorkflowKind
	actionId?: string
	size?: number
}) {
	const Icon =
		kind === 'start'
			? Play
			: kind === 'end'
				? CircleStop
				: kind === 'condition'
					? GitBranch
					: kind === 'http'
						? Globe
						: kind === 'delay'
							? Clock3
							: actionId?.includes('recogn')
								? ScanLine
								: actionId?.includes('pick')
									? Box
									: Bot
	return (
		<span className={`${styles.icon} ${styles[kind]}`}>
			<Icon size={size} />
		</span>
	)
}
