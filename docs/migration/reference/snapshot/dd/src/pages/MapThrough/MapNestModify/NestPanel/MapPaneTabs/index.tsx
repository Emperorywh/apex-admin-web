/**
 * @description 地图编辑里面tabs
 * @date 2025-7-11
 */
import { useState, memo, useRef } from "react";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import ManualPane from "./ManualPane";
import AttributePane from "./AttributePane";
import type Konva from "konva";
import GraphPixel from "@/components/GraphPixel";
import { useI18n } from "@/hooks/useI18n";


interface MapPaneTabsProps {
    stage: Konva.Stage | null;
    useMapId: string;
    /** 地图数据加载完成的时间戳，作为 GraphPixel 的 refreshKey */
    mapLoadedAt: number;
    manualKey: string;
    selectShapes: Konva.Shape[];
    enableModify: boolean;
    setManualKey: (value: React.SetStateAction<string>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
}

export default memo((props: MapPaneTabsProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, useMapId, mapLoadedAt, manualKey, selectShapes, enableModify, setManualKey, setSelectShapes } = props;

    // 当前激活的面板
    const [activeKey, setActiveKey] = useState<string>("manual");
    const panelHeight = useRef<number>(window.innerHeight - 361);

    const onChange = (key: string) => {
        setActiveKey(key);
    };

    const items: TabsProps["items"] = [
        {
            key: "manual",
            label: t("操作"),
            children: (
                <ManualPane
                    stage={stage}
                    manualKey={manualKey}
                    selectShapes={selectShapes}
                    enableModify={enableModify}
                    setManualKey={setManualKey}
                />
            )
        },
        {
            key: "attribute",
            label: t("属性"),
            children: (
                <AttributePane
                    stage={stage}
                    selectShapes={selectShapes}
                    enableModify={enableModify}
                />
            )
        },
        {
            key: "pixel",
            label: t("元素"),
            children: (
                <GraphPixel
                    stage={stage}
                    useMapId={useMapId}
                    refreshKey={mapLoadedAt}
                    setSelectShapes={setSelectShapes}
                    panelHeight={panelHeight}
                />
            )
        }
    ];

    return (
        <Tabs
            activeKey={activeKey}
            items={items}
            onChange={onChange}
            size="small"
        />
    )
});
