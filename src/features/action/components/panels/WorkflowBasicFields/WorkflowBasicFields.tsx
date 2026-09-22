import { useTranslation } from 'react-i18next'
import { Input } from 'antd'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import formStyles from '../workflowForm.module.css'

/** 公共基础字段维护节点名称和描述；预制文案继续使用 action 翻译命名空间。 */
export function WorkflowBasicFields({
	node,
	onChange,
}: Pick<WorkflowConfigProps, 'node' | 'onChange'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	return (
		<section className={formStyles.section}>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('label')}>
					{t('节点名称')}
					<span className={formStyles.required}>*</span>
				</label>
				<Input
					id={fieldId('label')}
					value={t(data.label)}
					maxLength={48}
					placeholder={t('请输入节点名称')}
					status={!data.label.trim() ? 'error' : undefined}
					onChange={(event) =>
						onChange({ label: event.target.value })
					}
				/>
			</div>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('description')}>
					{t('描述')}
					<span className={formStyles.optional}>{t('选填')}</span>
				</label>
				<Input.TextArea
					id={fieldId('description')}
					value={t(data.description)}
					maxLength={300}
					autoSize={{ minRows: 2, maxRows: 4 }}
					placeholder={t('添加节点的用途说明…')}
					onChange={(event) =>
						onChange({ description: event.target.value })
					}
				/>
			</div>
		</section>
	)
}
