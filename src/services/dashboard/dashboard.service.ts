/**
 * Dashboard 概览接口（规格 §14.3）：GET /dashboard/overview → DashboardOverview。
 * 经封装的 request<T>() 完成类型解包（规格 §7.1）；接口路径在请求调用点直接内联
 * （规格 §14.3 v1.8）。send 参数默认真实 request 传输；页面 Hook 注入
 * usePageRequest() 返回的页签作用域请求函数，使该请求随页签隐藏/关闭/淘汰统一取消
 * （规格 §7.4-6），本模块保持传输无关。
 */
import { request } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import type { GetDashboardOverviewResponseDto } from './dashboard.service.types'

/** 获取 Dashboard 概览：GET /dashboard/overview（规格 §14.3） */
export function getDashboardOverview(send: SendRequest = request): Promise<GetDashboardOverviewResponseDto> {
  return send<GetDashboardOverviewResponseDto>({
    url: '/dashboard/overview',
    method: 'get',
  })
}
