/**
 * 登录页（规格 §14.2 /login，公开路由；视觉 SPEC-UI §6 左右分栏版式）：
 * - 左侧品牌区：图形标 + 产品名、标语、主题色派生的渐变/网格装饰（亮暗各自适配）；
 *   demo 构建下展示演示账号提示（静态条件 + 动态 import，off 构建整体剔除，规格 §13.3）；
 * - 右侧登录区：欢迎语 + LoginForm（账号/密码/登录按钮），无框去重阴影；
 * - 窄视口（<768px，与壳层移动断点同口径）品牌区隐藏，退化为单列居中表单；
 * - 页面入口只负责布局与业务组件编排；表单行为、登录状态机、错误反馈（主规格 §6/§7）不变。
 */
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid } from 'lucide-react'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import styles from './Login.module.css'

/**
 * 演示账号提示（SPEC-UI §6）：off 构建下静态条件使动态 import 被 Rollup 剔除，
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
        <div className={styles.brandHeader}>
          <span className={styles.brandMark} aria-hidden>
            <LayoutGrid size={16} />
          </span>
          <span className={styles.brandName}>Apex Admin</span>
        </div>
        <div className={styles.brandBody}>
          <p className={styles.brandEyebrow}>{t('通用后台管理模板')}</p>
          <h1 className={styles.brandSlogan}>{t('面向企业场景的现代后台管理起点')}</h1>
          {DemoLoginHintLazy !== null && (
            <Suspense fallback={null}>
              <DemoLoginHintLazy />
            </Suspense>
          )}
        </div>
      </aside>
      <main className={styles.formPane}>
        <div className={styles.formBody}>
          <h2 className={styles.welcome}>{t('欢迎回来')}</h2>
          <p className={styles.welcomeHint}>{t('使用账号密码登录')}</p>
          <LoginForm />
        </div>
      </main>
    </div>
  )
}
