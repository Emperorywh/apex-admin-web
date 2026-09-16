/**
 * @description 路径三方设备图标配色（明/暗两套）
 * @date 2026-6-27
 *
 * 配色来自 SPEC §3.4 决策汇总：
 *   电梯蓝 / 自动门绿 / 风淋门紫 / 交通灯红黄绿 / 占位灰
 * 交通灯三色明暗通用，仅外框色随主题调整以保证可辨。
 */

/**
 * 交通灯配色：红/黄/绿三色 + 外框色
 */
export interface TrafficLightColors {
    red: string;
    yellow: string;
    green: string;
    /** 灯框颜色（明暗不同，保证在路径上可辨） */
    frame: string;
}

/**
 * 单套主题下的全部设备配色
 */
export interface DeviceColorSet {
    /** 电梯 */
    elevator: string;
    /** 自动门 */
    autoDoor: string;
    /** 风淋门 */
    airShowerDoor: string;
    /** 交通灯（含三色与外框） */
    trafficLight: TrafficLightColors;
    /** 未知设备占位 */
    unknown: string;
}

/**
 * 明/暗两套设备配色
 * 取色规则与项目既有 localTheme === "darkAlgorithm" 模式一致（SPEC D15）
 */
export const deviceStyles = {
    /** 亮色主题配色 */
    light: {
        elevator: "#1976D2",
        autoDoor: "#43A047",
        airShowerDoor: "#8E24AA",
        trafficLight: {
            red: "#E53935",
            yellow: "#FB8C00",
            green: "#43A047",
            frame: "#424242",
        },
        unknown: "#9E9E9E",
    },
    /** 暗色主题配色 */
    dark: {
        elevator: "#64B5F6",
        autoDoor: "#81C784",
        airShowerDoor: "#BA68C8",
        trafficLight: {
            red: "#E53935",
            yellow: "#FB8C00",
            green: "#43A047",
            frame: "#BDBDBD",
        },
        unknown: "#BDBDBD",
    },
} as const;
