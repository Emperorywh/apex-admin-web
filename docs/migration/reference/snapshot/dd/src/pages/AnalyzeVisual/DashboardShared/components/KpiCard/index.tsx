/**
 * @description KPI 卡片纯展示组件（§10.1）
 *
 * 不读取业务枚举、不计算公式、不访问 repository。
 * 视觉规范：
 *   - 容器：Ant Design Card，背景/边框/阴影/圆角全部来自 token
 *   - 标签：12px，colorTextSecondary，前置 Ant Design Icon
 *   - 主值：28px / 700；单位 16px / 次要文字色
 *   - 环比：12px；good/bad/neutral 分别映射成功/错误/次要文字色
 *   - 强调：danger 3px 错误色左边框，warn 3px 警告色左边框
 *   - loading：保留卡片固定高度，使用 Skeleton，禁止加载时网格跳动
 */
import { Card, Skeleton } from "antd";
import type { ReactNode } from "react";
import { KPI_LABEL_FONT_SIZE_PX, KPI_UNIT_FONT_SIZE_PX, KPI_VALUE_FONT_SIZE_PX } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import type { KpiViewModel } from "@/pages/AnalyzeVisual/DashboardShared/model/kpiViewModel";
import { InfoHint } from "@/pages/AnalyzeVisual/DashboardShared/components/InfoHint";

export interface KpiCardProps {
    /** 标签文案（已本地化） */
    label: string;
    /** 视图模型 */
    value: KpiViewModel;
    /** 标签前置图标 */
    icon?: ReactNode;
    /** loading 时显示骨架 */
    loading?: boolean;
    /** 计算方式提示内容（已本地化）；不传则不显示 ? 图标 */
    hint?: ReactNode;
}

/**
 * KPI 卡片。纯展示，由上层根据 polarity/format 计算好 KpiViewModel 后传入。
 */
export function KpiCard({ label, value, icon, loading, hint }: KpiCardProps) {
    const toneColor =
        value.changeTone === "good"
            ? "var(--dashboard-tone-good, #52c41a)"
            : value.changeTone === "bad"
              ? "var(--dashboard-tone-bad, #ff4d4f)"
              : "var(--dashboard-tone-neutral, rgba(0,0,0,0.45))";

    const accentStyle =
        value.accent === "danger"
            ? { borderLeft: "3px solid var(--dashboard-tone-bad, #ff4d4f)" }
            : value.accent === "warn"
              ? { borderLeft: "3px solid var(--dashboard-tone-warn, #faad14)" }
              : undefined;

    return (
        <Card
            size="small"
            style={{ minHeight: 110, ...accentStyle }}
            styles={{ body: { padding: 16 } }}
        >
            {loading ? (
                <Skeleton active paragraph={{ rows: 2, width: ["60%", "40%"] }} title={false} />
            ) : (
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--dashboard-text-secondary, rgba(0,0,0,0.45))", fontSize: KPI_LABEL_FONT_SIZE_PX }}>
                        {icon}
                        <span>{label}</span>
                        {hint && <InfoHint content={hint} />}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: KPI_VALUE_FONT_SIZE_PX, fontWeight: 700, lineHeight: 1.2 }}>
                            {value.displayValue}
                        </span>
                        {value.unit && (
                            <span style={{ fontSize: KPI_UNIT_FONT_SIZE_PX, color: "var(--dashboard-text-secondary, rgba(0,0,0,0.45))" }}>
                                {value.unit}
                            </span>
                        )}
                    </div>
                    {value.changeText && (
                        <div style={{ marginTop: 6, fontSize: KPI_LABEL_FONT_SIZE_PX, color: toneColor }}>
                            {value.changeText}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
