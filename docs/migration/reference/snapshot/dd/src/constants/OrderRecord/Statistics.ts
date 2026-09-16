import type { StatisticItem } from "@/types/OrderRecord";

// 任务统计默认列表
export const defaultRecordList: StatisticItem[] = [
    {
        key: "totalNumber",
        title: "任务总数",
        value: 0
    },
    {
        key: "successNumber",
        title: "已成功",
        value: 0
    },
    {
        key: "executingNumber",
        title: "执行中",
        value: 0
    },
    {
        key: "queuingNumber",
        title: "队列中",
        value: 0
    },
    {
        key: "hangNumber",
        title: "已挂起",
        value: 0
    },
    {
        key: "cancelNumber",
        title: "已取消",
        value: 0
    },
    {
        key: "failNumber",
        title: "已失败",
        value: 0
    }
];
