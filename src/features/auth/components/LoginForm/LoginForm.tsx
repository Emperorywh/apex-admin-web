/**
 * 登录表单：用户名 + 密码，成功后按 redirect 参数回跳。
 * 后端未接入期间登录直通，密码仅做必填校验。
 */

import { App, Button, Form, Input } from 'antd'
import { ArrowRight, LockKeyhole, UserRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	LOGIN_REDIRECT_QUERY_KEY,
} from '@/constants/auth/auth.constants'
import { FALLBACK_PATH } from '@/constants/route.constants'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { apiErrorMessage } from '@/services/request/request'
import styles from '@/features/auth/components/LoginForm/LoginForm.module.css'

/** 登录凭据只交给现有认证流程处理，表单不额外保存密码。 */
interface LoginFormValues {
	username: string
	password: string
}

export function LoginForm() {
	const { t } = useTranslation('auth')
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const { submitting, submit } = useLogin()
	const { message } = App.useApp()

	// 校验通过后沿用认证状态及站内回跳规则；失败消息由全局消息容器展示。
	const handleFinish = async (values: LoginFormValues) => {
		try {
			await submit(values)
			const redirect = searchParams.get(LOGIN_REDIRECT_QUERY_KEY)
			navigate(
				redirect && redirect.startsWith('/') ? redirect : FALLBACK_PATH,
				{ replace: true },
			)
		} catch (error) {
			const text = apiErrorMessage(error)
			void message.error(text || t('登录失败，请稍后重试'))
		}
	}

	return (
		// 纵向标签适配窄屏；表单名称为输入生成唯一 id，使标签点击和辅助技术能关联字段。
		<Form<LoginFormValues>
			name="apex-login"
			layout="vertical"
			size="large"
			className={styles.form}
			requiredMark={false}
			onFinish={handleFinish}
		>
			<Form.Item
				name="username"
				label={t('用户名')}
				rules={[
					{ required: true, message: t('请输入用户名') },
					{
						min: USERNAME_MIN_LENGTH,
						max: USERNAME_MAX_LENGTH,
						message: t('用户名长度需在 2-32 个字符之间'),
					},
				]}
			>
				{/* 线性图标仅作视觉提示，实际字段名称由上方标签提供。 */}
				<Input
					className={styles.field}
					prefix={
						<UserRound
							size={18}
							strokeWidth={1.6}
							aria-hidden="true"
						/>
					}
					placeholder={t('请输入用户名')}
					autoComplete="username"
				/>
			</Form.Item>
			<Form.Item
				name="password"
				label={t('密码')}
				rules={[{ required: true, message: t('请输入密码') }]}
			>
				{/* 保留密码显示切换与浏览器凭据填充，输入及回车提交均使用原生表单交互。 */}
				<Input.Password
					className={styles.field}
					prefix={
						<LockKeyhole
							size={18}
							strokeWidth={1.6}
							aria-hidden="true"
						/>
					}
					placeholder={t('请输入密码')}
					autoComplete="current-password"
				/>
			</Form.Item>
			{/* 提交状态复用认证 Hook，固定按钮高度与宽度，避免加载文案引起布局跳动。 */}
			<Button
				type="primary"
				size="large"
				htmlType="submit"
				block
				loading={submitting}
				aria-busy={submitting}
				className={styles.submit}
			>
				<span className={styles.submitContent}>
					{submitting ? t('正在登录') : t('进入控制台')}
					<ArrowRight
						size={18}
						strokeWidth={1.8}
						aria-hidden="true"
					/>
				</span>
			</Button>
		</Form>
	)
}
