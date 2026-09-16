/**
 * @description modbus电梯模块
 * @date 2026-1-19
 */
import { useState } from "react";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import ModbusElevator from "./ModbusElevator";
import { useI18n } from "@/hooks/useI18n";

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const [activeKey, setActiveKey] = useState<string>("modbusElevator");


    const onChange: TabsProps["onChange"] = (key: string) => {
        setActiveKey(key);
    };

    const items: TabsProps["items"] = [
        {
            key: "modbusElevator",
            label: t("MODBUS电梯"),
            children: <ModbusElevator />
        }
    ];

    return (
        <Tabs
            style={{ padding: 20 }}
            defaultActiveKey="modbusElevator"
            activeKey={activeKey}
            items={items}
            onChange={onChange}
        />
    )
};
