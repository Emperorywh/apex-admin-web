import { memo, useContext, useState } from 'react'
import {
	BaseEdge,
	EdgeLabelRenderer,
	getSmoothStepPath,
	type EdgeProps,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { WorkflowNodeActions } from '../../workflow.context'
import type { WorkflowEdge as WorkflowEdgeData } from '../../workflow.model'
import styles from './WorkflowEdge.module.css'

/** 平滑连线保留原生选择能力，中点按钮沿用源端口的添加操作，由画布完成节点插入和连线重接。 */
export const WorkflowEdge = memo(function WorkflowEdge({
	id,
	source,
	sourceHandleId,
	sourceX,
	sourceY,
	sourcePosition,
	targetX,
	targetY,
	targetPosition,
	selected,
	markerStart,
	markerEnd,
	style,
}: EdgeProps<WorkflowEdgeData>) {
	const { t } = useTranslation('action')
	const actions = useContext(WorkflowNodeActions)
	const [hovered, setHovered] = useState(false)
	const [path, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		borderRadius: 12,
	})

	// 标签渲染在独立的 HTML 图层，因此用悬停状态连接 SVG 命中区与按钮，不依赖跨图层 CSS 选择器。
	return (
		<>
			<g
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
			>
				<BaseEdge
					id={id}
					path={path}
					markerStart={markerStart}
					markerEnd={markerEnd}
					interactionWidth={22}
					style={{
						...style,
						stroke: selected
							? 'var(--app-cyan)'
							: 'var(--app-blue)',
						strokeWidth: selected ? 2 : 1.5,
					}}
				/>
			</g>
			<EdgeLabelRenderer>
				<button
					type="button"
					className={`${styles.insert} ${selected || hovered ? styles.visible : ''} nodrag nopan`}
					style={{
						transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
					}}
					title={t('在连线上插入节点')}
					aria-label={t('在连线上插入节点')}
					onMouseEnter={() => setHovered(true)}
					onMouseLeave={() => setHovered(false)}
					onClick={(event) => {
						event.stopPropagation()
						actions.onAdd(source, sourceHandleId ?? 'output')
					}}
				>
					<Plus size={13} aria-hidden="true" />
				</button>
			</EdgeLabelRenderer>
		</>
	)
})
