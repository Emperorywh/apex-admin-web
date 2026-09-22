import { useTranslation } from 'react-i18next'
import type { WorkflowSummaryProps } from '../../../workflow.components.types'
import { WorkflowSummaryRow } from '../WorkflowSummaryRow/WorkflowSummaryRow'
import { WorkflowExecutionSummary } from '../WorkflowExecutionSummary/WorkflowExecutionSummary'

/** HTTP 节点展示方法、地址及执行限制，长地址在公共摘要行内省略。 */
export function HttpNodeSummary({ data }: Pick<WorkflowSummaryProps, 'data'>) {
	const { t } = useTranslation('action')
	return (
		<>
			<WorkflowSummaryRow icon={<b>{data.method}</b>}>
				{data.url || t('请配置请求地址')}
			</WorkflowSummaryRow>
			<WorkflowExecutionSummary data={data} />
		</>
	)
}
