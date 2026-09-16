/**
 * @description 地图编辑界面
 * @date 2025-6-5
 */
import { useState, useCallback } from "react";
import { Splitter } from "antd";
import { useSearchParams } from "@umijs/max";
import styles from "./index.less";
import NestGraph from "./NestGraph";
import NestPanel from "./NestPanel";
import Konva from "konva";
import type { MapInfo } from "@/utils/typing";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { dedupShapes } from "@/utils/graph";
import { useI18n } from "@/hooks/useI18n";

export default () => {

    // 当前语言，用于按语言调整右侧面板默认宽度
    const { locale } = useI18n();

    // URL 搜索参数，用于从地图列表跳转时携带 mapId 和 mapVersionId
    const [searchParams] = useSearchParams();
    // 从 URL 读取的地图 ID，用于初始化地图选择
    const urlMapId = searchParams.get("mapId") || undefined;
    /**
     * 从 URL 读取的版本 ID，仅作为 VersionSelect 首次加载的参考值
     * 不直接用于 useState 初始值，避免干扰 VersionSelect 的自动选择逻辑
     */
    const urlMapVersionId = searchParams.get("mapVersionId") ? Number(searchParams.get("mapVersionId")) : undefined;

    // 是否启用编辑
    const [enableModify, setEnableModify] = useState<boolean>(false);
    // 画布实例
    const [stage, setStage] = useState<Konva.Stage | null>(null);
    // 地图编辑中使用的地图id
    const [useMapId, setUseMapId] = useState<string>(urlMapId ?? "");
    // 当前选中的地图版本ID，始终从 undefined 开始，由 VersionSelect 负责自动选择
    const [useMapVersionId, setUseMapVersionId] = useState<number | undefined>(undefined);
    // 当前选中的元素
    const [selectShapes, setSelectShapesRaw] = useState<Konva.Shape[]>([]);
    /**
     * 源头去重 setter：拦截所有写入，按 attrs.id 去重后再落 state。
     * 杜绝 Ctrl 框选 [...selected, ...inRectShapes] 拼接产生的重复项（D12）。
     * 对 setSelectShapes([]) / ([single]) 等天然无重复的写入零副作用。
     */
    const setSelectShapes = useCallback((value: React.SetStateAction<Konva.Shape[]>) => {
        setSelectShapesRaw(prev => {
            const next = typeof value === "function"
                ? (value as (prev: Konva.Shape[]) => Konva.Shape[])(prev)
                : value;
            return dedupShapes(next);
        });
    }, []);
    // 当前点击的功能项
    const [manualKey, setManualKey] = useState<string>("");
    // 当前的地图信息
    const [mapInfo, setMapInfo] = useState<MapInfo | null>(null);
    // 独占区列表
    const [exclusiveGroups, setExclusiveGroups] = useState<NodeEdgeGroup[]>([]);
    // 三方交管区域列表
    const [trafficGroups, setTrafficGroups] = useState<NodeEdgeGroup[]>([]);
    /**
     * 地图数据加载完成的时间戳
     * API 返回数据并渲染到 stage 后更新，作为 GraphPixel 的 refreshKey
     * 解决 refreshKey={useMapId} 在同一地图编辑时不变化的不可靠问题
     */
    const [mapLoadedAt, setMapLoadedAt] = useState<number>(0);

    /**
     * 右侧面板默认宽度按语言区分：
     * 中文（zh-CN / zh-TW）文案较短，默认 450 即可完整展示；
     * 其他语言（英/日/韩）文案偏长，默认 600 避免内容被挤压换行
     */
    const panelDefaultSize = locale.startsWith("zh") ? 450 : 600;

    return (
        <div className={styles.map_nest_modify}>
            <Splitter
                className={styles.map_splitter}
                lazy
            >
                <Splitter.Panel>
                    <NestGraph
                        stage={stage}
                        mapInfo={mapInfo}
                        useMapId={useMapId}
                        useMapVersionId={useMapVersionId}
                        manualKey={manualKey}
                        selectShapes={selectShapes}
                        enableModify={enableModify}
                        trafficGroups={trafficGroups}
                        exclusiveGroups={exclusiveGroups}
                        setStage={setStage}
                        setMapInfo={setMapInfo}
                        setManualKey={setManualKey}
                        setSelectShapes={setSelectShapes}
                        setTrafficGroups={setTrafficGroups}
                        setExclusiveGroups={setExclusiveGroups}
                        setMapLoadedAt={setMapLoadedAt}
                    />
                </Splitter.Panel>

                <Splitter.Panel defaultSize={panelDefaultSize} min={0} max={600} >
                    <NestPanel
                        stage={stage}
                        mapInfo={mapInfo}
                        useMapId={useMapId}
                        useMapVersionId={useMapVersionId}
                        urlMapVersionId={urlMapVersionId}
                        manualKey={manualKey}
                        selectShapes={selectShapes}
                        enableModify={enableModify}
                        trafficGroups={trafficGroups}
                        exclusiveGroups={exclusiveGroups}
                        mapLoadedAt={mapLoadedAt}
                        setUseMapId={setUseMapId}
                        setUseMapVersionId={setUseMapVersionId}
                        setManualKey={setManualKey}
                        setEnableModify={setEnableModify}
                        setSelectShapes={setSelectShapes}
                    />
                </Splitter.Panel>

            </Splitter>
        </div>
    )
};
