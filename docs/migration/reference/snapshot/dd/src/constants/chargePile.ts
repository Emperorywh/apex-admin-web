/**
 * @description 充电桩的数据
 * @date 2026-1-21
 */
import type { SelectProps, MenuProps } from "antd";

// 充电桩的操作项
export const chargePileCommands: MenuProps["items"] = [
    {
        key: "startCharge",
        label: "开始充电"
    },
    {
        key: "stopCharge",
        label: "停止充电"
    }
];
