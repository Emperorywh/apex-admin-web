/**
 * Dashboard 请求/响应 DTO（规格 §14.3）：GET /dashboard/overview。
 * 响应载荷与领域实体 DashboardOverview 同形；实体权威定义位于
 * src/types/dashboard/dashboard.types.ts（规格 §3.4 单一权威定义），
 * 此处仅以 import type 别名声明 DTO 名称，不复制接口。
 */
import type { DashboardOverview } from '@/types/dashboard/dashboard.types'

/** GET /dashboard/overview 响应 DTO（规格 §14.3 → DashboardOverview） */
export type GetDashboardOverviewResponseDto = DashboardOverview
