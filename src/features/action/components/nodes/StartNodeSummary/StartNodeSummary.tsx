import { useTranslation } from 'react-i18next'
import type { WorkflowSummaryProps } from '../../../workflow.components.types'
import styles from './StartNodeSummary.module.css'

/** 开始节点展示入口标识和输入变量的必填状态；没有输入时展示启动说明。 */
export function StartNodeSummary({ data }: Pick<WorkflowSummaryProps, 'data'>) {
	const { t } = useTranslation('action')
	return (
		<>
			<span className={styles.startLabel}>{t('流程入口')}</span>
			<div className={styles.variables}>
				{data.inputs.map((input) => (
					<div key={input.id}>
						<span>
							<b>{'{x}'}</b> {input.name}
						</span>
						<small>{input.required ? t('必填') : t('可选')}</small>
					</div>
				))}
				{data.inputs.length === 0 && (
					<span>{t('工作流从这里开始')}</span>
				)}
			</div>
		</>
	)
}
