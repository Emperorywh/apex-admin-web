import { useTranslation } from 'react-i18next'
import { Button, Checkbox, Input, Select, Tooltip } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import type { WorkflowNodeData } from '../../../workflow.model'
import styles from './StartNodeConfig.module.css'
import formStyles from '../workflowForm.module.css'

/** 开始节点维护工作流输入变量；字段变化通过补丁进入同一份文档和撤销历史。 */
export function StartNodeConfig({
	node,
	onChange,
}: Pick<WorkflowConfigProps, 'node' | 'onChange'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	// 输入使用独立标识，编辑名称与类型时保持其他输入不变。
	const updateInput = (
		id: string,
		patch: Partial<WorkflowNodeData['inputs'][number]>,
	) =>
		onChange({
			inputs: data.inputs.map((input) =>
				input.id === id ? { ...input, ...patch } : input,
			),
		})
	return (
		<section className={formStyles.section}>
			<div className={styles.sectionHeading}>
				<h3>{t('输入变量')}</h3>
				<span>{data.inputs.length}</span>
			</div>
			<p className={formStyles.hint}>
				{t('定义工作流启动时需要传入的参数。')}
			</p>
			{data.inputs.map((input, index) => (
				<div key={input.id} className={styles.variableEditor}>
					<div className={formStyles.itemHeading}>
						<span className={styles.codeLabel}>
							{t('变量 {{index}}', { index: index + 1 })}
						</span>
						<Tooltip title={t('删除变量')}>
							<Button
								type="text"
								size="small"
								aria-label={t('删除变量')}
								icon={<Trash2 size={13} />}
								onClick={() =>
									onChange({
										inputs: data.inputs.filter(
											(item) => item.id !== input.id,
										),
									})
								}
							/>
						</Tooltip>
					</div>
					<div className={formStyles.field}>
						<label htmlFor={fieldId(`input-${input.id}`)}>
							{t('变量名')}
						</label>
						<Input
							id={fieldId(`input-${input.id}`)}
							value={input.name}
							placeholder="variable_name"
							maxLength={64}
							onChange={(event) =>
								updateInput(input.id, {
									name: event.target.value,
								})
							}
						/>
					</div>
					<div className={styles.inputOptions}>
						<div className={formStyles.field}>
							<label htmlFor={fieldId(`type-${input.id}`)}>
								{t('类型')}
							</label>
							<Select
								id={fieldId(`type-${input.id}`)}
								value={input.type}
								options={[
									{
										value: 'string',
										label: t('文本'),
									},
									{
										value: 'number',
										label: t('数字'),
									},
									{
										value: 'boolean',
										label: t('布尔值'),
									},
								]}
								onChange={(type) =>
									updateInput(input.id, { type })
								}
							/>
						</div>
						<Checkbox
							checked={input.required}
							onChange={(event) =>
								updateInput(input.id, {
									required: event.target.checked,
								})
							}
						>
							{t('必填')}
						</Checkbox>
					</div>
				</div>
			))}
			<Button
				block
				type="dashed"
				icon={<Plus size={14} />}
				onClick={() =>
					onChange({
						inputs: [
							...data.inputs,
							{
								id: crypto.randomUUID(),
								name: '',
								type: 'string',
								required: true,
							},
						],
					})
				}
			>
				{t('添加输入变量')}
			</Button>
		</section>
	)
}
