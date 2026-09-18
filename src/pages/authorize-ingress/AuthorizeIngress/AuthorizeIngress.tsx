/**
 * 软件授权页（P02，独立全屏页，受认证守卫但非公开——规格 5.6）。
 *
 * 业务流程（旧 AuthorizeIngress 迁移）：
 * - 挂载即读取真实硬件码（GET /auth/license/getHardwareInfo），失败显示错误
 *   并提供重试（DoD 6），不以占位符冒充成功；
 * - 硬件码一键复制（内网 http 环境 execCommand 兜底），便于用户发送给管理员
 *   换取激活码；
 * - 激活码输入与提交由可复用组件 ActivationForm 承接（P29 软件信息页复用）；
 *   失败保留输入，成功仅以后端 code=200 判定；
 * - 激活成功：本地会话 activated 更新为真实状态（activationConfirmed），
 *   随后按登录落点规则（resolveLandingPath）依据真实会话与权限导航——
 *   不复刻旧系统硬编码跳 /over-look 的行为；
 * - 返回登录：replace 到登录页（保留会话，由登录页统一处理后续）。
 *
 * 视觉沿用旧系统「深蓝科技大屏」风格（独立页固定深色，不随外壳浅色主题变化，
 * 与旧系统行为一致）；图标体系对齐目标项目（lucide）。
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { App, Button, ConfigProvider, Spin, theme } from 'antd'
import { Copy, KeyRound, RotateCcw } from 'lucide-react'
import { ActivationForm } from '@/features/license-activation/components/ActivationForm/ActivationForm'
import { copyTextToClipboard } from '@/features/license-activation/utils/copyText'
import { useHardwareInfo } from '@/features/license-activation/hooks/useHardwareInfo'
import { activationConfirmed } from '@/store/slices/authSlice'
import { store } from '@/store/store'
import { resolveLandingPath } from '@/router/routeAccess'
import { ROUTE_PATHS } from '@/router/definitions'
import styles from '@/pages/authorize-ingress/AuthorizeIngress/AuthorizeIngress.module.css'

export default function AuthorizeIngress() {
  const { t } = useTranslation('license-activation')
  const navigate = useNavigate()
  const { message } = App.useApp()
  // 硬件码真实加载状态：加载中 / 失败（可重试）/ 成功
  const { hardwareId, loading, error, reload } = useHardwareInfo()

  /** 复制硬件码：成功才提示（旧系统同源行为） */
  const handleCopy = useCallback(async () => {
    if (!hardwareId) return
    if (await copyTextToClipboard(hardwareId)) {
      void message.success(t('复制成功'))
    }
  }, [hardwareId, message, t])

  /** 激活成功：更新会话激活状态（真实结果）后按落点规则导航（D29/规格 5.6） */
  const handleActivated = useCallback(() => {
    // 先落库激活状态，再从 store 读最新会话计算落点（组件闭包快照不可靠）
    store.dispatch(activationConfirmed())
    const landing = resolveLandingPath(store.getState().auth)
    navigate(landing, { replace: true })
  }, [navigate])

  /** 返回登录：replace 避免授权页残留在历史记录 */
  const handleBackToLogin = useCallback(() => {
    navigate(ROUTE_PATHS['auth-login'], { replace: true })
  }, [navigate])

  return (
    <div className={styles.auth}>
      {/* 装饰性背景水印，纯展示 */}
      <div className={styles.watermark}>LICENSE</div>
      {/*
       * 深色主题：页面为布局外独立全屏页，固定深色呈现（与旧系统一致）；
       * 局部 darkAlgorithm 让输入框/按钮融入深色卡片，强调色沿用旧系统青蓝
       */}
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#35c8ff',
            colorInfo: '#35c8ff',
            borderRadius: 2,
          },
        }}
      >
        <div className={styles.card}>
          <div className={styles.emblem}>
            <KeyRound strokeWidth={2} />
          </div>
          {/* 标题行：两侧翼形装饰线 + 辉光标题（旧系统同源视觉） */}
          <div className={styles.titleRow}>
            <span className={`${styles.wing} ${styles.wingLeft}`} />
            <h2 className={styles.title}>{t('软件授权')}</h2>
            <span className={`${styles.wing} ${styles.wingRight}`} />
          </div>
          <p className={styles.titleEn}>SOFTWARE LICENSE ACTIVATION</p>
          <p className={styles.subtitle}>
            {t('系统尚未激活，请将硬件码提供给管理员以获取激活码')}
          </p>

          <div className={styles.fieldLabel}>
            <span>{t('硬件码')}</span>
            <span
              className={styles.copyBtn}
              onClick={handleCopy}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') void handleCopy()
              }}
            >
              <Copy size={13} strokeWidth={2} />
              {t('复制')}
            </span>
          </div>
          {/*
           * 硬件码区域三态（DoD 6：真实失败不用占位符冒充成功）：
           * 加载中 → 指示器；失败 → 错误文案 + 重试按钮；成功 → 硬件码
           */}
          <div className={styles.hardwareId}>
            {loading && <Spin size="small" aria-label={t('硬件码')} />}
            {!loading && error && (
              <span className={styles.hardwareError}>
                <span className={styles.hardwareErrorText}>
                  {t('查询硬件信息出错')}
                  {error ? `：${error}` : ''}
                </span>
                <Button size="small" icon={<RotateCcw size={12} strokeWidth={2} />} onClick={reload}>
                  {t('重试')}
                </Button>
              </span>
            )}
            {!loading && !error && (hardwareId || '—')}
          </div>

          {/* 激活码输入 + 提交（可复用业务组件，P29 复用）；onBack 渲染返回登录 */}
          <ActivationForm onActivated={handleActivated} onBack={handleBackToLogin} />
        </div>
      </ConfigProvider>
    </div>
  )
}
