import { useEffect, useRef, useState } from 'react'
import { Button, Dropdown, Tabs, Tooltip } from 'antd'
import { Copy, Ellipsis, FlaskConical, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import { WORKFLOW_NODE_BEHAVIOR } from '../../../workflow.presentation'
import { getWorkflowConfig } from '../../../workflow.config-registry'
import { WorkflowIcon } from '../../WorkflowIcon/WorkflowIcon'
import { WorkflowBasicFields } from '../WorkflowBasicFields/WorkflowBasicFields'
import { WorkflowNextSteps } from '../WorkflowNextSteps/WorkflowNextSteps'
import { WorkflowOutputVariables } from '../WorkflowOutputVariables/WorkflowOutputVariables'
import styles from './WorkflowInspector.module.css'

/** 面板外壳接收编辑器操作；专属表单通过统一属性契约更新当前节点。 */
interface WorkflowInspectorProps extends WorkflowConfigProps {
	onClose: () => void
	onDelete: () => void
	onDuplicate: () => void
	onAddNext: (handle: string) => void
	onSelectNode: (id: string) => void
	onDisconnect: (edgeId: string) => void
}
/** 右侧固定宽度编辑区沿用画布节点颜色；所有表单即时更新草稿，不触发设备执行。 */
export function WorkflowInspector({
	node,
	nodes,
	edges,
	motors,
	motorStorageWarning,
	onApply,
	onPendingChange,
	onChange,
	onClose,
	onDelete,
	onDuplicate,
	onAddNext,
	onSelectNode,
	onDisconnect,
}: WorkflowInspectorProps) {
	const { t } = useTranslation('action')
	const data = node.data
	const panelRef = useRef<HTMLElement>(null)
	const [activeTab, setActiveTab] = useState('settings')
	const [testRequest, setTestRequest] = useState(0)
	// 等配置页签渲染后定位测试区；不自动启动，保留参数校验与用户明确点击的测试动作。
	useEffect(() => {
		if (testRequest > 0 && activeTab === 'settings')
			panelRef.current
				?.querySelector('[data-workflow-test]')
				?.scrollIntoView({ block: 'nearest' })
	}, [testRequest, activeTab])

	const behavior = WORKFLOW_NODE_BEHAVIOR[data.kind]
	const Config = getWorkflowConfig(data)
	const configuration = (
		<div className={styles.body}>
			<WorkflowBasicFields node={node} onChange={onChange} />
			<Config
				node={node}
				nodes={nodes}
				edges={edges}
				motors={motors}
				motorStorageWarning={motorStorageWarning}
				onApply={onApply}
				onPendingChange={onPendingChange}
				onChange={onChange}
			/>
			<WorkflowNextSteps
				node={node}
				nodes={nodes}
				edges={edges}
				onAddNext={onAddNext}
				onSelectNode={onSelectNode}
				onDisconnect={onDisconnect}
			/>
		</div>
	)

	return (
		<aside
			ref={panelRef}
			className={styles.inspector}
			aria-label={t('节点配置')}
		>
			<header className={styles.header}>
				<WorkflowIcon
					kind={data.kind}
					actionId={data.actionId}
					size={17}
				/>
				<strong title={t(data.label)}>
					{t(data.label) || t('未命名节点')}
				</strong>
				<div className={styles.headerActions}>
					{behavior.testable && (
						<Tooltip title={t('打开节点测试')}>
							<Button
								type="text"
								size="small"
								aria-label={t('打开节点测试')}
								icon={<FlaskConical size={16} />}
								onClick={() => {
									setActiveTab('settings')
									setTestRequest((count) => count + 1)
								}}
							/>
						</Tooltip>
					)}
					{behavior.editable && (
						<Dropdown
							trigger={['click']}
							menu={{
								items: [
									{
										key: 'duplicate',
										icon: <Copy size={14} />,
										label: t('复制节点'),
									},
									{
										key: 'delete',
										icon: <Trash2 size={14} />,
										label: t('删除节点'),
										danger: true,
										// 配置面板遵循节点删除权限，结束节点保留配置与复制能力。
										disabled: node.deletable === false,
									},
								],
								onClick: ({ key }) => {
									if (key === 'duplicate') onDuplicate()
									else onDelete()
								},
							}}
						>
							<Button
								type="text"
								size="small"
								aria-label={t('节点操作')}
								icon={<Ellipsis size={17} />}
							/>
						</Dropdown>
					)}
					<Tooltip title={t('关闭配置面板')}>
						<Button
							type="text"
							size="small"
							aria-label={t('关闭配置面板')}
							icon={<X size={16} />}
							onClick={onClose}
						/>
					</Tooltip>
				</div>
			</header>
			<Tabs
				className={styles.tabs}
				activeKey={activeTab}
				onChange={setActiveTab}
				items={[
					{
						key: 'settings',
						label: t('配置'),
						children: configuration,
					},
					{
						key: 'outputs',
						label: t('输出变量'),
						children: <WorkflowOutputVariables data={data} />,
					},
				]}
			/>
		</aside>
	)
}
