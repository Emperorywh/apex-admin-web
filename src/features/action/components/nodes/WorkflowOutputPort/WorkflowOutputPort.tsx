import { useContext } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { WorkflowNodeActions } from '../../../workflow.context'
import styles from './WorkflowOutputPort.module.css'

/** 输出端口共用拖线与追加入口；分支端口相对分支行定位，点击按钮不触发节点选择。 */
export function WorkflowOutputPort({
	nodeId,
	handle = 'output',
	branch = false,
}: {
	nodeId: string
	handle?: string
	branch?: boolean
}) {
	const { t } = useTranslation('action')
	const actions = useContext(WorkflowNodeActions)
	return (
		<>
			<Handle
				type="source"
				position={Position.Right}
				id={handle}
				className={`${styles.handle} ${branch ? styles.branchHandle : ''}`}
			/>
			<button
				className={`${styles.addPort} ${branch ? '' : styles.singlePort} nodrag nopan`}
				title={t('添加下一个节点')}
				aria-label={t('添加下一个节点')}
				onClick={(event) => {
					event.stopPropagation()
					actions.onAdd(nodeId, handle)
				}}
			>
				<Plus size={10} />
			</button>
		</>
	)
}
