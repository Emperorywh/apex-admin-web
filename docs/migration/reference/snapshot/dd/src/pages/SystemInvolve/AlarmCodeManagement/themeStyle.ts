import type { CSSProperties } from "react";
import { theme } from "antd";

/**
 * 告警码管理功能只依赖 Ant Design 的语义令牌，不直接判断当前主题名称。
 * CSS Module 通过这些局部变量消费主题色，避免明暗两套样式产生重复分支。
 */
type AlarmCodeThemeToken = ReturnType<typeof theme.useToken>["token"];

type AlarmCodeThemeStyle = CSSProperties & {
    "--alarm-code-color-text": string;
    "--alarm-code-color-text-tertiary": string;
    "--alarm-code-color-warning": string;
    "--alarm-code-color-warning-text": string;
    "--alarm-code-color-border-secondary": string;
    "--alarm-code-color-primary": string;
    "--alarm-code-color-primary-border-hover": string;
    "--alarm-code-color-bg-container": string;
    "--alarm-code-color-split": string;
    "--alarm-code-color-error": string;
    "--alarm-code-color-error-bg": string;
    "--alarm-code-box-shadow-tertiary": string;
};

/**
 * 集中维护 Ant Design 语义令牌与功能样式变量的映射。
 * 页面和 Portal 弹窗分别注入同一映射，主题切换后都会随上下文自动更新。
 */
export function createAlarmCodeThemeStyle(token: AlarmCodeThemeToken): AlarmCodeThemeStyle {
    return {
        "--alarm-code-color-text": token.colorText,
        "--alarm-code-color-text-tertiary": token.colorTextTertiary,
        "--alarm-code-color-warning": token.colorWarning,
        "--alarm-code-color-warning-text": token.colorWarningText,
        "--alarm-code-color-border-secondary": token.colorBorderSecondary,
        "--alarm-code-color-primary": token.colorPrimary,
        "--alarm-code-color-primary-border-hover": token.colorPrimaryBorderHover,
        "--alarm-code-color-bg-container": token.colorBgContainer,
        "--alarm-code-color-split": token.colorSplit,
        "--alarm-code-color-error": token.colorError,
        "--alarm-code-color-error-bg": token.colorErrorBg,
        "--alarm-code-box-shadow-tertiary": token.boxShadowTertiary,
    };
}
