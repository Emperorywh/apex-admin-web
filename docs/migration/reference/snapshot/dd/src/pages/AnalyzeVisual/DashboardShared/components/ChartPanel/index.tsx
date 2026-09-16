/**
 * @description 图表面板容器（§10.2）
 *
 * - ChartPanel 使用 Ant Design Card，标题由 React 渲染，
 *   不注册或使用 ECharts TitleComponent（§10.2）。
 * - 默认图表高度 280px，面板最小高度 320px；横向排行可根据数据量提高高度。
 * - 图表空态和错误态覆盖图表区域，但保留面板标题和固定高度。
 * - 图表容器设置 role="img"；可访问名称由本地化的 ariaLabelDescription 提供（§9.3）。
 * - 空态使用 role="status"，错误态使用 role="alert"（§9.3）。
 */
import { Alert, Button, Card, Empty } from "antd";
import type { ReactNode } from "react";
import { CHART_HEIGHT_PX, CHART_PANEL_MIN_HEIGHT_PX } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import { useI18n } from "@/hooks/useI18n";
import { InfoHint } from "@/pages/AnalyzeVisual/DashboardShared/components/InfoHint";

export interface ChartPanelProps {
    /** 面板标题（已本地化） */
    title: string;
    /** 标题旁的额外操作（如图例切换），放右上角 */
    extra?: ReactNode;
    /** 图表区域内容（由调用方渲染 useECharts 容器） */
    children?: ReactNode;
    /** 加载中：显示骨架 */
    loading?: boolean;
    /** 空数据：显示空态（保留标题与固定高度） */
    empty?: boolean;
    /** 错误态：显示错误摘要 + 重试（保留标题与固定高度） */
    error?: { message: string; onRetry?: () => void };
    /** 图表容器高度，默认 280px */
    height?: number;
    /** 面板最小高度，默认 320px */
    minHeight?: number;
    /** 用于 role="img" 的可访问名称 */
    ariaLabelDescription?: string;
    /** 标题旁的计算方式提示内容（已本地化）；不传则不显示 ? 图标 */
    hint?: ReactNode;
}

/**
 * 图表面板：固定高度，标题常驻，空态/错误态覆盖图表区域。
 */
export function ChartPanel({
    title,
    extra,
    children,
    loading,
    empty,
    error,
    height = CHART_HEIGHT_PX,
    minHeight = CHART_PANEL_MIN_HEIGHT_PX,
    ariaLabelDescription,
    hint,
}: ChartPanelProps) {
    const { t } = useI18n();

    return (
        <Card
            size="small"
            styles={{ body: { padding: 16, display: "flex", flexDirection: "column", minHeight } }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
                    {hint && <InfoHint content={hint} />}
                </div>
                {extra}
            </div>
            <div
                role="img"
                aria-label={ariaLabelDescription}
                style={{ flex: 1, height, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
                {loading ? (
                    <div style={{ width: "100%", height: "100%", background: "transparent" }} />
                ) : error ? (
                    <Alert
                        role="alert"
                        type="error"
                        showIcon
                        style={{ width: "100%" }}
                        message={error.message}
                        action={
                            error.onRetry && (
                                <Button size="small" onClick={error.onRetry} aria-label={t("重试")}>
                                    {t("重试")}
                                </Button>
                            )
                        }
                    />
                ) : empty ? (
                    <div role="status" style={{ width: "100%" }}>
                        <Empty description={t("暂无数据")} />
                    </div>
                ) : (
                    children
                )}
            </div>
        </Card>
    );
}
