/**
 * @description 右侧侧边栏的
 * @date 2025-5-28
 */
import { useState, useMemo, memo, useRef } from "react";
import { Tabs, Space } from "antd";
import { FormattedMessage, useModel } from "@umijs/max";
import { CarOutlined, FileDoneOutlined, BarsOutlined } from "@ant-design/icons";
import type { TabsProps } from "antd";
import VehicleList from "./VehicleList";
import OrderList from "./OrderList";
import GraphPixel from "@/components/GraphPixel";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface PanelTabs {
    stage: Konva.Stage | null;
}

export default memo((props: PanelTabs) => {

    const { stage } = props;

    /* 国际化翻译方法，用于将侧边栏标签页的文案进行多语言转换 */
    const { t } = useI18n();

    /**
     * 监听当前地图信息变化
     * 当地图切换时，mapId 更新，触发 GraphPixel 重新读取路网数据
     */
    const { currentMapInfo } = useModel("currentMapInfo");

    const [activeKey, setActiveKey] = useState<string>("vehicleList");

    const panelHeight = useRef<number>(window.innerHeight - 170);

    const panelTabs: TabsProps["items"] = useMemo(() => [
        {
            key: "vehicleList",
            label: <Space><FormattedMessage id="车辆" defaultMessage="车辆" /></Space>,
            icon: <CarOutlined />,
            children: (
                <VehicleList
                    panelHeight={panelHeight}
                />
            )
        },
        {
            key: "orderList",
            label: t("任务"),
            icon: <FileDoneOutlined />,
            children: (
                <OrderList
                    panelHeight={panelHeight}
                />
            )
        },
        {
            key: "pixel",
            label: t("路网"),
            icon: <BarsOutlined />,
            children: (
                <GraphPixel
                    stage={stage}
                    useMapId={currentMapInfo?.mapId || ""}
                    refreshKey={currentMapInfo?.mapLoadedAt}
                    panelHeight={panelHeight}
                />
            )
        }
    ], [stage, currentMapInfo?.mapId, currentMapInfo?.mapLoadedAt]);

    const onTabChange = (key: string) => {
        setActiveKey(key);
    };

    return (
        <Tabs
            style={{ padding: "0 10px" }}
            size="small"
            destroyOnHidden
            activeKey={activeKey}
            items={panelTabs}
            onChange={onTabChange}
        />
    )
});
