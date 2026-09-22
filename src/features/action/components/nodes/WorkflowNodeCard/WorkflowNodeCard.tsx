import { memo, useContext } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Copy, Ellipsis, Trash2 } from 'lucide-react'
import { Dropdown, type MenuProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { WORKFLOW_NODE_BEHAVIOR } from '../../../workflow.presentation'
import { getWorkflowSummary } from '../../../workflow.node-registry'
import { WorkflowOutputPort } from '../WorkflowOutputPort/WorkflowOutputPort'
import type { WorkflowNode } from '../../../workflow.model'
import { WorkflowNodeActions } from '../../../workflow.context'
import { WorkflowIcon } from '../../WorkflowIcon/WorkflowIcon'
import styles from './WorkflowNodeCard.module.css'

/** 公共卡片只负责标题、选择态、菜单和通用端口；专属摘要通过节点注册表接入。 */
export const WorkflowNodeCard = memo(function WorkflowNodeCard({
	id,
	data,
	selected,
}: NodeProps<WorkflowNode>) {
	const { t } = useTranslation('action')
	const actions = useContext(WorkflowNodeActions)
	const behavior = WORKFLOW_NODE_BEHAVIOR[data.kind]
	const Summary = getWorkflowSummary(data)
	// 右键与更多按钮共用菜单，始终操作当前卡片；开始节点保留唯一入口，不允许复制或删除。
	const menu: MenuProps = {
		items: [
			{
				key: 'copy',
				icon: <Copy size={14} />,
				label: t('复制'),
				disabled: !behavior.editable,
			},
			{
				key: 'delete',
				icon: <Trash2 size={14} />,
				label: t('删除'),
				danger: true,
				disabled: !behavior.editable,
			},
		],
		onClick: ({ key, domEvent }) => {
			domEvent.stopPropagation()
			if (key === 'copy') actions.onDuplicate(id)
			else if (key === 'delete') actions.onDelete(id)
		},
	}
	// 右键菜单跟随鼠标定位并接收键盘焦点；阻止默认菜单及事件冒泡，避免触发画布添加节点。
	return (
		<Dropdown trigger={['contextMenu']} menu={menu} autoFocus>
			<article
				data-workflow-card
				data-workflow-selected={!!selected}
				className={`${styles.node} ${selected ? styles.selected : ''}`}
				onContextMenu={(event) => {
					event.preventDefault()
					event.stopPropagation()
				}}
			>
				{behavior.hasInput && (
					<Handle
						type="target"
						position={Position.Left}
						id="input"
						className={styles.handle}
					/>
				)}
				<div className={styles.heading}>
					<WorkflowIcon kind={data.kind} actionId={data.actionId} />
					<strong title={t(data.label)}>{t(data.label)}</strong>
					{behavior.editable && (
						<Dropdown trigger={['click']} menu={menu}>
							<button
								className={`${styles.menu} nodrag nopan`}
								aria-label={t('节点操作')}
								onClick={(event) => event.stopPropagation()}
							>
								<Ellipsis size={16} />
							</button>
						</Dropdown>
					)}
				</div>

				<Summary id={id} data={data} />
				{behavior.output === 'single' && (
					<WorkflowOutputPort nodeId={id} />
				)}
			</article>
		</Dropdown>
	)
})
