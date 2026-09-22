import { useTranslation } from 'react-i18next'
import { InputNumber } from 'antd'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import styles from './WorkflowExecutionFields.module.css'
import formStyles from '../workflowForm.module.css'

/** 动作和 HTTP 共用执行限制：超时为正整数秒，重试允许为零；空输入不覆盖已应用值。 */
export function WorkflowExecutionFields({
	node,
	onChange,
}: Pick<WorkflowConfigProps, 'node' | 'onChange'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	return (
		<div className={styles.twoColumns}>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('timeout')}>{t('超时时间')}</label>
				<InputNumber
					id={fieldId('timeout')}
					min={1}
					max={86400}
					precision={0}
					value={data.timeout}
					suffix={t('秒')}
					onChange={(value) => {
						if (value !== null) onChange({ timeout: value })
					}}
				/>
			</div>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('retries')}>{t('失败重试')}</label>
				<InputNumber
					id={fieldId('retries')}
					min={0}
					max={10}
					precision={0}
					value={data.retries}
					suffix={t('次')}
					onChange={(value) => {
						if (value !== null) onChange({ retries: value })
					}}
				/>
			</div>
		</div>
	)
}
