/**
 * 登录页：与业务工作区共用海军蓝面板和青色强调的居中认证入口。
 */

import { useTranslation } from 'react-i18next'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import styles from '@/pages/auth/Login/Login.module.css'

export default function Login() {
  const { t } = useTranslation('auth')
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img className={styles.brandIcon} src="/favicon.ico" alt="" aria-hidden="true" />
          <span className={styles.name}>{t('调度系统')}</span>
        </div>
        <p className={styles.sub}>{t('通用后台管理模板 · 多语言 · 多页签 · 页面保活')}</p>
        <LoginForm />
      </div>
    </div>
  )
}
