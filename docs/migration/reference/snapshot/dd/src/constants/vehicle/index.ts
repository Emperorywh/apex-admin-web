/**
 * @description 车辆的数据
 * @date 2025-6-24
 */
import type { MenuProps, SelectProps } from "antd";

export const agvTypes: SelectProps["options"] = [
    {
        value: 2,
        label: "小车"
    },
    {
        value: 1,
        label: "叉车"
    }
];

export const eStops: SelectProps["options"] = [
    {
        value: 'AUTOACK',
        label: "避障"
    },
    {
        value: 'MANUAL',
        label: "抱闸"
    },
    {
        value: 'REMOTE',
        label: "急停"
    },
    {
        value: 'NONE',
        label: "正常"
    }
];

// 车辆的一键操作按钮组
export const shuttleActions: MenuProps["items"] = [
    {
        label: "一键暂停",
        key: "PAUSE"
    },
    {
        label: "一键继续",
        key: "CONTINUE"
    },
    {
        label: "一键启用",
        key: "ENABLED"
    },
    {
        label: "一键禁用",
        key: "DISABLED"
    },
    // {
    //     label: "一键急停",
    //     key: "EMERGENCY"
    // },
    // {
    //     label: "解除急停",
    //     key: "RELEASE_EMERGENCY"
    // }
];

// 车辆的操作按钮组
export const vehicleActions: MenuProps["items"] = [
    {
        label: "暂停",
        key: "PAUSE"
    },
    {
        label: "继续",
        key: "CONTINUE"
    },
    // {
    //     label: "急停",
    //     key: "EMERGENCY"
    // },
    // {
    //     label: "解除急停",
    //     key: "RELEASE_EMERGENCY"
    // },
    // {
    //     label: "取消订单",
    //     key: "CANCEL"
    // }
];
