/**
 * @description Dashboard 数据访问端口与统一错误（§7.3）
 *
 * Dashboard 唯一数据访问端口。
 * 页面组件只依赖领域数据，不感知 mock、HTTP 响应码或字段映射。
 *
 * HTTP 适配器独立处理 {code,message,data}、字段转换、单位转换和业务错误；
 * 非成功业务码必须 reject 为统一 DashboardDataError。
 * 当前 HTTP 成功约定为 code === 200 && message === "success"；
 * 该判断只存在于 HTTP 适配器，领域层和组件不得重复判断。
 */
import type { Dayjs } from "dayjs";
import type { FaultAlertData, FaultDetailPage, FaultDetailPageQuery } from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import type { RealtimeDashboardData } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";
import type { TaskStatisticsData } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";

/**
 * Dashboard 唯一数据访问端口。
 * 页面组件只依赖领域数据，不感知 mock、HTTP 响应码或字段映射。
 */
export interface DashboardRepository {
    fetchRealtime(): Promise<RealtimeDashboardData>;
    // 任务统计接口支持任意起止日期与车辆筛选：
    // start/end 为统计窗口（页面 TimeRangePicker 值，业务时区墙钟），
    // vehicleKeys 为空 / 不传 = 全部车辆
    fetchTaskStatistics(start: Dayjs, end: Dayjs, vehicleKeys?: string[]): Promise<TaskStatisticsData>;
    // 故障告警接口支持任意起止时间（startTime/endTime）：
    // start/end 为统计窗口（页面 TimeRangePicker 值，业务时区墙钟），与任务统计口径一致
    fetchFaultAlert(start: Dayjs, end: Dayjs): Promise<FaultAlertData>;
    /**
     * 故障明细分页查询（服务端分页）。
     * 与 fetchFaultAlert 解耦：明细表独占一条查询链路，
     * 筛选 / 翻页只重查明细，不触发整张报表刷新。
     */
    fetchFaultDetailPage(query: FaultDetailPageQuery): Promise<FaultDetailPage>;
}

/**
 * 数据访问错误只向 UI 暴露稳定错误码。
 * 原始后端 message 仅用于受控日志，不直接作为用户可见文案。
 */
export type DashboardDataErrorCode = "NETWORK_ERROR" | "BUSINESS_ERROR" | "INVALID_RESPONSE" | "MOCK_ERROR";

export class DashboardDataError extends Error {
    constructor(readonly code: DashboardDataErrorCode, readonly cause?: unknown) {
        super(code);
        this.name = "DashboardDataError";
    }
}
