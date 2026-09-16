/**
 * @description 画布的展示组件
 * @date 2025-6-5
 */
import { useState, useRef, useEffect, memo } from "react";
import styles from "./index.less";
import GraphStage from "./GraphStage";
import type { StageSize, ContextMenuType, NodeEdgeGroup } from "@/types/MapNestModify";
import Konva from "konva";
import { useDebounceFn } from "ahooks";
import GraphBar from "./GraphBar";
import type { MapInfo } from "@/utils/typing";
import ContextMenu from "./ContextMenu";
import GraphMenu from "./GraphMenu";
import type { OverlayVisible } from "@/types/OverLook";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import VehicleStatusLegend from "@/components/VehicleStatusLegend";

interface NestGraphProps {
    stage: Konva.Stage | null;
    mapInfo: MapInfo | null;
    useMapId: string;
    useMapVersionId: number | undefined;
    manualKey: string;
    selectShapes: Konva.Shape[];
    enableModify: boolean;
    trafficGroups: NodeEdgeGroup[];
    exclusiveGroups: NodeEdgeGroup[];
    setStage: (value: React.SetStateAction<Konva.Stage | null>) => void;
    setMapInfo: (value: React.SetStateAction<MapInfo | null>) => void;
    setManualKey: (value: React.SetStateAction<string>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    /** 地图数据加载完成后更新时间戳，通知 GraphPixel 刷新 */
    setMapLoadedAt: (value: React.SetStateAction<number>) => void;
}

export default memo((props: NestGraphProps) => {

    const { stage, mapInfo, useMapId, useMapVersionId, manualKey, selectShapes, enableModify, trafficGroups, exclusiveGroups, setStage, setMapInfo, setManualKey, setSelectShapes, setTrafficGroups, setExclusiveGroups, setMapLoadedAt } = props;

    const graphRef = useRef<HTMLDivElement>(null);
    // 画布的尺寸
    const [stageSize, setStageSize] = useState<StageSize>({ width: 0, height: 0 });
    // 右键菜单
    const [contextMenu, setContextMenu] = useState<ContextMenuType>({
        open: false
    });
    /**
     * 撤销/恢复的状态栈由 useUndoHistory 统一托管。
     * NestGraph 只负责把菜单需要的操作回调向下传递，避免菜单组件直接依赖画布状态细节。
     */
    const { handleUndo, handleRedo } = useUndoHistory({
        stage,
        trafficGroups,
        exclusiveGroups,
        setTrafficGroups,
        setExclusiveGroups,
        setSelectShapes,
        enableModify
    });

    // 元素的显示
    const [overlayVisible, setOverlayVisible] = useState<OverlayVisible>({
        nodeLabel: true,
        edgeLabel: false,
        traffic: false,
        robot: true,
        grid: false,
        angle: false,
        device: false,
        actions: false,
        // 路径属性着色默认全部关闭（SPEC edge_attribute_color_toggle D5）
        loadSecurityColor: false,
        freeSecurityColor: false,
        allowVehicleGroupsColor: false
    });

    // 网格间距（米），默认 1m 一格
    const [gridSpacing, setGridSpacing] = useState<number>(1);

    /**
     * 对 ResizeObserver 防抖，防止初始化的时候触发多次。
     * 注意：
     * 1. 使用 Math.floor 而非 Math.round —— 在 Windows 125%/150% 等非整数 DPI 下，
     *    容器实际 CSS 像素宽高经常带小数（例如 1228.8），如果用 round 上取整，
     *    会让 Konva Stage 比容器大零点几像素，触发外层滚动条出现 → 容器变小 →
     *    再次触发 ResizeObserver 的死循环，造成滚动条闪动以及鼠标点击坐标与
     *    Stage 实际渲染坐标偏移（节点位置和鼠标位置不一致）。
     * 2. 比较新旧尺寸避免无意义的 setState 引发重复渲染。
     */
    const { run: runObserver } = useDebounceFn((entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
            if (entry.target === graphRef.current) {
                const width = Math.floor(entry.contentRect.width);
                const height = Math.floor(entry.contentRect.height);
                setStageSize(prev => {
                    if (prev.width === width && prev.height === height) return prev;
                    return { width, height };
                });
            }
        }
    }, { wait: 200 });

    useEffect(() => {
        if (!graphRef.current) return;
        // 关键：把 ResizeObserver 放在 useEffect 内创建，
        // 避免组件每次 render 都 new 一个新实例（旧版的 const resizeObserver = new ResizeObserver(...)
        // 写在函数体里，每次 render 都重新创建，但 useEffect 只 observe 了第一次的实例，后续创建的实例都被泄漏掉）。
        const resizeObserver = new ResizeObserver(runObserver);
        resizeObserver.observe(graphRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [])

    return (
        <div className={styles.nest_graph} ref={graphRef}>
            {
                stageSize.width &&
                stageSize.height &&
                <GraphStage
                    useMapId={useMapId}
                    useMapVersionId={useMapVersionId}
                    stageSize={stageSize}
                    manualKey={manualKey}
                    selectShapes={selectShapes}
                    enableModify={enableModify}
                    overlayVisible={overlayVisible}
                    gridSpacing={gridSpacing}
                    setStage={setStage}
                    setMapInfo={setMapInfo}
                    setManualKey={setManualKey}
                    setContextMenu={setContextMenu}
                    setSelectShapes={setSelectShapes}
                    setTrafficGroups={setTrafficGroups}
                    setExclusiveGroups={setExclusiveGroups}
                    setMapLoadedAt={setMapLoadedAt}
                />
            }
            <GraphBar
                stage={stage}
                mapId={mapInfo?.mapId ?? ""}
            />
            {/* 车辆状态图例：右下角折叠式静态说明，与车辆图层显隐无关（SPEC_vehicle_status_legend） */}
            <VehicleStatusLegend />
            <GraphMenu
                stage={stage}
                enableModify={enableModify}
                trafficGroups={trafficGroups}
                exclusiveGroups={exclusiveGroups}
                gridSpacing={gridSpacing}
                setSelectShapes={setSelectShapes}
                setOverlayVisible={setOverlayVisible}
                setGridSpacing={setGridSpacing}
                setTrafficGroups={setTrafficGroups}
                setExclusiveGroups={setExclusiveGroups}
                onUndo={handleUndo}
                onRedo={handleRedo}
            />
            <ContextMenu
                useMapId={useMapId}
                contextMenu={contextMenu}
                selectShapes={selectShapes}
                trafficGroups={trafficGroups}
                exclusiveGroups={exclusiveGroups}
                setContextMenu={setContextMenu}
                setSelectShapes={setSelectShapes}
                setTrafficGroups={setTrafficGroups}
                setExclusiveGroups={setExclusiveGroups}
                setManualKey={setManualKey}
            />
        </div>
    )
});
