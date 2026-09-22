import { useTranslation } from 'react-i18next'
import formStyles from '../workflowForm.module.css'

/** 结束节点展示当前流程输出规则，不提供后续连接或虚构的配置字段。 */
export function EndNodeConfig() {
	const { t } = useTranslation('action')
	return (
		<section className={formStyles.section}>
			<h3>{t('流程输出')}</h3>
			<p className={formStyles.hint}>
				{t(
					'流程到达此节点时结束，并返回前序节点的执行结果。结束节点不能连接下一步。',
				)}
			</p>
		</section>
	)
}
