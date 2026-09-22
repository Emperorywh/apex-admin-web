/** 登录入口以单机机器人导航场景呈现产品定位，认证状态由业务表单独立管理。 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	ArrowUpRight,
	Bot,
	ChevronRight,
	Languages,
	Map,
	Pause,
	Play,
	ScanLine,
	Workflow,
} from 'lucide-react'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { localeChanged } from '@/store/slices/settingsSlice'
import { RobotScene } from '@/pages/auth/Login/RobotScene'
import styles from '@/pages/auth/Login/Login.module.css'

/** 功能文案与当前工作台入口对应，仅用于介绍，不在登录前提供业务跳转。 */
const CAPABILITIES = [
	{ icon: ScanLine, label: '实时监控', detail: '感知每一刻', number: '01' },
	{ icon: Map, label: '地图管理', detail: '定义每一步', number: '02' },
	{ icon: Workflow, label: '任务编排', detail: '协同每一程', number: '03' },
] as const

export default function Login() {
	const { t } = useTranslation('auth')
	const dispatch = useAppDispatch()
	const locale = useAppSelector((state) => state.settings.locale)
	// 动效偏好只影响装饰图，不触发设备操作或更改登录状态。
	const [motionPaused, setMotionPaused] = useState(false)

	return (
		<div className={styles.page}>
			{/* 品牌图标、产品名称与语言状态均复用工作台，保证登录前后的产品识别一致。 */}
			<header className={styles.header}>
				<div className={styles.brand}>
					<img
						className={styles.brandMark}
						src="/favicon.ico"
						alt=""
						aria-hidden="true"
					/>
					<span className={styles.brandWord}>
						睿芯行<span>ROBOTICS</span>
					</span>
					<span className={styles.brandDivider} aria-hidden="true" />
					<span className={styles.brandName}>{t('机器人系统')}</span>
				</div>
				<div className={styles.headerActions}>
					<span className={styles.headerCaption}>
						AGV CONTROL SYSTEM
					</span>
					<button
						type="button"
						className={styles.languageButton}
						aria-label={
							locale === 'zh-CN'
								? 'Switch to English'
								: '切换为中文'
						}
						onClick={() =>
							dispatch(
								localeChanged(
									locale === 'zh-CN' ? 'en-US' : 'zh-CN',
								),
							)
						}
					>
						<Languages size={15} aria-hidden="true" />
						{locale === 'zh-CN' ? 'EN' : '中文'}
					</button>
				</div>
			</header>

			<main className={styles.main}>
				{/* 认证面板保持独立阅读顺序，窄屏提前呈现表单，避免插图推迟主要操作。 */}
				<section
					className={styles.accessPanel}
					aria-labelledby="login-heading"
				>
					<div className={styles.panelTopline}>
						<span>WORKSPACE ACCESS</span>
						<span>01 / LOGIN</span>
					</div>
					<div className={styles.panelBody}>
						<div className={styles.loginEyebrow}>
							<ScanLine
								size={17}
								strokeWidth={1.4}
								aria-hidden="true"
							/>
							WELCOME TO 睿芯行
						</div>
						<h2 id="login-heading">{t('欢迎进入控制中心')}</h2>
						<p className={styles.loginDescription}>
							{t('登录您的账号，开启机器人工作空间。')}
						</p>
						<LoginForm />
						<div className={styles.accountNote}>
							<span className={styles.noteLine} />
							<span>{t('账号访问')}</span>
							<span className={styles.noteLine} />
						</div>
						<p className={styles.accountHelp}>
							{t('账号由管理员统一分配')}
							<br />
							<span>{t('如需帮助，请联系系统管理员。')}</span>
						</p>
					</div>
					<div className={styles.panelFooter}>
						<Bot size={14} aria-hidden="true" />
						<span>{t('机器人控制工作空间')}</span>
						<ChevronRight size={13} aria-hidden="true" />
					</div>
				</section>

				<section
					className={styles.showcase}
					aria-labelledby="login-product-heading"
				>
					<div className={styles.eyebrow}>
						<span aria-hidden="true" />
						PRECISION IN MOTION
					</div>
					<h1 id="login-product-heading" className={styles.headline}>
						{t('让每一步')}
						<br />
						<span>{t('尽在掌控。')}</span>
					</h1>
					<p className={styles.description}>
						{t('连接感知、导航与执行，让机器人的每一步井然有序。')}
					</p>

					{/* 概念图不展示伪造的在线数量或实时读数；动效可暂停并遵循系统减弱动态偏好。 */}
					<figure className={styles.scene}>
						<div className={styles.sceneHeader}>
							<span>
								<i aria-hidden="true" />
								AUTONOMOUS NAVIGATION
							</span>
							<button
								type="button"
								className={styles.motionButton}
								aria-label={
									motionPaused
										? t('播放场景动效')
										: t('暂停场景动效')
								}
								aria-pressed={motionPaused}
								onClick={() =>
									setMotionPaused((paused) => !paused)
								}
							>
								{motionPaused ? (
									<Play size={11} aria-hidden="true" />
								) : (
									<Pause size={11} aria-hidden="true" />
								)}
								{t('场景演示')}
							</button>
						</div>
						<RobotScene paused={motionPaused} />
						<figcaption className={styles.sceneCaption}>
							<span>AGV / INTELLIGENT OPERATIONS</span>
							<span>
								{t('精准定位 · 有序执行')}
								<ArrowUpRight size={12} aria-hidden="true" />
							</span>
						</figcaption>
					</figure>

					<ul className={styles.capabilities}>
						{CAPABILITIES.map(
							({ icon: Icon, label, detail, number }) => (
								<li key={number}>
									<Icon
										size={19}
										strokeWidth={1.5}
										aria-hidden="true"
									/>
									<div>
										<strong>{t(label)}</strong>
										<span>{t(detail)}</span>
									</div>
									<small aria-hidden="true">{number}</small>
								</li>
							),
						)}
					</ul>
				</section>
			</main>

			{/* 页脚只标示产品与设计主张，不把静态装饰伪装为服务连接状态。 */}
			<footer className={styles.footer}>
				<span>
					睿芯行 ROBOTICS
					<span className={styles.footerSeparator}>/</span>
					{t('机器人控制系统')}
				</span>
				<span>BUILT FOR PRECISION. DESIGNED FOR CONTROL.</span>
			</footer>
		</div>
	)
}
