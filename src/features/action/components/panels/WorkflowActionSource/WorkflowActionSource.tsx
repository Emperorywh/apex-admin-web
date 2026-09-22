import { useTranslation } from 'react-i18next'
import type { WorkflowConfigProps } from '../../../workflow.components.types'
import { ACTION_PRESETS } from '../../../workflow.model'
import { WorkflowIcon } from '../../WorkflowIcon/WorkflowIcon'
import styles from './WorkflowActionSource.module.css'

/** 动作来源展示当前预制库分组和名称；所有动作配置共用此说明。 */
export function WorkflowActionSource({
	node,
}: Pick<WorkflowConfigProps, 'node'>) {
	const { t } = useTranslation('action')
	const data = node.data
	const preset = ACTION_PRESETS.find((item) => item.id === data.actionId)
	return (
		<div className={styles.source}>
			<WorkflowIcon kind="action" actionId={data.actionId} />
			<div>
				<span>{t(preset?.group ?? '预制动作库')}</span>
				<strong>{t(preset?.label ?? '未选择动作')}</strong>
			</div>
		</div>
	)
}
