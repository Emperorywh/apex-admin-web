import { useTranslation } from 'react-i18next'
import { InputNumber } from 'antd'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import formStyles from '../workflowForm.module.css'

/** 等待节点只允许正整数秒数；修改后由父级记录文档变更。 */
export function DelayNodeConfig({
	node,
	onChange,
}: Pick<WorkflowConfigProps, 'node' | 'onChange'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const fieldId = (name: string) => `workflow-${node.id}-${name}`
	return (
		<section className={formStyles.section}>
			<h3>{t('等待配置')}</h3>
			<div className={formStyles.field}>
				<label htmlFor={fieldId('duration')}>{t('等待时长')}</label>
				<InputNumber
					id={fieldId('duration')}
					min={1}
					max={86400}
					precision={0}
					value={data.duration}
					suffix={t('秒')}
					onChange={(value) => {
						if (value !== null) onChange({ duration: value })
					}}
				/>
			</div>
			<p className={formStyles.hint}>
				{t('等待指定时间后，继续执行下一个节点。')}
			</p>
		</section>
	)
}
