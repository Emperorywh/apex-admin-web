/**
 * @description 交管的数据
 * @date 2026-1-16
 */
import type { MenuProps } from "antd";

// 三方交管的测试选项
export const testControls: MenuProps["items"] = [
    {
        key: "APPLY",
        label: "申请"
    },
    {
        key: "RELEASE",
        label: "释放"
    }
];
