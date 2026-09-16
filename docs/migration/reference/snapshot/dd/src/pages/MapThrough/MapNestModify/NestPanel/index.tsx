/**
 * @description 画布组件的右侧操作栏
 * @date 2025-6-5
 */
import { memo } from "react";
import styles from "./index.less";
import type Konva from "konva";
import type { MapInfo } from "@/utils/typing";
import MapDescription from "./MapDescription";
import MapPaneTabs from "./MapPaneTabs";
import EnableModify from "./EnableModify";
import type { NodeEdgeGroup } from "@/types/MapNestModify";

interface NestPanelProps {
    stage: Konva.Stage | null;
    mapInfo: MapInfo | null;
    useMapId: string;
    useMapVersionId: number | undefined;
    /** URL 携带的版本 ID，传递给 VersionSelect 用于首次加载 */
    urlMapVersionId: number | undefined;
    manualKey: string;
    selectShapes: Konva.Shape[];
    enableModify: boolean;
    trafficGroups: NodeEdgeGroup[];
    exclusiveGroups: NodeEdgeGroup[];
    /** 地图数据加载完成的时间戳，用于通知 GraphPixel 刷新 */
    mapLoadedAt: number;
    setUseMapId: (value: React.SetStateAction<string>) => void;
    setUseMapVersionId: (value: React.SetStateAction<number | undefined>) => void;
    setManualKey: (value: React.SetStateAction<string>) => void;
    setEnableModify: (value: React.SetStateAction<boolean>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
}

export default memo((props: NestPanelProps) => {

    const { stage, mapInfo, useMapId, useMapVersionId, urlMapVersionId, manualKey, selectShapes, enableModify, trafficGroups, exclusiveGroups, mapLoadedAt, setUseMapId, setUseMapVersionId, setManualKey, setEnableModify, setSelectShapes } = props;

    return (
        <div className={styles.nest_panel}>
            <MapDescription
                mapInfo={mapInfo}
                useMapId={useMapId}
                useMapVersionId={useMapVersionId}
                urlMapVersionId={urlMapVersionId}
                enableModify={enableModify}
                setUseMapId={setUseMapId}
                setUseMapVersionId={setUseMapVersionId}
                setManualKey={setManualKey}
                setEnableModify={setEnableModify}
                setSelectShapes={setSelectShapes}
            />
            <EnableModify
                stage={stage}
                useMapId={useMapId}
                useMapVersionId={useMapVersionId}
                enableModify={enableModify}
                trafficGroups={trafficGroups}
                exclusiveGroups={exclusiveGroups}
                setManualKey={setManualKey}
                setEnableModify={setEnableModify}
                setUseMapVersionId={setUseMapVersionId}
            />
            <MapPaneTabs
                stage={stage}
                useMapId={useMapId}
                mapLoadedAt={mapLoadedAt}
                manualKey={manualKey}
                selectShapes={selectShapes}
                enableModify={enableModify}
                setManualKey={setManualKey}
                setSelectShapes={setSelectShapes}
            />
        </div>
    )
});
