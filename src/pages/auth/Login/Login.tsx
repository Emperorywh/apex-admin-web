/**
 * 登录页（P01）：品牌背景 + 玻璃卡片表单 + 五语言切换。
 *
 * - 品牌背景走真实接口 GET /systemLogos/loginBackground/file（旧系统同源行为）；
 *   品牌资源是装饰层，加载失败/无图/非图片一律回退默认壁纸，不阻塞真实登录（规格 P01）
 * - 会话与落点由 LoginForm → useLogin → routeAccess 处理（T00 基座），本页不另造认证状态
 * - 语言切换入口见 LoginLanguageSwitch（I01：登录前即可切换五语言）
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import { LoginLanguageSwitch } from '@/features/auth/components/LoginLanguageSwitch/LoginLanguageSwitch'
import { fetchSystemImageBlob, isUsableImageBlob } from '@/services/system/brand/brand.service'
import styles from '@/pages/auth/Login/Login.module.css'

/** 登录页品牌背景的 placementKey（旧系统登录页同源取值） */
const LOGIN_BACKGROUND_KEY = 'loginBackground'

export default function Login() {
  const { t } = useTranslation('auth')
  // 品牌背景的本地 objectURL；null = 无自定义背景（保持默认壁纸）
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  // 持有当前 objectURL 引用，卸载时精确释放，避免 revoke 掉后赋值的新 URL
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSystemImageBlob(LOGIN_BACKGROUND_KEY)
      .then((blob) => {
        // 非图片/空体不当作背景（后端可能返回空 200），不盲信媒体内容
        if (cancelled || !isUsableImageBlob(blob)) return
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setBackgroundUrl(url)
      })
      .catch(() => {
        // 品牌图不可得（未上传/网络异常/未激活环境）：回退默认壁纸，静默不阻塞登录
      })
    return () => {
      cancelled = true
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  return (
    <div className={styles.wrap}>
      {backgroundUrl && (
        // 品牌背景层：位于壁纸之上、卡片之下，纯装饰不参与交互
        <img className={styles.brandBg} src={backgroundUrl} alt="" aria-hidden="true" />
      )}
      <LoginLanguageSwitch />
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
