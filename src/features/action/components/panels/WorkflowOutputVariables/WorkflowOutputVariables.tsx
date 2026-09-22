import { useTranslation } from 'react-i18next'
import { Braces } from 'lucide-react'
import type { WorkflowNodeData } from '../../../workflow.model'
import { getWorkflowOutputs } from '../../../workflow.presentation'
import styles from './WorkflowOutputVariables.module.css'
import formStyles from '../workflowForm.module.css'

/** 输出页签根据节点契约展示名称、类型和本地化说明，无输出时展示空状态。 */
export function WorkflowOutputVariables({ data }: { data: WorkflowNodeData }) {
	const { t } = useTranslation('action')
	const outputVariables = getWorkflowOutputs(data)
	return (
		<div className={styles.body}>
			<section className={formStyles.section}>
				<h3>{t('输出变量')}</h3>
				<p className={formStyles.hint}>
					{t('后续节点可以引用以下变量。')}
				</p>
				{outputVariables.length > 0 ? (
					<div className={styles.outputVariables}>
						{outputVariables.map((variable, index) => (
							<div
								key={`${variable.name}-${index}`}
								className={styles.outputVariable}
							>
								<div>
									<Braces size={13} />
									<code>
										{variable.name || t('未命名变量')}
									</code>
									<span>{variable.type}</span>
								</div>
								<p>{t(variable.description)}</p>
							</div>
						))}
					</div>
				) : (
					<div className={styles.empty}>
						<Braces size={25} />
						<p>{t('此节点不产生额外输出变量')}</p>
					</div>
				)}
			</section>
		</div>
	)
}
