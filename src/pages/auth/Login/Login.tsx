/**
 * 登录页：明亮玻璃卡片风格（P01，保持当前视觉）。
 * T017 接入：登录背景配置（loginBackground 位置系统图 + 默认回退）、
 * 页面级五语切换入口、会话过期提示（由 auth.service 失效收敛时标记）。
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { App } from 'antd'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import { LanguageMenu } from '@/components/LanguageMenu/LanguageMenu'
import { useSystemImage } from '@/hooks/useSystemImage'
import { SESSION_EXPIRED_NOTICE_KEY } from '@/services/auth/auth.service'
import styles from '@/pages/auth/Login/Login.module.css'

export default function Login() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const { notification } = App.useApp()
  /* G04：登录背景读取系统配置；未配置/登录前无 token 时回退空值——
     不覆盖全局 Wallpaper，保持当前默认视觉（源行为 catch → default） */
  const { url: backgroundUrl } = useSystemImage('loginBackground', '')

  useEffect(() => {
    // 会话过期标记（T017）：读取即清除，仅在本次进入登录页提示一次
    try {
      if (sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1') {
        sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY)
        notification.warning({
          message: t('登录过期'),
          description: t('登录已过期，请重新登录'),
          duration: 5,
        })
      }
    } catch {
      // storage 不可用时静默跳过，不影响登录
    }
  }, [notification, t])

  return (
    <div
      className={styles.wrap}
      /* 有配置背景时盖在全局 Wallpaper 之上（cover 铺满不变形，源行为） */
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
    >
      {/* 语言切换入口：固定右上角，与顶栏共享同一份五语菜单 */}
      <div className={styles.localeSwitch}>
        <LanguageMenu className={styles.localeTrigger} iconSize={20} />
      </div>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img className={styles.brandIcon} src="/favicon.ico" alt="" aria-hidden="true" />
          <span className={styles.name}>{tCommon('调度系统')}</span>
        </div>
        <p className={styles.sub}>{t('通用后台管理模板 · 多语言 · 多页签 · 页面保活')}</p>
        <LoginForm />
      </div>
    </div>
  )
}
