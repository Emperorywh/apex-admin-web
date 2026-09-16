/**
 * @description 交管信息里面的属性
 * @date 2025-5-27
 */
import { TrafficProperty } from "../typings";

export const trafficProperty: TrafficProperty = {
    // 正在申请的
    applyProperty: {
        fill: "transparent",
        stroke: "#D50000",
        strokeWidth: .03,
        dash: [.02, .02, 0, .02]
    },
    // 已经申请到的
    lockedProperty: {
        fill: "transparent",
        stroke: "#48BB78",
        strokeWidth: .03,
        dash: [.02, .02, 0, .02]
    }
};
