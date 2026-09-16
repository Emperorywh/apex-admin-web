/**
 * @description 业务枚举 code 到展示文案 key 的映射（§14）
 *
 * 业务枚举保存稳定 code；展示层根据 code 查找翻译 key，
 * 不把后端中文当枚举值。
 * 中文原文作为 i18n key，由组件层 t() 转换（项目 i18n 规范）。
 */
import type { AlertLevel, FaultStatus, FaultType, TaskStatus, TaskType, VehicleStatus } from "@/pages/AnalyzeVisual/DashboardShared/model/types";

/** 车辆状态：运行/空闲/充电/故障/离线 */
export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
    running: "运行",
    idle: "空闲",
    charging: "充电",
    fault: "故障",
    offline: "离线",
};

/** 任务类型：搬运/拣选/补货/盘点 */
export const TASK_TYPE_LABEL: Record<TaskType, string> = {
    transport: "搬运",
    picking: "拣选",
    replenishment: "补货",
    inventory: "盘点",
};

/** 任务状态：完成/失败/取消 */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
    completed: "完成",
    failed: "失败",
    canceled: "取消",
};

/** 告警级别：严重/重要/一般/提示 */
export const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
    critical: "严重",
    major: "重要",
    minor: "一般",
    info: "提示",
};

/** 故障类型：传感器/电池/通信/机械/软件 */
export const FAULT_TYPE_LABEL: Record<FaultType, string> = {
    sensor: "传感器",
    battery: "电池",
    communication: "通信",
    mechanical: "机械",
    software: "软件",
};

/** 故障状态：未处理/处理中/已关闭 */
export const FAULT_STATUS_LABEL: Record<FaultStatus, string> = {
    open: "未处理",
    recovering: "处理中",
    closed: "已关闭",
};

/** 故障状态对应的 Tag color（§10.2 表格状态色规范） */
export const TASK_STATUS_TAG_COLOR: Record<TaskStatus, string> = {
    completed: "success",
    failed: "error",
    canceled: "default",
};

/** 故障告警状态对应 Tag color（§10.2） */
export const FAULT_STATUS_TAG_COLOR: Record<FaultStatus, string> = {
    open: "error",
    recovering: "warning",
    closed: "success",
};

/** 告警级别 Tag color */
export const ALERT_LEVEL_TAG_COLOR: Record<AlertLevel, string> = {
    critical: "error",
    major: "warning",
    minor: "processing",
    info: "default",
};
