/**
 * @description AGV 各状态总时长统计页面入口
 *
 * 职责：注册 ECharts Dashboard 特性子集 + 引入 Dashboard 共享网格样式 +
 * 页面布局容器；数据请求与聚合逻辑由 VehicleStatus 组件直接完成
 * （调用 @/api 的 agvExecutingTimeStatistics，页面直接持有数据逻辑）。
 */
import { VehicleStatus } from "@/pages/AnalyzeVisual/VehicleStatus/VehicleStatus";
import "@/pages/AnalyzeVisual/DashboardShared/echarts/registry";
import "@/pages/AnalyzeVisual/DashboardShared/index.less";

/**
 * AGV 各状态总时长统计页面。
 */
export default function VehicleStatusPage() {
    return (
        <div className="dashboard-page">
            <VehicleStatus />
        </div>
    );
}
