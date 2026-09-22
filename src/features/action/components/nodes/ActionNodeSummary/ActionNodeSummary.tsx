import { useTranslation } from 'react-i18next'
import { Box } from 'lucide-react'
import type { WorkflowSummaryProps } from '../../../workflow.components.types'
import { WorkflowSummaryRow } from '../WorkflowSummaryRow/WorkflowSummaryRow'
import { WorkflowExecutionSummary } from '../WorkflowExecutionSummary/WorkflowExecutionSummary'

/** 位置类动作展示目标位置及执行限制，所有使用相同参数契约的预制动作共用此摘要。 */
export function ActionNodeSummary({
	data,
}: Pick<WorkflowSummaryProps, 'data'>) {
	const { t } = useTranslation('action')
	return (
		<>
			<WorkflowSummaryRow icon={<Box size={12} />}>
				{data.target || t('请配置目标位置')}
			</WorkflowSummaryRow>
			<WorkflowExecutionSummary data={data} />
		</>
	)
}
