/**
 * @description 自动门的界面
 * @date 2026-1-19
 */
import { useState } from "react";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import ModbusAutodoor from "./ModbusAutodoor";
import { useI18n } from "@/hooks/useI18n";

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const [activeKey, setActiveKey] = useState<string>("modbusAutodoor");

    const onChange: TabsProps["onChange"] = (key) => {
        setActiveKey(key);
    };

    const items: TabsProps["items"] = [
        {
            key: "modbusAutodoor",
            label: t("MODBUS自动门"),
            children: <ModbusAutodoor />
        }
    ];

    return (
        <Tabs
            style={{ padding: 20 }}
            activeKey={activeKey}
            items={items}
            onChange={onChange}
        />
    )
};