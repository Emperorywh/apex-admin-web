/**
 * @description 历史任务的数据
 * @date 2025-6-14
 */
import type { OrderStateEnum, OperateOptions } from "@/types/OrderRecord";
import type { SelectProps } from "antd";

/**
 * @description 任务状态的枚举和对应的颜色
 * @enum IN_QUEUE,OUT_QUEUE,PROCESSING,HANG,CANCELLED,SUCCEEDED,FAILED
 */
export const orderStateUnfold: OrderStateEnum[] = [
    {
        chName: "队列中",
        enum: "IN_QUEUE",
        color: "default"
    },
    {
        chName: "队列中",
        enum: "NA",
        color: "default"
    },
    {
        chName: "队列外",
        enum: "OUT_QUEUE",
        color: "#F50"
    },
    {
        chName: "进行中",
        enum: "PROCESSING",
        color: "processing"
    },
    {
        chName: "挂起",
        enum: "HANG",
        color: "warning"
    },
    {
        chName: "已取消",
        enum: "CANCELLED",
        color: "magenta"
    },
    {
        chName: "成功",
        enum: "SUCCEEDED",
        color: "success"
    },
    {
        chName: "失败",
        enum: "FAILED",
        color: "error"
    }
];

// 订单类型的选项
// WORK,CHARGE,PARK,BATTERY_MAINTAIN
export const orderTypeOptions: SelectProps["options"] = [
    {
        label: "工作任务",
        value: "WORK"
    },
    {
        label: "停靠任务",
        value: "PARK"
    },
    {
        label: "充电任务",
        value: "CHARGE"
    },
    {
        label: "电池保养",
        value: "BATTERY_MAINTAIN"
    }
];

// 订单状态选项
// IN_QUEUE,OUT_QUEUE,PROCESSING,HANG,CANCELLED,SUCCEEDED,FAILED
export const orderStateOptions: SelectProps["options"] = [
    {
        label: "队列外",
        value: "OUT_QUEUE"
    },
    {
        label: "队列中",
        value: "IN_QUEUE"
    },
    {
        label: "执行中",
        value: "PROCESSING"
    },
    {
        label: "挂起",
        value: "HANG"
    },
    {
        label: "成功",
        value: "SUCCEEDED"
    },
    {
        label: "取消",
        value: "CANCELLED"
    },
    {
        label: "失败",
        value: "FAILED"
    }
];

// 表格订单操作按钮项
export const orderOperates: OperateOptions[] = [
    {
        key: "CMD_ORDER_CANCEL",
        label: "取消",
        disabled: true,
        // 只有在这些状态下才能进行取消操作 下同
        enabled: ["IN_QUEUE", "OUT_QUEUE", "PROCESSING", "HANG"]
    },
    {
        key: "CMD_ORDER_IN_QUEUE_TO_OUT_QUEUE",
        label: "移出队列",
        disabled: true,
        enabled: ["IN_QUEUE"]
    },
    {
        key: "CMD_ORDER_OUT_QUEUE_TO_IN_QUEUE",
        label: "移入队列",
        disabled: true,
        enabled: ["OUT_QUEUE"]
    },
    {
        key: "CMD_ORDER_HANG_TO_SKIP",
        label: "跳过",
        disabled: true,
        enabled: ["HANG"]
    },
    {
        key: "CMD_ORDER_HANG_TO_CONTINUE",
        label: "继续",
        disabled: true,
        enabled: ["HANG"]
    },
];
