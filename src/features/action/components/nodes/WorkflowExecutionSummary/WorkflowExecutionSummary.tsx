import { useTranslation } from 'react-i18next'
import { Clock3 } from 'lucide-react'
import type { WorkflowSummaryProps } from '../../../workflow.components.types'
import styles from './WorkflowExecutionSummary.module.css'

/** 动作与 HTTP 节点共用超时及重试摘要，随当前语言和已应用参数更新。 */
export function WorkflowExecutionSummary({
	data,
}: Pick<WorkflowSummaryProps, 'data'>) {
	const { t } = useTranslation('action')
	return (
		<div className={styles.footer}>
			<Clock3 size={11} />
			{t('{{seconds}} 秒超时', { seconds: data.timeout })}
			<span>·</span>
			{t('重试 {{count}} 次', { count: data.retries })}
		</div>
	)
}
