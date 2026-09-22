import { useTranslation } from 'react-i18next'
import { Clock3 } from 'lucide-react'
import type { WorkflowSummaryProps } from '../../../workflow.components.types'
import { WorkflowSummaryRow } from '../WorkflowSummaryRow/WorkflowSummaryRow'

/** 等待节点展示配置的秒数，插值继续交由国际化处理。 */
export function DelayNodeSummary({ data }: Pick<WorkflowSummaryProps, 'data'>) {
	const { t } = useTranslation('action')
	return (
		<>
			<WorkflowSummaryRow icon={<Clock3 size={12} />}>
				{t('等待 {{seconds}} 秒', { seconds: data.duration })}
			</WorkflowSummaryRow>
		</>
	)
}
