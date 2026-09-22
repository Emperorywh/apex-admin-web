import { useTranslation } from 'react-i18next'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import { WorkflowActionSource } from '../WorkflowActionSource/WorkflowActionSource'
import { WorkflowExecutionFields } from '../WorkflowExecutionFields/WorkflowExecutionFields'
import { EForkPickupConfig } from '../EForkPickupConfig/EForkPickupConfig'
import formStyles from '../workflowForm.module.css'

/** E叉取货使用专属轴参数面板；保留显式应用、读取异常提示和未应用变更提醒。 */
export function EForkPickupNodeConfig({
	node,
	motors,
	motorStorageWarning,
	onChange,
	onApply,
	onPendingChange,
}: WorkflowConfigProps) {
	const { t } = useTranslation('action')
	const data = node.data
	return (
		<section className={formStyles.section}>
			<h3>{t('动作配置')}</h3>
			<WorkflowActionSource node={node} />
			<WorkflowExecutionFields node={node} onChange={onChange} />
			<p className={formStyles.hint}>
				{t('动作超时且重试失败时，工作流将停止执行。')}
			</p>
			{motorStorageWarning && (
				<p className={formStyles.hint} role="alert">
					{t(
						'轴电机数据读取异常，请检查浏览器存储后重新进入编辑器。',
					)}
				</p>
			)}
			<EForkPickupConfig
				key={JSON.stringify(data.pickup)}
				nodeId={node.id}
				data={data}
				motors={motors}
				onApply={onApply}
				onPendingChange={onPendingChange}
			/>
		</section>
	)
}
