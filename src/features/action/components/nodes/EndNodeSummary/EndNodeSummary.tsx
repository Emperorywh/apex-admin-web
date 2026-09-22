import { useTranslation } from 'react-i18next'
import styles from './EndNodeSummary.module.css'

/** 结束节点只展示返回结果说明，不创建输出端口。 */
export function EndNodeSummary() {
	const { t } = useTranslation('action')
	return <div className={styles.endSummary}>{t('返回执行结果')}</div>
}
