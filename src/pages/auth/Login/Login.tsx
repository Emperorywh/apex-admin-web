/**
 * 登录页（规格 §14.2 /login，公开路由；视觉 SPEC_UI2 §9）：
 * - 左右分栏结构与表单行为零变更（第一轮版式保留），继承新 token
 *   （圆角/字体/14px/色板）与卡片规范；
 * - motion 淡入/上滑入场编排（登录页为非缓存路由，无 Activity 冲突，§10 红线合规；
 *   prefers-reduced-motion 经 MotionConfig 全局降级）；
 * - 左侧品牌区：图形标 + 产品名、标语、主题色派生的渐变/网格装饰（亮暗各自适配）；
 *   demo 构建下展示演示账号提示（静态条件 + 动态 import，off 构建整体剔除，规格 §13.3）；
 * - 窄视口（<768px，与壳层移动断点同口径）品牌区隐藏，退化为单列居中表单；
 * - 页面入口只负责布局与业务组件编排；表单行为、登录状态机、错误反馈（主规格 §6/§7）不变。
 */
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid } from 'lucide-react'
import { AnimateContainer, AnimateItem } from '@/components/Animate/Animate'
import { varFade, varSlideLeft, varSlideUp } from '@/components/Animate/Animate.variants'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import styles from './Login.module.css'

/**
 * 演示账号提示：off 构建下静态条件使动态 import 被 Rollup 剔除，
 * demo 模块完全不进入产物；force/fallback 构建懒加载组件。
 */
const DemoLoginHintLazy =
  import.meta.env.VITE_DEMO_MODE === 'off'
    ? null
    : lazy(() =>
        import('@/features/demo/components/DemoLoginHint/DemoLoginHint').then((module) => ({
          default: module.DemoLoginHint,
        })),
      )

export function Login() {
  const { t } = useTranslation()
  return (
    <div className={styles.loginPage}>
      <aside className={styles.brandPane}>
        {/* 入场编排（SPEC_UI2 §9）：品牌区横向滑入级联 */}
        <AnimateContainer className={styles.brandEntrance} stagger={0.08}>
          <AnimateItem variants={varSlideLeft()}>
            <div className={styles.brandHeader}>
              <span className={styles.brandMark} aria-hidden>
                <LayoutGrid size={16} />
              </span>
              <span className={styles.brandName}>Apex Admin</span>
            </div>
          </AnimateItem>
          <div className={styles.brandBody}>
            <AnimateItem variants={varSlideUp()}>
              <p className={styles.brandEyebrow}>{t('通用后台管理模板')}</p>
            </AnimateItem>
            <AnimateItem variants={varSlideUp()}>
              <h1 className={styles.brandSlogan}>{t('面向企业场景的现代后台管理起点')}</h1>
            </AnimateItem>
            {DemoLoginHintLazy !== null && (
              <AnimateItem variants={varFade()}>
                <Suspense fallback={null}>
                  <DemoLoginHintLazy />
                </Suspense>
              </AnimateItem>
            )}
          </div>
        </AnimateContainer>
      </aside>
      <main className={styles.formPane}>
        {/* 入场编排（SPEC_UI2 §9）：表单区上滑淡入级联 */}
        <AnimateContainer className={styles.formBody} stagger={0.08}>
          <AnimateItem variants={varSlideUp()}>
            <h2 className={styles.welcome}>{t('欢迎回来')}</h2>
          </AnimateItem>
          <AnimateItem variants={varSlideUp()}>
            <p className={styles.welcomeHint}>{t('使用账号密码登录')}</p>
          </AnimateItem>
          <AnimateItem variants={varSlideUp(20)}>
            <LoginForm />
          </AnimateItem>
        </AnimateContainer>
      </main>
    </div>
  )
}
