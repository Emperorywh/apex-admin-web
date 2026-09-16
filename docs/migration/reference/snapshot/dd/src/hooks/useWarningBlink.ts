/**
 * @description 车辆警告可见性 Hook
 *
 * 用于统一判定车辆在画布上的两种告警是否可见：
 *   1. 定位质量告警（locWarningVisible）—— 当定位分数低于阈值时触发
 *   2. 错误告警（errorWarningVisible）—— 当车辆存在 WARNING 级别的错误条目时触发
 *
 * 展示机制：
 *   - 满足告警条件即持续展示对应告警颜色（不再闪烁）
 *   - 无定时器、无多余渲染开销
 *
 * 优先级说明：
 *   - 当车辆处于高优先级状态（充电、避障、异常、解抱闸、离线、断连）时，
 *     即使存在 WARNING 级别错误也不会触发错误告警，避免与高优先级状态的
 *     视觉样式冲突
 *
 * @param localizationScore  可选，车辆定位分数。Overlook 页面传入，MapThrough 页面不需要
 * @param errorEntryList     车辆当前的错误条目列表
 * @param vehicleProcStatus  车辆当前的运行状态
 *
 * @returns locWarningVisible   定位告警是否可见（持续展示）
 * @returns errorWarningVisible 错误告警是否可见（持续展示）
 */
import { robotProperty } from "@/plugins/konva/nodes/robot";
import type { ErrorEntry } from "@/utils/typing";

/** 高优先级状态列表，处于这些状态时不显示错误告警 */
const HIGH_PRIORITY_STATUSES = ["CHARGE", "AVOID", "ERROR", "BRAKE", "OFFLINE", "CONNECTIONBROKEN"];

interface UseWarningBlinkParams {
    localizationScore?: number;
    errorEntryList: ErrorEntry[];
    vehicleProcStatus: string;
}

export function useWarningBlink({ localizationScore, errorEntryList, vehicleProcStatus }: UseWarningBlinkParams) {
    const locWarningVisible = localizationScore != null
        && localizationScore < robotProperty.localizationWarning.threshold;
    const errorWarningVisible = !!errorEntryList?.some(e => e.errorLevel === "WARNING")
        && !HIGH_PRIORITY_STATUSES.includes(vehicleProcStatus);

    return { locWarningVisible, errorWarningVisible };
}
