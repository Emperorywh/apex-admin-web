/**
 * 稳定重定向目标与登录回跳地址构造。
 */

import { LOGIN_REDIRECT_QUERY_KEY } from '@/constants/auth/auth.constants'
import { ROUTE_PATHS } from '@/router/definitions'

/** 受保护根 index（/）固定进入机器人监控，登录后直接查看单机状态。 */
export const ROOT_REDIRECT_TARGET = ROUTE_PATHS['robot-monitor']

/** 登录页地址；携带回跳参数以登录后返回原页面 */
export function buildLoginPath(
	fromPathname: string,
	fromSearch: string,
): string {
	const redirect = `${fromPathname}${fromSearch}`
	if (redirect === ROUTE_PATHS.root) return ROUTE_PATHS['auth-login']
	const params = new URLSearchParams({ [LOGIN_REDIRECT_QUERY_KEY]: redirect })
	return `${ROUTE_PATHS['auth-login']}?${params.toString()}`
}
