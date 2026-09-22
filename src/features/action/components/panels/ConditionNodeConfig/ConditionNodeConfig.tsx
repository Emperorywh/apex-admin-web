import { useTranslation } from 'react-i18next'
import { Button, Input, Select, Tooltip } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import type { WorkflowNodeData } from '../../../workflow.model'
import { getWorkflowOutputs } from '../../../workflow.presentation'
import styles from './ConditionNodeConfig.module.css'
import formStyles from '../workflowForm.module.css'

/** 条件节点独立维护上游变量、比较规则和 ELIF 分支，ELSE 始终保留。 */
export function ConditionNodeConfig({
	node,
	nodes,
	edges,
	onChange,
}: Pick<WorkflowConfigProps, 'node' | 'nodes' | 'edges' | 'onChange'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	// 变量选择仅包含上游来源；显示业务节点名称，将稳定的内部引用保存在节点数据中。
	const upstreamIds = new Set<string>()
	const pending = [node.id]
	while (pending.length) {
		const target = pending.pop()
		edges
			.filter((edge) => edge.target === target)
			.forEach((edge) => {
				if (!upstreamIds.has(edge.source) && edge.source !== node.id) {
					upstreamIds.add(edge.source)
					pending.push(edge.source)
				}
			})
	}
	const variableOptions = nodes
		.filter((item) => upstreamIds.has(item.id))
		.flatMap((item) =>
			getWorkflowOutputs(item.data).map((output) => ({
				value:
					item.data.kind === 'start'
						? output.name
						: `${item.id}.${output.name}`,
				label: `${t(item.data.label)} / ${output.name}`,
			})),
		)

	// 分支补丁保留稳定端口标识；删除分支时由父级同步清理连线。
	const updateBranch = (
		id: string,
		patch: Partial<WorkflowNodeData['branches'][number]>,
	) =>
		onChange({
			branches: data.branches.map((branch) =>
				branch.id === id ? { ...branch, ...patch } : branch,
			),
		})
	const removeBranch = (id: string) => {
		// 父级一次更新同时清理失效端口的连线，让撤销能完整恢复分支与连接。
		onChange({
			branches: data.branches.filter((branch) => branch.id !== id),
		})
	}
	return (
		<section className={formStyles.section}>
			<h3>{t('分支条件')}</h3>
			<p className={formStyles.hint}>
				{t('按顺序判断条件，执行第一个匹配的分支。')}
			</p>
			{data.branches.map((branch, index) => (
				<div key={branch.id} className={styles.branch}>
					<div className={formStyles.itemHeading}>
						<strong>
							{index === 0 ? 'IF' : 'ELIF'}
							<span className={styles.branchIndex}>
								{String(index + 1).padStart(2, '0')}
							</span>
						</strong>
						{index > 0 && (
							<Tooltip title={t('移除分支')}>
								<Button
									type="text"
									size="small"
									aria-label={t('移除分支')}
									icon={<Trash2 size={13} />}
									onClick={() => removeBranch(branch.id)}
								/>
							</Tooltip>
						)}
					</div>
					<div className={formStyles.field}>
						<label htmlFor={fieldId(`variable-${branch.id}`)}>
							{t('条件变量')}
						</label>
						<Select
							id={fieldId(`variable-${branch.id}`)}
							value={branch.variable || undefined}
							options={variableOptions}
							allowClear
							showSearch={{ optionFilterProp: 'label' }}
							placeholder={t('选择上游变量')}
							onChange={(variable) =>
								updateBranch(branch.id, {
									variable: variable ?? '',
								})
							}
						/>
					</div>
					<div className={styles.conditionValues}>
						<div className={formStyles.field}>
							<label htmlFor={fieldId(`operator-${branch.id}`)}>
								{t('运算符')}
							</label>
							<Select
								id={fieldId(`operator-${branch.id}`)}
								value={branch.operator}
								options={[
									{ value: 'eq', label: t('等于') },
									{
										value: 'neq',
										label: t('不等于'),
									},
									{ value: 'gt', label: t('大于') },
									{ value: 'lt', label: t('小于') },
									{
										value: 'contains',
										label: t('包含'),
									},
								]}
								onChange={(operator) =>
									updateBranch(branch.id, {
										operator,
									})
								}
							/>
						</div>
						<div className={formStyles.field}>
							<label htmlFor={fieldId(`value-${branch.id}`)}>
								{t('比较值')}
							</label>
							<Input
								id={fieldId(`value-${branch.id}`)}
								value={branch.value}
								placeholder={t('输入比较值')}
								onChange={(event) =>
									updateBranch(branch.id, {
										value: event.target.value,
									})
								}
							/>
						</div>
					</div>
				</div>
			))}
			<Button
				block
				type="dashed"
				icon={<Plus size={14} />}
				onClick={() =>
					onChange({
						branches: [
							...data.branches,
							{
								id: crypto.randomUUID(),
								variable: '',
								operator: 'eq',
								value: '',
							},
						],
					})
				}
			>
				{t('添加 ELIF 分支')}
			</Button>
			<div className={styles.elseBranch}>
				<strong>ELSE</strong>
				<p className={formStyles.hint}>
					{t('当以上条件均不满足时，执行此分支。')}
				</p>
			</div>
		</section>
	)
}
