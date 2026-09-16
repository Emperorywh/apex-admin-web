/**
 * @description 故障与告警报表页面入口（独立路由）
 *
 * 职责：注册 ECharts Dashboard 特性子集 + 页面布局容器；
 * 数据请求由 FaultAlert 组件直接调用 dashboardRepository 完成。
 *
 * 报表接口均按固定天数统计、不支持任意时间区间查询，
 * 页面不再提供区间工具栏（ReportPageShell / ReportRangeToolbar 已移除）。
 */
import { FaultAlert } from "@/pages/AnalyzeVisual/FaultAlert/FaultAlert";
import "@/pages/AnalyzeVisual/DashboardShared/echarts/registry";
import "@/pages/AnalyzeVisual/DashboardShared/index.less";

/**
 * 故障与告警报表页面。
 */
export default function FaultAlertPage() {
    return (
        <div className="dashboard-page">
            <FaultAlert />
        </div>
    );
}
