/**
 * @description 画布组件
 * @date 2025-6-11
 */
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import styles from "./index.less";
import GraphStage from "./GraphStage";
import GraphBar from "./GraphBar";
import Tooltip from "./Tooltip";
import Konva from "konva";
import { useDebounceFn } from "ahooks";
import { useModel } from "@umijs/max";
import type { StageSize, OverlayVisible } from "@/types/OverLook";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { splitNodeEdgeGroups, focusStageToArea } from "@/utils/areaHighlight";
import ChangeMap from "./ChangeMap";
import GraphMenu from "./GraphMenu";
import TrafficFilterSelect from "@/components/TrafficFilterSelect";
import VehicleStatusLegend from "@/components/VehicleStatusLegend";

interface ForceGraphProps {
    stage: Konva.Stage | null;
    setStage: (value: React.SetStateAction<Konva.Stage | null>) => void;
}

export default memo((props: ForceGraphProps) => {

    const { stage, setStage } = props;

    const { currentMapInfo } = useModel("currentMapInfo");

    // 画布的尺寸
    const [stageSize, setStageSize] = useState<StageSize>({ width: 0, height: 0 });
    // 地图中图层的显示隐藏
    const [overlayVisible, setOverlayVisible] = useState<OverlayVisible>({
        nodeLabel: true,
        edgeLabel: false,
        traffic: true,
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
    // 当前选中的元素的id
    const [focusId, setFocusId] = useState<string>();

    // === 交管白名单筛选（SPEC_traffic_filter_by_vehicle.md） ===
    // 交管白名单：选中的 agvKey 数组。空数组 = 显示全部（TrafficGroup 内短路）。不持久化
    const [visibleTrafficAgvKeys, setVisibleTrafficAgvKeys] = useState<string[]>([]);
    // 当前在线车辆列表（由 RobotLayer 经 onVehiclesChange 上报），用于构建交管筛选 options
    const [vehicles, setVehicles] = useState<{ agvKey: string; agvName?: string }[]>([]);
    // 上一次上报的 agvKey 集合指纹（排序串），用于高频 WS 推送下集合去抖
    const prevVehicleKeysRef = useRef<string>("");
    /**
     * 接收 RobotLayer 上报的车辆列表。
     * useCallback 稳定引用（RobotLayer 是 memo，引用变化会击穿其浅比较）；
     * set 前比较 agvKey 集合指纹，仅当车辆增减 / 换序时才更新，
     * 过滤掉纯位置、状态的高频变化，避免 ForceGraph 反复重渲染（SPEC §5.4）。
     */
    const handleVehiclesChange = useCallback((nextVehicles: { agvKey: string; agvName?: string }[]) => {
        const keys = nextVehicles.map(v => v.agvKey).sort().join(",");
        if (keys === prevVehicleKeysRef.current) return;
        prevVehicleKeysRef.current = keys;
        setVehicles(nextVehicles);
    }, []);
    /**
     * 交管白名单变更包装：
     * - 非空选中时，同步取消「隐藏所有交管信息」全局开关，避免选了车却看不到的困惑；
     * - 清空时不改动全局开关，保持当前显隐状态（SPEC §3.2）。
     */
    const handleTrafficFilterChange = useCallback((keys: string[]) => {
        setVisibleTrafficAgvKeys(keys);
        if (keys.length > 0) {
            setOverlayVisible(prev => ({ ...prev, traffic: true }));
        }
    }, []);
    // 交管筛选可选项：当前在线车辆 ∪ 已选（含离线），按 agvKey 去重（SPEC §3.5）
    const trafficFilterOptions = useMemo(() => {
        const map = new Map<string, { value: string; label: string }>();
        // 在线车 label 取 agvName || agvKey
        vehicles.forEach(v => {
            map.set(v.agvKey, { value: v.agvKey, label: v.agvName || v.agvKey });
        });
        // 已选但已离线的车：无 agvName，label 回退为 agvKey，确保列表里可单独取消
        visibleTrafficAgvKeys.forEach(k => {
            if (!map.has(k)) {
                map.set(k, { value: k, label: k });
            }
        });
        return Array.from(map.values());
    }, [vehicles, visibleTrafficAgvKeys]);
    // 切图时清空交管白名单（不同地图车辆不同，旧选择无意义；ForceGraph 常驻不卸载，需显式 reset，SPEC §5.3）
    useEffect(() => {
        setVisibleTrafficAgvKeys([]);
    }, [currentMapInfo?.mapId]);

    /**
     * 区域高亮状态（SPEC_area_highlight_monitoring_playback §4.3）。
     * ForceGraph 是区域数据的唯一持有方：GraphStage 加载地图后经 onNodeEdgeGroupsLoaded
     * 上抛，不自持副本；areaColorIndex 在 GraphStage 内派生。
     * 换图时随新数据整体替换并清空高亮集合（D9，不同地图 areaId 互不相通）。
     */
    const [areaGroups, setAreaGroups] = useState<NodeEdgeGroup[]>([]);
    const [highlightedAreaIds, setHighlightedAreaIds] = useState<Set<string>>(new Set());

    // 地图数据到达时上抛入口：刷新区域列表 + 清空高亮（D9）；useCallback 稳定引用供 GraphStage 使用
    const onNodeEdgeGroupsLoaded = useCallback((groups?: NodeEdgeGroup[]) => {
        setAreaGroups(groups || []);
        setHighlightedAreaIds(new Set());
    }, []);

    /**
     * 勾选/取消区域高亮（GraphMenu 透传，实现在此——本组件持有高亮集合）。
     * Overlook 无条件聚焦（D3）：勾选时画布 0.3s 平移到该区域。
     */
    const onToggleHighlight = useCallback((areaId: string, checked: boolean) => {
        setHighlightedAreaIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(areaId);
            else next.delete(areaId);
            return next;
        });
        if (checked && stage) {
            const targetGroup = areaGroups.find(group => group.id === areaId);
            if (targetGroup) focusStageToArea(stage, targetGroup);
        }
    }, [stage, areaGroups]);

    // 面板按类型分两组展示（D13）
    const { exclusiveGroups, trafficGroups } = useMemo(() => splitNodeEdgeGroups(areaGroups), [areaGroups]);

    const graphRef = useRef<HTMLDivElement>(null);

    // 对ResizeObserver防抖，防止初始化的时候触发多次
    const { run: runObserver } = useDebounceFn((entries) => {
        for (const entry of entries) {
            if (entry.target === graphRef.current) {
                const width = entry.contentRect.width;
                const height = entry.contentRect.height;
                setStageSize({
                    width: Math.round(width),
                    height: Math.round(height)
                });
            }
        }
    }, { wait: 200 });

    const resizeObserver = new ResizeObserver(runObserver);

    useEffect(() => {
        if (!graphRef.current) return;
        resizeObserver.observe(graphRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [])

    return (
        <div
            className={styles.force_graph}
            ref={graphRef}
        >
            {
                stageSize.width &&
                stageSize.height &&
                <GraphStage
                    stageSize={stageSize}
                    overlayVisible={overlayVisible}
                    gridSpacing={gridSpacing}
                    setStage={setStage}
                    visibleTrafficAgvKeys={visibleTrafficAgvKeys}
                    onVehiclesChange={handleVehiclesChange}
                    areaGroups={areaGroups}
                    highlightedAreaIds={highlightedAreaIds}
                    onNodeEdgeGroupsLoaded={onNodeEdgeGroupsLoaded}
                />
            }
            <ChangeMap
                setFocusId={setFocusId}
            />
            <TrafficFilterSelect
                value={visibleTrafficAgvKeys}
                onChange={handleTrafficFilterChange}
                options={trafficFilterOptions}
                size="large"
                style={{ position: "absolute", left: "calc(1rem + 220px + 12px)", top: "1rem" }}
            />
            <GraphMenu
                stage={stage}
                focusId={focusId}
                graphRef={graphRef}
                gridSpacing={gridSpacing}
                setFocusId={setFocusId}
                setOverlayVisible={setOverlayVisible}
                setGridSpacing={setGridSpacing}
                exclusiveGroups={exclusiveGroups}
                trafficGroups={trafficGroups}
                highlightedAreaIds={highlightedAreaIds}
                onToggleHighlight={onToggleHighlight}
            />
            <GraphBar stage={stage} mapId={currentMapInfo?.mapId || ""} />
            {/* 车辆状态图例：右下角折叠式静态说明，与车辆图层显隐无关（SPEC_vehicle_status_legend） */}
            <VehicleStatusLegend />
            <Tooltip />
        </div>
    )
});
