import { useTranslation } from 'react-i18next'
import { Input, Select } from 'antd'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import { WorkflowExecutionFields } from '../WorkflowExecutionFields/WorkflowExecutionFields'
import styles from './HttpNodeConfig.module.css'
import formStyles from '../workflowForm.module.css'

/** HTTP 节点配置请求方法、地址、请求体，并复用执行超时和重试约束。 */
export function HttpNodeConfig({
	node,
	onChange,
}: Pick<WorkflowConfigProps, 'node' | 'onChange'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	return (
		<section className={formStyles.section}>
			<h3>{t('请求配置')}</h3>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('method')}>{t('请求方法')}</label>
				<Select
					id={fieldId('method')}
					value={data.method}
					options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
						(method) => ({
							value: method,
							label: method,
						}),
					)}
					onChange={(method) => onChange({ method })}
				/>
			</div>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('url')}>
					{t('请求地址')}
					<span className={formStyles.required}>*</span>
				</label>
				<Input
					id={fieldId('url')}
					value={data.url}
					placeholder="https://api.example.com/endpoint"
					onChange={(event) => onChange({ url: event.target.value })}
				/>
			</div>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('body')}>
					{t('请求体')}
					<span className={formStyles.optional}>JSON</span>
				</label>
				<Input.TextArea
					id={fieldId('body')}
					className={styles.codeInput}
					value={data.body}
					autoSize={{ minRows: 5, maxRows: 12 }}
					placeholder="{}"
					onChange={(event) => onChange({ body: event.target.value })}
				/>
			</div>
			<WorkflowExecutionFields node={node} onChange={onChange} />
		</section>
	)
}
