/**
 * 登录页（规格 §14.2 /login，公开路由；视觉 SPEC-UI §6 左右分栏版式；
 * SPEC_UI2 §9 继承新 token/字体/卡片规范并加 motion 淡入/上滑入场）：
 * - 左侧品牌区：图形标 + 产品名、标语、主题色派生的渐变/网格装饰（亮暗各自适配）；
 * - 右侧登录区：欢迎语 + LoginForm（账号/密码/登录按钮），无框去重阴影；
 * - 入场动效经 MotionDiv 统一封装（登录页为 noCache 非 Activity 路由，SPEC_UI2 §10 边界内）；
 * - 窄视口（<768px，与壳层移动断点同口径）品牌区隐藏，退化为单列居中表单；
 * - 页面入口只负责布局与业务组件编排；表单行为、登录状态机、错误反馈（主规格 §6/§7）不变。
 */
import { useTranslation } from 'react-i18next'
import { LayoutGrid } from 'lucide-react'
import { MotionDiv } from '@/components/MotionDiv/MotionDiv'
import { containerCascade, varFade, varSlideInUp } from '@/components/MotionDiv/motionVariants'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import styles from './Login.module.css'

export function Login() {
  const { t } = useTranslation()
  return (
    <MotionDiv className={styles.loginPage} variants={containerCascade} initial="hidden" animate="visible">
      <MotionDiv variants={varSlideInUp} className={styles.brandPane}>
        <div className={styles.brandHeader}>
          <span className={styles.brandMark} aria-hidden>
            <LayoutGrid size={16} />
          </span>
          <span className={styles.brandName}>Apex Admin</span>
        </div>
        <div className={styles.brandBody}>
          <p className={styles.brandEyebrow}>{t('通用后台管理模板')}</p>
          <h1 className={styles.brandSlogan}>{t('面向企业场景的现代后台管理起点')}</h1>
        </div>
      </MotionDiv>
      <main className={styles.formPane}>
        <MotionDiv variants={varSlideInUp} className={styles.formBody}>
          <h2 className={styles.welcome}>{t('欢迎回来')}</h2>
          <MotionDiv variants={varFade}>
            <p className={styles.welcomeHint}>{t('使用账号密码登录')}</p>
            <LoginForm />
          </MotionDiv>
        </MotionDiv>
      </main>
    </MotionDiv>
  )
}
