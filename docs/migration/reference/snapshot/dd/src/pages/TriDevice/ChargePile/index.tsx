/**
 * @description 充电桩管理
 * @date 2026-1-21
 */
import { useState } from "react";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import ModbusChargePile from "./ModbusChargePile";
import { useI18n } from "@/hooks/useI18n";

export default () => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const [activeKey, setActiveKey] = useState<string>("chargePie");

    const onChange: TabsProps["onChange"] = (key) => {
        setActiveKey(key);
    };

    const items: TabsProps['items'] = [
        {
            key: "chargePie",
            label: t("MODBUS充电桩"),
            children: <ModbusChargePile />
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
