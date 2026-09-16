/**
 * @description 车辆的属性数据
 * @date 2025-5-27
 * @enum 
 * @Schema(description = "空闲")
 * IDLE,
 * @Schema(description = "交管")
 * TRAFFIC,
 * @Schema(description = "执行中")
 * PROCESSING,
 * @Schema(description = "充电")
 * CHARGE,
 * @Schema(description = "避障")
 * AVOID,
 * @Schema(description = "异常") 
 * ERROR
 * @Schema(description = "解抱闸")
 * BRAKE
 */
import type { RobotProperty } from "../typings";

export const robotProperty: RobotProperty = {
    robotFill: {
        IDLE: "#4299E1",
        TRAFFIC: "#9F7AEA",
        PROCESSING: "#48BB78",
        CHARGE: "#C8C81A",
        AVOID: "#FBC02D",
        ERROR: "#590016",
        BRAKE: "#FF0000",
        OFFLINE: "#98A2B2",
        PAUSED: "#38D2D2"
    },
    strokeStyle: {
        IDLE: "#9BC8EC",
        TRAFFIC: "#C6B2EC",
        PROCESSING: "#B1E5C7",
        CHARGE: "#E7E700",
        AVOID: "#CEB065",
        ERROR: "#F43563",
        BRAKE: "#EFB745",
        OFFLINE: "#98A2B2",
        PAUSED: "#1AC9C9"
    },
    pathFill: {
        IDLE: "#FFF",
        TRAFFIC: "#FFF",
        PROCESSING: "#FFF",
        CHARGE: "#FFF",
        AVOID: "#FFF",
        ERROR: "#FFF",
        BRAKE: "#FFF",
        OFFLINE: "#FFF"
    },
    // 载货状态
    load: {
        stroke: "#FFF",
        strokeWidth: .05
    },
    // 任务标识圆点颜色
    // 原蓝色 #1677FF 与空闲状态 #4299E1 色相过近，画布上几乎无法区分；
    // 改为高饱和橙色 —— 现有色板（蓝/紫/绿/黄绿/黄/红/粉/灰）中唯一空缺的色相，
    // 与抱闸红 #FF0000、避障黄 #FBC02D 均保持可辨识的色相差。
    // 图例（constants/vehicleLegend）与两画布的 XcGroup/XpGroup 均直接引用此常量，改一处全生效。
    order : {
        fill: "#FF7A00"
    },
    textFill: "#37474F",
    strokeWidth: .04,
    opacity: 1,
    focus: {
        stroke: "#09B83E",
        strokeWidth: .15,
        lineDash: [.2, .2, 0, .2]
    },
    localizationWarning: {
        fill: "#FF1493",
        threshold: 0.6,
        padding: 0.15
    },
    errorWarning: {
        fill: "#FFD600"
    }
};
