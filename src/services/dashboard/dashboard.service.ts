/**
 * Dashboard 概览接口（规格 §14.3）：GET /dashboard/overview → DashboardOverview。
 * 经封装的 request<T>() 完成类型解包（规格 §7.1）；endpoint 引用 dashboard 域常量，
 * 不在调用点内联字符串。send 参数默认真实 request 传输；页面 Hook 注入
 * usePageRequest() 返回的页签作用域请求函数，使该请求随页签隐藏/关闭/淘汰统一取消
 * （规格 §7.4-6），本模块保持传输无关。
 */
import type { AxiosRequestConfig } from 'axios'
import { DASHBOARD_ENDPOINTS } from '@/constants/dashboard/dashboard.constants'
import { request } from '@/services/request/request'
import type { GetDashboardOverviewResponseDto } from './dashboard.service.types'

/** 请求发送函数形态：结构兼容 request 与 usePageRequest() 的返回值 */
export type SendRequest = <T>(config: AxiosRequestConfig) => Promise<T>

/** 获取 Dashboard 概览：GET /dashboard/overview（规格 §14.3） */
export function getDashboardOverview(send: SendRequest = request): Promise<GetDashboardOverviewResponseDto> {
  return send<GetDashboardOverviewResponseDto>({
    url: DASHBOARD_ENDPOINTS.OVERVIEW,
    method: 'get',
  })
}
