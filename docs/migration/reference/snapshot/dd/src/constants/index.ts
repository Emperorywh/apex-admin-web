import type { SelectProps } from "antd";

export const DEFAULT_NAME = 'Umi Max';

/**
 * 操作日志所属模块选项
 * value 与后端 SysLog.module 字段保持一致；label 用于表头下拉与表格 Tag 展示
 */
export const operationLogModuleOptions: { label: string; value: string }[] = [
    { label: "车辆管理", value: "VEHICLE" },
    { label: "车辆组管理", value: "VEHICLE_GROUP" },
    { label: "载具管理", value: "CARRIER" },
    { label: "订单管理", value: "ORDER" },
    { label: "订单模板", value: "ORDER_TEMPLATE" },
    { label: "订单工艺", value: "ORDER_FLOW" },
    { label: "回放管理", value: "PLAYBACK" },
    { label: "交通管理", value: "TRAFFIC" },
    { label: "设备管理", value: "DEVICE" },
    { label: "地图管理", value: "MAP" },
    { label: "用户管理", value: "USER" },
    { label: "角色管理", value: "ROLE" },
    { label: "动作管理", value: "ACTION" },
    { label: "系统管理", value: "SYSTEM" }
];

// 阻塞类型的选项
export const blockingOptions: SelectProps["options"] = [
    { label: "NONE", value: "NONE" },
    { label: "SOFT", value: "SOFT" },
    { label: "HARD", value: "HARD" }
];

export const IP_REGEXP = /^\s*((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)\s*$/;
