import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { useUpdateNodeInternals } from '@xyflow/react'
import type { WorkflowSummaryProps } from '../../../workflow.components.types'
import { WorkflowOutputPort } from '../WorkflowOutputPort/WorkflowOutputPort'
import styles from './ConditionNodeSummary.module.css'

/** 条件摘要逐行展示 IF、ELIF 和 ELSE，并在端口变化后重新测量以保持连线位置准确。 */
export function ConditionNodeSummary({ id, data }: WorkflowSummaryProps) {
	const { t } = useTranslation('action')
	const updateInternals = useUpdateNodeInternals()
	const branchIds = data.branches.map((branch) => branch.id).join(',')
	// 动态增删条件端口后重新测量，避免连线仍指向已移除分支的位置。
	useEffect(() => {
		updateInternals(id)
	}, [id, branchIds, updateInternals])
	// 卡片只展示变量末段与比较值，完整来源在配置选择器中用节点名称表示，不暴露内部标识。
	const operators = { eq: '=', neq: '≠', gt: '>', lt: '<', contains: '⊃' }
	const ports = [
		...data.branches.map((branch, index) => ({
			id: branch.id,
			label: index === 0 ? 'IF' : 'ELIF',
			value: branch.variable
				? `${branch.variable.split('.').at(-1)} ${operators[branch.operator]} ${branch.value}`
				: t('未配置条件'),
		})),
		{ id: 'else', label: 'ELSE', value: t('其他情况') },
	]
	return (
		<div className={styles.branches}>
			{ports.map((port) => (
				<div key={port.id} className={styles.branch}>
					<span>{port.value}</span>
					<b>{port.label}</b>
					<WorkflowOutputPort nodeId={id} handle={port.id} branch />
				</div>
			))}
		</div>
	)
}
