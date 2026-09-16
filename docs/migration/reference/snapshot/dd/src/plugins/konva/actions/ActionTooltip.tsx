/**
 * @description 动作角标 hover 详情浮层（HTML overlay，三画布共用）
 * @date 2026-6-28
 *
 * SPEC §4（D9-D11）：
 *   - hover 角标 → 在画布上方渲染单个 HTML overlay 浮层（鼠标移出隐藏），同一时刻只显示一个
 *   - 定位贴角标锚点屏幕坐标（不跟随鼠标），溢出视口时翻转到左侧/上方
 *   - 每动作一卡：actionType（粗体）+ 阻塞色点（按该动作自身 blockingType）+ actionDescription + actionParameters（key:value）
 *   - blockingType 显原文枚举 NONE/SOFT/HARD（不翻译，D17）；字段无标签（actionType/description/参数自带语义）
 */
import React from "react";
import type { ActionType } from "@/utils/typing";
import { getSeverityColor } from "./actionStyles";
import type { ActionSeverity } from "./index";

/** tooltip 数据载荷（由各画布 hover 回调提供） */
export interface ActionTooltipData {
    /** 该元素的全部动作 */
    actions: ActionType[];
    /** 角标锚点屏幕坐标（浮层贴此定位） */
    screenX: number;
    screenY: number;
}

interface ActionTooltipProps {
    /** 当前 hover 的动作数据（null 则不渲染） */
    data: ActionTooltipData | null;
    /** 是否暗黑主题（阻塞色点据此取明/暗色） */
    isDark: boolean;
}

/** 把任意 blockingType 归一化为合法 severity（非法/缺失按 NONE，SPEC §2.3 容错） */
const normalizeSeverity = (bt: unknown): ActionSeverity =>
    bt === "HARD" || bt === "SOFT" || bt === "NONE" ? bt : "NONE";

/**
 * 单张动作卡：actionType（粗体）+ 阻塞色点 + actionDescription + actionParameters（SPEC §4.2）
 */
const ActionCard: React.FC<{ action: ActionType; isDark: boolean; isLast: boolean }> = ({ action, isDark, isLast }) => {
    const severity = normalizeSeverity(action.blockingType);
    const params = Array.isArray(action.actionParameters) ? action.actionParameters : [];
    return (
        <div
            style={{
                marginBottom: isLast ? 0 : 8,
                paddingBottom: isLast ? 0 : 8,
                borderBottom: isLast ? "none" : "1px solid var(--ant-color-border-secondary)",
            }}
        >
            {/* 标题区：actionType（粗体）+ 阻塞色点（按该动作自身 blockingType）+ blockingType 原文枚举 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                    style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: getSeverityColor(severity, isDark),
                        flexShrink: 0,
                    }}
                />
                <span style={{ fontWeight: 600, wordBreak: "break-all" }}>
                    {action.actionType}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ant-color-text-secondary)" }}>
                    {action.blockingType}
                </span>
            </div>
            {/* actionDescription：常规字重，超长自动换行 */}
            {action.actionDescription ? (
                <div style={{ fontSize: 12, color: "var(--ant-color-text-secondary)", marginBottom: params.length ? 4 : 0, wordBreak: "break-all" }}>
                    {action.actionDescription}
                </div>
            ) : null}
            {/* actionParameters：key : value 列表（无参数则不渲染） */}
            {params.length > 0 ? (
                <div>
                    {params.map((p, j) => (
                        <div key={j} style={{ fontSize: 12, color: "var(--ant-color-text)", wordBreak: "break-all" }}>
                            <span style={{ color: "var(--ant-color-text-secondary)" }}>{p.key}</span>
                            {" : "}
                            <span>{p.value}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

/**
 * 动作详情浮层：定位贴锚点屏幕坐标，溢出视口右侧/下方时翻转到左侧/上方（SPEC §4.1）
 */
export const ActionTooltip: React.FC<ActionTooltipProps> = ({ data, isDark }) => {
    if (!data) return null;
    const { actions, screenX, screenY } = data;
    // 视口翻转：锚点贴近右侧/底部边界时浮层翻转到左侧/上方，避免溢出
    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1920;
    const viewportH = typeof window !== "undefined" ? window.innerHeight : 1080;
    const flipX = screenX + 300 > viewportW; // 预留浮层最大宽度
    const flipY = screenY + 240 > viewportH; // 预留浮层预估高度
    const left = flipX ? screenX - 8 : screenX + 8;
    const top = flipY ? screenY - 8 : screenY;
    const transform = flipX
        ? "translate(-100%, 0)"
        : flipY
            ? "translate(0, -100%)"
            : "translate(0, -50%)";
    return (
        <div
            style={{
                position: "fixed",
                left,
                top,
                transform,
                zIndex: 1000,
                pointerEvents: "none",
                maxWidth: 300,
                maxHeight: 320,
                overflow: "auto",
                padding: 8,
                background: "var(--ant-color-bg-elevated)",
                border: "1px solid var(--ant-color-border)",
                borderRadius: 6,
                boxShadow: "var(--ant-box-shadow-secondary)",
            }}
        >
            {actions.map((action, i) => (
                <ActionCard
                    key={i}
                    action={action}
                    isDark={isDark}
                    isLast={i === actions.length - 1}
                />
            ))}
        </div>
    );
};
