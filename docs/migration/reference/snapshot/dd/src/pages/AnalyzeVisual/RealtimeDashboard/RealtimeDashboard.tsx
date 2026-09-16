/**
 * @description 实时看板内容（§5.1）
 *
 * 展示当前快照以及今日累计指标，不受报表时间选择器影响。
 *   - 8 个 KPI（2 行 × 4）
 *   - AGV 状态分布环形饼图（中心显示在线数）
 *   - 今日任务完成趋势双折线（今日 vs 昨日按小时对比，截至当前小时）
 *   - 实时告警滚动列表（只展示未关闭告警，已对接真实接口 isClosed=false；
 *     告警链路失败独立降级为空列表，不影响其余面板）
 *   - 最近完成任务滚动表（本期不对接，恒为空）
 *
 * 空/loading 态（§15）：
 *   - 请求失败按空数据降级：KPI 显示 "--"、图表与列表显示空态，不展示错误摘要
 *   - 首次加载：KPI 与面板 loading
 *   - 数据更新使用稳定 id 合并；已有项目保持相对顺序，新项目插入顶部（§5.1）
 */
import { Empty, Tag } from "antd";
import {
    CarOutlined,
    ClockCircleOutlined,
    FieldTimeOutlined,
    InboxOutlined,
    LineChartOutlined,
    UnorderedListOutlined,
} from "@ant-design/icons";
import { useI18n } from "@/hooks/useI18n";
import { ChartPanel } from "@/pages/AnalyzeVisual/DashboardShared/components/ChartPanel";
import { KpiCard } from "@/pages/AnalyzeVisual/DashboardShared/components/KpiCard";
import { formatDateTime, formatDuration } from "@/pages/AnalyzeVisual/DashboardShared/model/formatters";
import {
    buildKpiViewModel,
    buildScalarKpiViewModel,
} from "@/pages/AnalyzeVisual/DashboardShared/model/kpiViewModel";
import {
    ALERT_LEVEL_LABEL,
    ALERT_LEVEL_TAG_COLOR,
    TASK_TYPE_LABEL,
} from "@/pages/AnalyzeVisual/DashboardShared/model/enumLabels";
import { resolveFaultDescription } from "@/pages/AnalyzeVisual/FaultAlert/model/selectors";
import {
    ONLINE_VEHICLE_DEFINITION,
    REALTIME_KPI_DEFINITIONS,
} from "@/pages/AnalyzeVisual/RealtimeDashboard/model/kpiDefinitions";
import type {
    RealtimeAlertItem,
    RealtimeDashboardData,
    RecentTaskItem,
} from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";
import { VehicleStatusPie } from "@/pages/AnalyzeVisual/RealtimeDashboard/charts/VehicleStatusPie";
import { TodayTaskTrendLine } from "@/pages/AnalyzeVisual/RealtimeDashboard/charts/TodayTaskTrendLine";

export interface RealtimeDashboardProps {
    /** 当前快照；尚未首次成功或最近一次请求失败（按空数据降级）时为 null */
    data: RealtimeDashboardData | null;
    /** 是否正在请求（仅首次加载时展示骨架） */
    loading: boolean;
}

/**
 * 实时看板主内容（纯展示）。数据由页面入口请求后通过 props 传入。
 * 计算方式说明统一从语言文件读取，中文文案使用业务名称、中文状态和单位。
 * 说明中需区分按创建时间与按完成时间统计，避免直接展示接口字段名。
 */
