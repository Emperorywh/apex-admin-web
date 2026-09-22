import { useTranslation } from 'react-i18next'
import { Input } from 'antd'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import { WorkflowActionSource } from '../WorkflowActionSource/WorkflowActionSource'
import { WorkflowExecutionFields } from '../WorkflowExecutionFields/WorkflowExecutionFields'
import { WorkflowNodeTest } from '../WorkflowNodeTest/WorkflowNodeTest'
import formStyles from '../workflowForm.module.css'

/** 导航、对接等位置类动作共用目标位置表单；测试在参数快照变化后重置，避免沿用旧结果。 */
export function ActionNodeConfig({
	node,
	motors,
	onChange,
}: Pick<WorkflowConfigProps, 'node' | 'motors' | 'onChange'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	return (
		<section className={formStyles.section}>
			<h3>{t('动作配置')}</h3>
			<WorkflowActionSource node={node} />
			<div className={formStyles.field}>
				<label htmlFor={fieldId('target')}>
					{t('目标位置')}
					<span className={formStyles.required}>*</span>
				</label>
				<Input
					id={fieldId('target')}
					value={data.target}
					placeholder={t('输入站点、库位或设备标识')}
					onChange={(event) =>
						onChange({ target: event.target.value })
					}
				/>
			</div>
			<WorkflowExecutionFields node={node} onChange={onChange} />
			<p className={formStyles.hint}>
				{t('动作超时且重试失败时，工作流将停止执行。')}
			</p>
			<WorkflowNodeTest
				key={JSON.stringify(data)}
				data={data}
				motors={motors}
			/>
		</section>
	)
}
