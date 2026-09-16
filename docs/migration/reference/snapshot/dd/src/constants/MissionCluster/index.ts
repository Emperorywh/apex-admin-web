/**
 * @description 任务管理
 * @date 2025-10-30
 */
import type { MenuProps } from "antd";
import type { CheckboxGroupProps } from "antd/es/checkbox";

// 任务的操作
export const operates: MenuProps["items"] = [
    {
        key: "PAUSE",
        label: "暂停"
    },
    {
        key: "CONTINUE",
        label: "继续"
    },
    {
        key: "CANCEL",
        label: "取消"
    }
];

// 任务的触发方式
export const triggerTypes: CheckboxGroupProps<number>["options"] = [
    {
        value: 0,
        label: "并行触发"
    },
    {
        value: 1,
        label: "串行触发"
    }
];

// 时间表达式对应的数量
export const cornCountEnum: Record<string, number> = {
    秒: 60,
    分: 60,
    小时: 24,
    日: 31,
    月: 12,
    周: 7
};

// 时间表达式对应的下标
export const cronIndex: Record<string, number> = {
    秒: 0,
    分: 1,
    小时: 2,
    日: 3,
    月: 4,
    周: 5
};

// 验证cron表达式格式的正则表达式
export const cronRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;
