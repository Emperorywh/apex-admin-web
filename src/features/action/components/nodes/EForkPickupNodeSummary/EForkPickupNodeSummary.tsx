import { useTranslation } from 'react-i18next'
import { Box } from 'lucide-react'
import type { WorkflowSummaryProps } from '../../../workflow.components.types'
import { WorkflowSummaryRow } from '../WorkflowSummaryRow/WorkflowSummaryRow'
import { WorkflowExecutionSummary } from '../WorkflowExecutionSummary/WorkflowExecutionSummary'

/** E叉取货摘要只读取已应用的启停状态和顶升高度，未配置时提示轴参数入口。 */
export function EForkPickupNodeSummary({
	data,
}: Pick<WorkflowSummaryProps, 'data'>) {
	const { t } = useTranslation('action')
	return (
		<>
			<WorkflowSummaryRow icon={<Box size={12} />}>
				{data.pickup?.enabled === false
					? t('动作已停用')
					: data.pickup?.liftHeight != null
						? t('顶升至 {{height}} mm', {
								height: data.pickup.liftHeight,
							})
						: t('请配置顶升轴与参数')}
			</WorkflowSummaryRow>
			<WorkflowExecutionSummary data={data} />
		</>
	)
}
