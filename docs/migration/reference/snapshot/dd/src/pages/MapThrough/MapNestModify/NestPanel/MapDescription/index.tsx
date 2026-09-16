/**
 * @description 地图的描述组件
 * @date 2025-7-11
 */
import { useMemo, memo } from "react";
import { Descriptions } from "antd";
import type { DescriptionsProps } from "antd";
import type { MapInfo } from "@/utils/typing";
import MapSelect from "./MapSelect";
import VersionSelect from "./VersionSelect";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface MapDescriptionProps {
    mapInfo: MapInfo | null;
    useMapId: string;
    useMapVersionId: number | undefined;
    /** URL 携带的版本 ID，传递给 VersionSelect 用于首次加载 */
    urlMapVersionId: number | undefined;
    enableModify: boolean;
    setUseMapId: (value: React.SetStateAction<string>) => void;
    setUseMapVersionId: (value: React.SetStateAction<number | undefined>) => void;
    setManualKey: (value: React.SetStateAction<string>) => void;
    setEnableModify: (value: React.SetStateAction<boolean>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
}

export default memo((props: MapDescriptionProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { mapInfo, useMapId, useMapVersionId, urlMapVersionId, enableModify, setUseMapId, setUseMapVersionId, setManualKey, setEnableModify, setSelectShapes } = props;
    
    const { items } = useMemo(() => {
        const items: DescriptionsProps["items"] = [
            {
                key: "mapName",
                label: t("地图"),
                children: (
                    <MapSelect
                        useMapId={useMapId}
                        enableModify={enableModify}
                        setUseMapId={setUseMapId}
                        setUseMapVersionId={setUseMapVersionId}
                        setManualKey={setManualKey}
                        setEnableModify={setEnableModify}
                        setSelectShapes={setSelectShapes}
                    />
                )
            },
            {
                key: "mapVersion",
                label: t("版本"),
                children: (
                    <VersionSelect
                        useMapId={useMapId}
                        useMapVersionId={useMapVersionId}
                        enableModify={enableModify}
                        currentPublishedMapVersion={mapInfo?.currentMapInfoVersion?.mapVersion}
                        urlMapVersionId={urlMapVersionId}
                        setUseMapVersionId={setUseMapVersionId}
                        setManualKey={setManualKey}
                        setEnableModify={setEnableModify}
                        setSelectShapes={setSelectShapes}
                    />
                )
            },
            {
                key: "floor",
                label: t("楼层"),
                children: mapInfo?.floor
            },
            {
                key: "mapState",
                label: t("状态"),
                children: mapInfo?.mapState === "ENABLED" ? t("启用") : t("禁用")
            },
            // {
            //     key: "mapId",
            //     label: "地图ID",
            //     children: mapInfo?.mapId
            // }
        ];
        return { items }
    }, [mapInfo?.mapId, mapInfo?.currentMapInfoVersion?.mapVersion, useMapId, useMapVersionId, urlMapVersionId, enableModify])

    return (
        <Descriptions
            title=""
            size="small"
            bordered
            column={1}
            items={items}
        />
    )
});