export function RealtimeDashboard({ data, loading }: RealtimeDashboardProps) {
    const { t, locale } = useI18n();

    // 首次加载：保持布局骨架（§15）
    const isLoading = loading && !data;
    const kpis = data?.kpis;

    return (
        <div>
            {/* KPI 行 1 */}
            <div className="dashboard-kpi-row">
                <KpiCard
                    label={t(REALTIME_KPI_DEFINITIONS.todayTaskTotal.labelKey)}
                    icon={<UnorderedListOutlined />}
                    loading={isLoading}
                    hint={t("今日任务总数·计算方式")}
                    value={
                        kpis
                            ? buildKpiViewModel(kpis.todayTaskTotal, REALTIME_KPI_DEFINITIONS.todayTaskTotal, locale)
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t(REALTIME_KPI_DEFINITIONS.todayCompletionRate.labelKey)}
                    icon={<LineChartOutlined />}
                    loading={isLoading}
                    hint={t("今日任务完成率·计算方式")}
                    value={
                        kpis
                            ? buildKpiViewModel(
                                  kpis.todayCompletionRate,
                                  REALTIME_KPI_DEFINITIONS.todayCompletionRate,
                                  locale,
                              )
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t(ONLINE_VEHICLE_DEFINITION.labelKey)}
                    icon={<CarOutlined />}
                    loading={isLoading}
                    hint={t("在线 AGV / 总 AGV·计算方式")}
                    value={
                        kpis
                            ? {
                                  displayValue: `${kpis.onlineVehicleCount} / ${kpis.totalVehicleCount}`,
                                  changeTone: "neutral",
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t(REALTIME_KPI_DEFINITIONS.faultVehicleCount.labelKey)}
                    icon={<CarOutlined />}
                    loading={isLoading}
                    hint={t("故障 AGV 数·计算方式")}
                    value={
                        kpis
                            ? {
                                  ...buildKpiViewModel(
                                      kpis.faultVehicleCount,
                                      REALTIME_KPI_DEFINITIONS.faultVehicleCount,
                                      locale,
                                  ),
                                  accent: (kpis.faultVehicleCount.current ?? 0) > 0 ? "danger" : undefined,
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
            </div>
            {/* KPI 行 2 */}
            <div className="dashboard-kpi-row">
                <KpiCard
                    label={t(REALTIME_KPI_DEFINITIONS.averageCompletedDurationMs.labelKey)}
                    icon={<ClockCircleOutlined />}
                    loading={isLoading}
                    hint={t("今日已完成任务平均耗时·计算方式")}
                    value={
                        kpis
                            ? buildKpiViewModel(
                                  kpis.averageCompletedDurationMs,
                                  REALTIME_KPI_DEFINITIONS.averageCompletedDurationMs,
                                  locale,
                              )
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t(REALTIME_KPI_DEFINITIONS.averageHourlyCompletedCount.labelKey)}
                    icon={<FieldTimeOutlined />}
                    loading={isLoading}
                    hint={t("今日平均每小时完成任务数·计算方式")}
                    value={
                        kpis
                            ? buildKpiViewModel(
                                  kpis.averageHourlyCompletedCount,
                                  REALTIME_KPI_DEFINITIONS.averageHourlyCompletedCount,
                                  locale,
                              )
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t(REALTIME_KPI_DEFINITIONS.fleetUtilization.labelKey)}
                    icon={<LineChartOutlined />}
                    loading={isLoading}
                    hint={t("AGV 综合利用率·计算方式")}
                    value={
                        kpis
                            ? buildKpiViewModel(
                                  kpis.fleetUtilization,
                                  REALTIME_KPI_DEFINITIONS.fleetUtilization,
                                  locale,
                              )
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
                <KpiCard
                    label={t(REALTIME_KPI_DEFINITIONS.backlogCount.labelKey)}
                    icon={<InboxOutlined />}
                    loading={isLoading}
                    hint={t("当前任务积压·计算方式")}
                    value={
                        kpis
                            ? {
                                  ...buildScalarKpiViewModel(
                                      kpis.backlogCount.current,
                                      REALTIME_KPI_DEFINITIONS.backlogCount,
                                      locale,
                                  ),
                                  accent: (kpis.backlogCount.current ?? 0) > 5 ? "warn" : undefined,
                              }
                            : { displayValue: "--", changeTone: "neutral" }
                    }
                />
            </div>

            {/* 图表与列表 2×2 */}
            <div className="dashboard-chart-grid">
                <ChartPanel
                    title={t("AGV 状态分布")}
                    loading={isLoading}
                    empty={!data?.vehicleStatus.length}
                    ariaLabelDescription={t("AGV 状态分布环形图")}
                    hint={t("AGV 状态分布·计算方式")}
                >
                    {data && (
                        <VehicleStatusPie
                            data={data.vehicleStatus}
                            onlineCount={kpis?.onlineVehicleCount ?? 0}
                        />
                    )}
                </ChartPanel>
                <ChartPanel
                    title={t("今日任务完成趋势")}
                    loading={isLoading}
                    empty={!data?.todayTaskTrend.length}
                    ariaLabelDescription={t("今日任务完成趋势对比折线图")}
                    hint={t("今日任务完成趋势·计算方式")}
                >
                    {data && <TodayTaskTrendLine data={data.todayTaskTrend} />}
                </ChartPanel>
                <ChartPanel title={t("实时告警")} loading={isLoading} ariaLabelDescription={t("实时告警滚动列表")} hint={t("实时告警·计算方式")}>
                    {data && data.openAlerts.length ? (
                        <RealtimeAlertList items={data.openAlerts} locale={locale} />
                    ) : (
                        <Empty description={t("暂无未关闭告警")} />
                    )}
                </ChartPanel>
            </div>
        </div>
    );
}

/**
 * 实时告警滚动列表。
 * 数据更新使用稳定 id 合并（§5.1）；hover/focus/reduced-motion 时暂停（§12.2）。
 */
function RealtimeAlertList({ items, locale }: { items: RealtimeAlertItem[]; locale: string }) {
    const { t } = useI18n();
    return (
        <div style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
            {items.map((item) => (
                <div
                    key={item.id}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--dashboard-border, rgba(0,0,0,0.06))",
                        fontSize: 12,
                    }}
                >
                    <Tag color={ALERT_LEVEL_TAG_COLOR[item.level]} style={{ margin: 0 }}>
                        {t(ALERT_LEVEL_LABEL[item.level])}
                    </Tag>
                    <span style={{ fontWeight: 500 }}>{item.vehicleId}</span>
                    <span style={{ flex: 1, color: "var(--dashboard-text-secondary, rgba(0,0,0,0.45))" }}>
                        {/* 译文回退链：当前语言 → zh_CN → en_US → 原文（与故障明细表同口径）；全空显示 "--" */}
                        {resolveFaultDescription(item.description, locale) || "--"}
                    </span>
                    <span style={{ color: "var(--dashboard-text-secondary, rgba(0,0,0,0.45))", whiteSpace: "nowrap" }}>
                        {formatDateTime(item.occurredAt, locale)}
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>{formatDuration(item.durationMs, locale)}</span>
                </div>
            ))}
        </div>
    );
}

/**
 * 最近完成任务滚动表。
 */
function RecentTaskList({ items, locale }: { items: RecentTaskItem[]; locale: string }) {
    const { t } = useI18n();
    return (
        <div style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ color: "var(--dashboard-text-secondary, rgba(0,0,0,0.45))", textAlign: "left" }}>
                        <th style={{ padding: "6px 8px" }}>{t("任务 ID")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("AGV")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("类型")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("起终点")}</th>
                        <th style={{ padding: "6px 8px" }}>{t("耗时")}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid var(--dashboard-border, rgba(0,0,0,0.06))" }}>
                            <td style={{ padding: "6px 8px" }}>{item.id}</td>
                            <td style={{ padding: "6px 8px" }}>{item.vehicleId}</td>
                            <td style={{ padding: "6px 8px" }}>{t(TASK_TYPE_LABEL[item.type])}</td>
                            <td style={{ padding: "6px 8px" }}>
                                {item.startPoint} → {item.endPoint}
                            </td>
                            <td style={{ padding: "6px 8px" }}>{formatDuration(item.durationMs, locale)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
