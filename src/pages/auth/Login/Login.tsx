/**
 * 登录页：明亮玻璃卡片风格。
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
          <svg className={styles.apple} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M13.9 10.57c.02 2.2 1.93 2.93 1.95 2.94-.02.05-.3 1.06-1 2.11-.6.92-1.23 1.83-2.21 1.85-.96.02-1.27-.57-2.37-.57-1.1 0-1.45.55-2.35.59-.95.03-1.68-.96-2.29-1.88-1.24-1.88-2.18-5.3-.91-7.52.63-1.1 1.74-1.8 2.94-1.82.92-.02 1.79.62 2.37.62.58 0 1.67-.77 2.81-.66.48.02 1.83.2 2.7 1.48-.07.04-1.61.94-1.64 2.86ZM12.01 3.97c.5-.61.84-1.45.75-2.29-.72.03-1.59.48-2.11 1.09-.47.54-.88 1.39-.77 2.21.8.06 1.62-.41 2.13-1.01Z" />
          </svg>
          <span className={styles.name}>{t('企业运营中心')}</span>
        </div>
        <p className={styles.sub}>{t('通用后台管理模板 · 多语言 · 多页签 · 页面保活')}</p>
        <LoginForm />
      </div>
    </div>
  )
}
