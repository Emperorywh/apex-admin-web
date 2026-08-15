/**
 * 登录页（规格 §14.2 /login，公开路由）：
 * 页面入口只负责布局与业务组件编排，表单实现在 features/auth 的 LoginForm；
 * 登录后的导航由认证会话产出的意图经路由任务执行，本页面不感知路由。
 */
import { Card } from 'antd'
import { useTranslation } from 'react-i18next'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import styles from './Login.module.css'

export function Login() {
  const { t } = useTranslation()
  return (
    <div className={styles.loginPage}>
      <Card className={styles.loginCard}>
        <div className={styles.brand}>
          <h1 className={styles.brandTitle}>Apex Admin</h1>
          <p className={styles.brandSubtitle}>{t('通用后台管理模板')}</p>
        </div>
        <LoginForm />
      </Card>
    </div>
  )
}
