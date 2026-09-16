/**
 * @description 从 Ant Design token 派生 ECharts 主题色（§9.3）
 *
 * 使用 Ant Design theme.useToken() 输出文字、分割线、边框、提示框和系列色。
 * 禁止在 Dashboard 中硬编码白色背景或复制另一套明暗主题常量。
 * 不把不稳定的 t 函数直接作为无意义依赖；图表 option 通过 useChartTheme + locale 驱动更新。
 */
import { theme } from "antd";
import { useMemo } from "react";
import { GlobalToken } from "antd/es/theme/interface";

export interface ChartTheme {
    /** 主文本色 */
    colorText: string;
    /** 次要文本色（轴标签） */
    colorTextSecondary: string;
    /** 分割线 / 轴线颜色 */
    splitLineColor: string;
    /** 提示框背景 */
    tooltipBg: string;
    /** 提示框边框 */
    tooltipBorder: string;
    /** 卡片背景（透明，使用 Card 自身背景） */
    chartBg: string;
    /** 序列配色：覆盖 §5 各图表中的多系列分类 */
    seriesColors: string[];
    /** 状态色：成功/警告/错误/信息 */
    successColor: string;
    warningColor: string;
    errorColor: string;
    infoColor: string;
    /** antd token 原值，供图表消费方进一步派生 */
    token: GlobalToken;
}

/**
 * Dashboard 系列配色。
 * 第 8 色起为补充，保证 11 张图各自的多分类区分度。
 */
const SERIES_PALETTE = [
    "#5B8FF9",
    "#5AD8A6",
    "#5D7092",
    "#F6BD16",
    "#E8684A",
    "#6DC8EC",
    "#9270CA",
    "#FF9D4D",
    "#269A99",
    "#FF99C3",
];

/**
 * 从 Ant Design token 派生图表主题。
 * 主题切换时（项目当前会刷新页面，但此处仍以 token 为唯一来源）自动重算。
 */
export function useChartTheme(): ChartTheme {
    const { token } = theme.useToken();

    return useMemo<ChartTheme>(() => {
        return {
            colorText: token.colorText,
            colorTextSecondary: token.colorTextSecondary,
            // antd 的 splitBorder / borderSecondary 用于图表分割线
            splitLineColor: token.colorBorderSecondary,
            tooltipBg: token.colorBgElevated,
            tooltipBorder: token.colorBorderSecondary,
            chartBg: "transparent",
            seriesColors: SERIES_PALETTE,
            successColor: token.colorSuccess,
            warningColor: token.colorWarning,
            errorColor: token.colorError,
            infoColor: token.colorInfo,
            token,
        };
    }, [token]);
}
