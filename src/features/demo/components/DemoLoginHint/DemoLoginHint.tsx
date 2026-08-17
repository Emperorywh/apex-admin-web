/**
 * 登录页演示账号提示（SPEC-UI §6）：非 off 构建的登录页品牌区展示 demo 账号。
 * - 账号用户名来自 src/demo/demo.constants（demo 账号唯一数据源，规格 §5.3/§13.2），
 *   本组件不硬编码账号；off 构建经登录页静态条件 + 动态 import 整体剔除（规格 §13.3）；
 * - 仅在登录页品牌区挂载即展示（无会话语境），文案经 common 命名空间翻译（规格 §12）。
 */
import { useTranslation } from 'react-i18next'
import { DEMO_ACCOUNT_USERNAMES } from '@/demo/demo.constants'
import { COMMON_NAMESPACE } from '@/i18n/i18n'
import styles from './DemoLoginHint.module.css'

export function DemoLoginHint() {
  const { t } = useTranslation()
  return (
    <div className={styles.hint}>
      <span className={styles.hintLabel}>{t('演示账号', { ns: COMMON_NAMESPACE })}</span>
      <span className={styles.hintValue}>
        {DEMO_ACCOUNT_USERNAMES.ADMIN} / {DEMO_ACCOUNT_USERNAMES.VIEWER} · {t('密码任意', { ns: COMMON_NAMESPACE })}
      </span>
    </div>
  )
}
