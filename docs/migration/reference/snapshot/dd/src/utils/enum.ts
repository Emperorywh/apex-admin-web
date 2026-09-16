/**
 * @description 枚举文件
 * @date 2025-6-17
 */

// 车辆状态的枚举
export enum RobotStatus {
    // @Schema(description = "在线")
    ONLINE = "在线",
    // @Schema(description = "空闲")
    IDLE = "空闲",
    // @Schema(description = "交管")
    TRAFFIC = "交管",
    // @Schema(description = "执行中")
    PROCESSING = "执行中",
    // @Schema(description = "充电")
    CHARGE = "充电",
    // @Schema(description = "避障")
    AVOID = "避障",
    // @Schema(description = "异常")
    ERROR = "异常",
    // @Schema(description = "抱闸")
    BRAKE = "抱闸",
    // @Schema(description = "离线")
    OFFLINE = "离线",
    // @Schema(description = "连接中断")
    CONNECTIONBROKEN = "连接中断",
    // @Schema(description = "暂停")
    PAUSED = "暂停"
}

/**
 * 获取车辆状态的展示文本
 * 业务规则：
 *   1. 当连接状态 connectionState 不是 "ONLINE" 时（即处于 OFFLINE / CONNECTIONBROKEN），
 *      车辆已离线或失联，此时业务进度状态 vehicleProcStatus 不再有意义，
 *      直接展示连接状态对应的中文（"离线" / "连接中断"）。
 *   2. 仅当车辆 connectionState === "ONLINE" 时，
 *      才使用 vehicleProcStatus（IDLE / TRAFFIC / PROCESSING / CHARGE / AVOID / ERROR / BRAKE）映射展示。
 *   3. 任意一端取不到映射时，退化为传入的原始字符串，避免出现 undefined。
 *
 * @param connectionState 车辆连接状态（ONLINE / OFFLINE / CONNECTIONBROKEN 等）
 * @param vehicleProcStatus 车辆业务进度状态（IDLE / TRAFFIC 等）
 * @returns 状态展示文本（中文）
 */
export const getVehicleStatusText = (
    connectionState?: string,
    vehicleProcStatus?: string
): string => {
    // 连接异常时，优先返回连接状态的中文描述
    if (connectionState && connectionState !== "ONLINE") {
        return RobotStatus[connectionState as keyof typeof RobotStatus] ?? connectionState;
    }
    // 在线时返回业务进度状态的中文描述，没有命中映射则回退到原始值
    return RobotStatus[vehicleProcStatus as keyof typeof RobotStatus] ?? vehicleProcStatus ?? "";
};

// 订单状态的枚举
export enum OrderStatus {
    IN_QUEUE = "队列中",
    OUT_QUEUE = "队列外",
    PROCESSING = "进行中",
    HANG = "挂起",
    CANCELLED = "取消",
    SUCCEEDED = "成功",
    FAILED = "失败"
}

// 订单类型枚举
export enum OrderTypes {
    WORK = "工作订单",
    CHARGE = "充电订单",
    PARK = "停靠订单",
    BATTERY_MAINTAIN = "电池订单"
}

// 元素的枚举
export enum NodeType {
    node = "节点",
    work = "工作站点",
    park = "停靠站点",
    charge = "充电站点",
    warehouse = "库区站点"
}

/**
 * 节点类型兼容映射
 * shelf、warehouse_font、warehouse_back 已废弃
 * shelf 回退为 node，warehouse_font/warehouse_back 回退为 warehouse
 */

/** 将节点类型规范化，废弃类型回退为对应的有效类型 */
export function normalizeNodeType(type: string | undefined): string {
    if (!type) return "node";
    if (type in NodeType) return type;
    /* warehouse_font / warehouse_back 统一归为 warehouse */
    if (type === "warehouse_font" || type === "warehouse_back") return "warehouse";
    /* shelf 及其他未知类型回退为 node */
    return "node";
}

// 车辆调度状态的枚举
export enum DispatchState {
    ENABLE = "启用",
    DISABLE = "禁用"
}

// 订单任务状态的枚举
export enum MissionState {
    NA = "等待",
    PROCESSING = "进行",
    HANG = "挂起",
    CANCELLED = "取消",
    FINISHED = "完成"
}

// 阻塞类型的枚举
export enum BlockingTypes {
    NONE = "",
    SOFT = "",
    HARD = ""
}

// 动作状态枚举
export enum ActionStatus {
    WAITING = "等待",
    INITIALIZING = "初始化",
    RUNNING = "执行中",
    FINISHED = "完成",
    FAILED = "失败"
}

// 订单子工艺执行状态
export enum FlowState {
    EXECUTING = "执行中",
    PAUSED = "已暂停",
    ABNORMAL = "异常",
    CANCELLED = "已取消",
    FAILED = "失败",
    COMPLETED = "已完成"
}

// 充电桩的枚举
export enum ChargeState {
    ERROR = "错误",
    IDLE = "空闲",
    CHARGING = "充电中",
    FULL = "充满",
    FAULT = "错误",
    OFFLINE = "离线"
}
