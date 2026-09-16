/**
 * @description 自动门的数据
 * @date 2026-1-20
 */
import type { SelectProps, MenuProps } from "antd";

// COILS,DISCRETE_INPUTS,HOLDING_REGISTERS,INPUT_REGISTERS
export const readOptions: SelectProps["options"] = [
    {
        label: "COILS",
        value: "COILS"
    },
    {
        label: "DISCRETE_INPUTS",
        value: "DISCRETE_INPUTS"
    },
    {
        label: "HOLDING_REGISTERS",
        value: "HOLDING_REGISTERS"
    },
    {
        label: "INPUT_REGISTERS",
        value: "INPUT_REGISTERS"
    }
];

// COILS,DISCRETE_INPUTS,HOLDING_REGISTERS,INPUT_REGISTERS
export const writeOptions: SelectProps["options"] = [
    {
        label: "COILS",
        value: "COILS"
    },
    {
        label: "DISCRETE_INPUTS",
        value: "DISCRETE_INPUTS"
    },
    {
        label: "HOLDING_REGISTERS",
        value: "HOLDING_REGISTERS"
    },
    {
        label: "INPUT_REGISTERS",
        value: "INPUT_REGISTERS"
    }
];

// 自动门操作项
export const autodoorCommands: MenuProps["items"] = [
    {
        key: "openDoor",
        label: "开门"
    },
    {
        key: "closeDoor",
        label: "关门"
    }
];
