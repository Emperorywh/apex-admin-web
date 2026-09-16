/**
 * @description 画布组件
 * @date 2025-5-19
 * @callback propsForceGraphIsEqual 增加props的时候请在优化中添加判断
 */
import { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { useLocalStorageState } from "ahooks";
import { message, Spin, Popover, Typography } from "antd";
import type { DescriptionsProps } from "antd";
import { useModel } from "@umijs/max";
import ErrorEntryTable from "@/components/ErrorEntryTable";
import { useI18n } from "@/hooks/useI18n";
import { Stage } from "react-konva/lib/ReactKonvaCore";
import Konva from "konva";
import { getMapInfo } from "@/api";
import { screenToWorld, calcStagePosition, fitStageToNodes } from "@/utils/bindStage";
import { buildAreaColorIndex } from "@/utils/areaHighlight";
import GridLayer from "@/components/GridLayer";
import NodesLayer from "./NodesLayer";
import EdgesLayer from "./EdgesLayer";
import DeviceLayer from "./DeviceLayer";
import RobotLayer from "./RobotLayer";
import ActionBadgeLayer from "./ActionBadgeLayer";
import { ActionTooltip } from "@/plugins/konva/actions";
import type { ActionTooltipData } from "@/plugins/konva/actions";
import styles from "./index.less";
import { konvaConfig } from "@/plugins/konva";
import { computeAdaptiveScale } from "@/plugins/konva/runtime/adaptiveScale";
import { MAP_NEST_STAGE_ATTR } from "@/plugins/konva/runtime/constants";
import { propsForceGraphIsEqual } from "@/utils/memoFn";
import type { MapNode, MapEdge } from "@/utils/typing";
import type { StageSize, OverlayVisible } from "@/types/OverLook";
import { findHitNode, unSelectShapeEvent } from "@/utils/graph";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { RobotStatus } from "@/utils/enum";
import OrderInfoModal from "@/components/OrderInfoModal";
import QuickCreateOrderModal from "@/components/QuickCreateOrderModal";
import VehicleInfoModal from "@/components/VehicleInfoModal";

const { Text } = Typography;

export interface GraphStageProps {
    stageSize: StageSize;
    overlayVisible: OverlayVisible;
    gridSpacing: number;
    setStage: (value: React.SetStateAction<Konva.Stage | null>) => void;
    /**
     * 交管白名单（选中 agvKey 数组）：透传给 RobotLayer→TrafficGroup 做交管过滤。
     * 空数组 = 全显。该字段已纳入 propsForceGraphIsEqual 比较（SPEC §5.5）。
     */
    visibleTrafficAgvKeys?: string[];
    /**
     * 车辆列表上报回调：透传给 RobotLayer，稳定引用（useCallback），不纳入 memo 比较。
     */
    onVehiclesChange?: (vehicles: { agvKey: string; agvName?: string }[]) => void;
    /** 区域（独占区/三方交管）分组列表，由 ForceGraph 持有，仅用于派生 areaColorIndex（SPEC_area_highlight_monitoring_playback §4.3） */
    areaGroups: NodeEdgeGroup[];
    /** 当前高亮中的区域ID集合 */
    highlightedAreaIds: Set<string>;
    /** 地图数据到达时上抛 nodeEdgeGroups（本组件不自持区域数据副本）；引用需稳定（useCallback） */
    onNodeEdgeGroupsLoaded?: (groups?: NodeEdgeGroup[]) => void;
}

export default memo((props: GraphStageProps) => {

    const { stageSize, overlayVisible, gridSpacing, setStage, visibleTrafficAgvKeys, onVehiclesChange, areaGroups, highlightedAreaIds, onNodeEdgeGroupsLoaded } = props;

    const stageRef = useRef<Konva.Stage>(null);

    /**
     * 国际化翻译方法
     * 用于将画布上的 tooltip 文案、加载提示等进行多语言转换
     */
    const { t } = useI18n();

    /**
     * visualScale 运行时值（节点/路径 sceneFunc 通过 stage attr 读取，D1）。
     * 不作为 React state 驱动 NodesLayer/EdgesLayer 的 re-render——它们是 memo，
     * 缩放时 props 不变被跳过，仅靠 batchDraw 让 sceneFunc 重绘。
     */
    const visualScaleRef = useRef<number>(1);
    /** rAF 合流 id，避免滚轮 / ZoomIn-ZoomOut Tween 高频触发反复 batchDraw */
    const rafIdRef = useRef<number>(0);
    /**
     * 轻量 React state，仅驱动声明式设备/角标图层的 re-render（写入其 data.scale，D5）。
     * 不会触发 NodesLayer/EdgesLayer 的重建，不引发 sync-back。
     */
    const [visualScaleForReact, setVisualScaleForReact] = useState<number>(1);
    const { currentMapInfo, setCurrentMapInfo } = useModel("currentMapInfo");
    const { setTooltip } = useModel("tooltipJson");
    const [nodes, setNodes] = useState<MapNode[]>([]);
    const [edges, setEdges] = useState<MapEdge[]>([]);
    // 地图的加载中状态 这个不要改
    const [spinning, setSpinning] = useState<boolean>(true);
    // 是否开启优化模式 减少元素的渲染
    const [enableOptimize, setEnableOptimize] = useState<boolean>(false);
    /**
     * 暗黑主题：设备图标配色据此切换（SPEC D15）。
     * Overlook 画布原本无主题逻辑，此处为新引入。
     */
    const [localTheme] = useLocalStorageState<"defaultAlgorithm" | "darkAlgorithm">("theme");
    const isDark = localTheme === "darkAlgorithm";

    /**
     * 动作角标 hover 状态（D9-D11）。onActionHover 用 useCallback 稳定引用，
     * 避免作为 ActionBadgeLayer prop 频繁变化触发其重渲染。
     */
    const [actionHover, setActionHover] = useState<ActionTooltipData | null>(null);
    const onActionHover = useCallback((hover: ActionTooltipData | null) => setActionHover(hover), []);
    // 上一次自适应（fit）所用 nodes 的引用。
    // 换图时 mapId 先变、nodes 后到；以 nodes 引用作为"是否需重新 fit"的依据，
    // 可保证每次新地图数据到达都 fit 一次，而同一批数据不重复 fit。
    const lastFitNodesRef = useRef<MapNode[] | null>(null);

    /**
     * rAF 合流更新自适应倍率。
     * 每帧最多执行一次，不经过 NodesLayer/EdgesLayer 的 React 渲染周期：
     * 直接 setAttr + batchDraw，节点/路径 sceneFunc 重绘时读新 attr 乘上去。
     * 与 MapNestModify 的关键差异：Overlook 节点/路径 listening=false、sceneFunc 运行时读
     * stage attr 直接乘，无需 applyVisualScaleToAllShapes 改 shapeStyle attr。
     */
    const updateAdaptiveScale = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return;
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            const scaleX = stage.scaleX();
            const newScale = computeAdaptiveScale(scaleX);
            // 变化 < 0.01 跳过，避免微小抖动反复 batchDraw
            if (Math.abs(visualScaleRef.current - newScale) < 0.01) return;
            visualScaleRef.current = newScale;
            // 节点/路径 sceneFunc 运行时读取此 attr（D1）
            stage.setAttr(MAP_NEST_STAGE_ATTR.visualScale, newScale);
            // 设备/角标声明式图层经此 re-render 更新 data.scale（D5）
            setVisualScaleForReact(newScale);
            // 重绘：节点/路径 sceneFunc 读新 attr；设备/角标因 prop 变化各自重绘
            stage.batchDraw();
        });
    }, []);

    /** 监听 Konva scaleXChange 事件，统一捕获滚轮 / ZoomIn-ZoomOut Tween / 换图 fit 所有缩放来源 */
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.on("scaleXChange", updateAdaptiveScale);
        return () => {
            stage.off("scaleXChange", updateAdaptiveScale);
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [updateAdaptiveScale]);

    /**
     * 路径属性着色开关变化时，写入 stage 自定义 attr 并重绘（SPEC edge_attribute_color_toggle）。
     * EdgesLayer sceneFunc 运行时通过 stage.getAttr(edgeColorVisible) 读取，决定是否按属性着色。
     * 这是 Overlook 首次引入「overlayVisible → useEffect → stage.setAttr」桥接，
     * 与 MapNestModify 的 labelVisible useEffect 同构（不涉及新概念）。
     */
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.setAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible, {
            loadSecurity: overlayVisible.loadSecurityColor,
            freeSecurity: overlayVisible.freeSecurityColor,
            allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
        });
        stage.batchDraw();
    }, [overlayVisible.loadSecurityColor, overlayVisible.freeSecurityColor, overlayVisible.allowVehicleGroupsColor]);

    /**
     * 声明式区域高亮索引（D4）：shapeId → 混色。
     * 勾选集合 / 区域数据变化时重算，经 props 下发两层，sceneFunc 绘制时查表覆盖颜色；
     * 不写 shape attrs，换图重建 shape 后高亮随 props 天然恢复。
     */
    const areaColorIndex = useMemo(
        () => buildAreaColorIndex(areaGroups, highlightedAreaIds),
        [areaGroups, highlightedAreaIds]
    );

    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [orderModalKey, setOrderModalKey] = useState("");
    const openOrderModal = useCallback((key: string) => {
        setOrderModalKey(key);
        setOrderModalOpen(true);
    }, []);

    const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
    const [vehicleModalKey, setVehicleModalKey] = useState("");
    const openVehicleModal = useCallback((key: string) => {
        setVehicleModalKey(key);
        setVehicleModalOpen(true);
    }, []);

    // 右键节点快捷创建任务弹窗状态（逻辑集中在 GraphStage，NodesLayer 零改动）
    const [quickCreate, setQuickCreate] = useState<{
        open: boolean;
        mapId?: string;
        stationId?: string;
    }>({ open: false });

    // 右键按下时的屏幕坐标：右键拖拽平移后抬起会触发 contextmenu，用位移阈值判定拖拽防误触
    const rightDownPosRef = useRef<{ x: number; y: number } | null>(null);

    // 画布的缩放事件 这里没防抖 体验感不好
    const onStageWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
        event.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const scaleX = stage.scaleX();
        const scaleY = stage.scaleY();
        const direction = event.evt.deltaY > 0 ? -1 : 1;
        const scaleBy = 1.1;
        const newScaleX = direction > 0 ? scaleX * scaleBy : scaleX / scaleBy;
        const newScaleY = direction > 0 ? scaleY * scaleBy : scaleY / scaleBy;
        if (newScaleX <= konvaConfig.minZoom || newScaleX >= konvaConfig.maxZoom) return;
        const worldPoint = screenToWorld(pointer.x, pointer.y, stage);
        stage.scale({ x: newScaleX, y: newScaleY });
        const position = calcStagePosition(worldPoint.x, worldPoint.y, newScaleX, newScaleY, stage.rotation(), pointer.x, pointer.y);
        stage.position(position);
    };

    // 画布的点击事件
    const onStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        const { target, evt } = event;
        console.log("画布的点击事件", target);
        if (evt.button === 2) return;
        if (target === target.getStage()) {
            // 是画布
            setTooltip({ visible: false });
            unSelectShapeEvent(event);
        }
        if (target.attrs?.isRobot) {
            // 是车辆，设置tooltip的属性
            const { attrs: {
                agvName,
                id,
                batteryCharge,
                vehicleProcStatus,
                loaded,
                orderTaskKey,
                omega,
                vx,
                vy,
                paused,
                localizationScore,
                errorEntryList,
                x,
                y
            } } = target;
            const items: DescriptionsProps["items"] = [
                {
                    key: "agvName",
                    label: t("名称"),
                    children: <a onClick={() => openVehicleModal(id)} style={{ cursor: "pointer" }}>{agvName}</a>
                },
                {
                    key: "agvKey",
                    label: t("标识"),
                    children: id
                },
                {
                    key: "batteryCharge",
                    label: t("电量"),
                    children: batteryCharge
                },
                {
                    key: "vehicleProcStatus",
                    label: t("状态"),
                    children: t(RobotStatus[vehicleProcStatus as keyof typeof RobotStatus] || vehicleProcStatus)
                },
                {
                    key: "loaded",
                    label: t("载货"),
                    children: loaded ? t("是") : t("否")
                },
                {
                    key: "loadTheta",
                    label: t("托盘角度"),
                    // loads 不在 konva 节点 attrs 上，点击瞬间先占位，由 Tooltip 的 ws 刷新分支补全真实值
                    children: "-"
                },
                {
                    key: "velocity",
                    label: t("速度"),
                    children: `vx: ${vx} vy: ${vy} omega: ${omega}`
                },
                {
                    key: "orderTaskKey",
                    label: t("订单"),
                    children: <a onClick={() => openOrderModal(orderTaskKey)} style={{ cursor: "pointer" }}>{orderTaskKey}</a>
                },
                {
                    key: "paused",
                    label: t("暂停"),
                    children: paused ? t("是") : t("否")
                },
                {
                    key: "localizationScore",
                    label: t("定位置信度"),
                    children: localizationScore
                },
                {
                    key: "agvPosition",
                    label: t("位置"),
                    children: `x: ${x ?? "-"} y: ${y != null ? -y : "-"}`
                },
                {
                    key: "errorEntryList",
                    label: t("告警"),
                    // 与 Tooltip WS 刷新分支保持同形，保证点击瞬间与首条 WS 推送之间不再闪现旧 JSON
                    children: Array.isArray(errorEntryList) && errorEntryList.length > 0 ? (
                        <Popover
                            title={t("车辆告警")}
                            content={
                                // 宽度由外层 div 控制，表格 width:100% 自适应填充
                                <div style={{ width: 880 }}>
                                    <ErrorEntryTable errorEntryList={errorEntryList} />
                                </div>
                            }
                        >
                            <Text code>{t("详情")}</Text>
                        </Popover>
                    ) : (
                        <Text type="secondary">{t("暂无告警")}</Text>
                    )
                }
            ];
            setTooltip({
                visible: true,
                description: items,
                vehicleKey: id,
                clientX: evt.clientX + 20,
                clientY: evt.clientY + 20
            });
        }
    };

    // 右键按下时记录屏幕坐标，供 contextmenu 判定是否为右键拖拽平移
    const onStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (event.evt.button === 2) {
            rightDownPosRef.current = { x: event.evt.clientX, y: event.evt.clientY };
        }
    };

    /**
     * 画布右键事件：命中节点则打开快捷创建任务弹窗
     * NodesLayer listening=false（性能优化），Konva 事件无法命中节点，
     * 故在 Stage 级做手动几何命中；未命中 / 机器人 / 右键拖拽均静默，仅阻止浏览器默认菜单
     */
    const onStageContextMenu = (event: Konva.KonvaEventObject<MouseEvent>) => {
        event.evt.preventDefault();
        // 机器人上右键静默（即使其下方几何命中节点也不弹窗）
        if (event.target.attrs?.isRobot) return;
        // 右键拖拽平移后抬起不弹窗（位移阈值 5px）
        const down = rightDownPosRef.current;
        if (down && Math.hypot(event.evt.clientX - down.x, event.evt.clientY - down.y) > 5) return;
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        // 指针屏幕坐标 → 世界坐标，遍历节点找最近命中（命中半径 = 绘制半径，所见即所点）
        const world = screenToWorld(pointer.x, pointer.y, stage);
        const hitNode = findHitNode(nodes, world, visualScaleRef.current);
        // 未命中静默
        if (!hitNode) return;
        setQuickCreate({ open: true, mapId: currentMapInfo.mapId, stationId: hitNode.id });
    };

    useEffect(() => {
        if (!currentMapInfo.mapId) return;
        getMapInfo({ mapId: currentMapInfo.mapId }).then(res => {
            if (res.code === 200 && res.message === "success" && res.data) {
                const { data: { currentMapInfoVersion: { mapJson } } } = res;
                if (mapJson) {
                    const { nodes, edges, nodeEdgeGroups } = mapJson;
                    setNodes(nodes);
                    setEdges(edges);
                    // 区域分组数据上抛给 ForceGraph（数据唯一持有方），同时触发其清空高亮集合（D9）
                    onNodeEdgeGroupsLoaded?.(nodeEdgeGroups);
                    setEnableOptimize(nodes.length + edges.length >= konvaConfig.maxCount);
                    if (stageRef.current) {
                        setStage(stageRef.current);
                        // 换图重置：fit 前 visualScale 先回到 1，避免 DeviceLayer/ActionBadgeLayer
                        // 用上一张图的倍率渲染；fit 完成后 scaleXChange 自动驱动真实值（§5.3d）
                        visualScaleRef.current = 1;
                        stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.visualScale, 1);
                        // 换图时同步写入路径属性着色 attr（SPEC edge_attribute_color_toggle）
                        stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible, {
                            loadSecurity: overlayVisible.loadSecurityColor,
                            freeSecurity: overlayVisible.freeSecurityColor,
                            allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
                        });
                        setVisualScaleForReact(1);
                    }
                    /**
                     * 地图数据加载完成，更新时间戳
                     * 通知 GraphPixel 等依赖 stage 数据的组件刷新
                     */
                    setCurrentMapInfo(prev => ({ ...prev, mapLoadedAt: Date.now() }));
                } else {
                    message.warning(t("初始化地图信息失败") + res?.message);
                }
            } else {
                message.warning(t("初始化地图信息失败") + res?.message);
            }
            setSpinning(false);
        }).catch(err => {
            if (err) {
                setSpinning(false);
                message.error(t("初始化地图信息失败") + err?.message);
            }
        });
    }, [currentMapInfo.mapId])

    /**
     * @description 自适应完整视图（首次进入页面 / 切换地图时各触发一次）
     * @date 2026-6-26
     *
     * 触发依据是 nodes 引用变化，而非 mapId：换图时 mapId 先变、nodes 仍为旧值，
     * 若按 mapId 判断会拿旧节点提前 fit，等新节点到达后又被"已 fit 过"挡掉。
     * nodes 只在 getMapInfo 回调里 setNodes（对应当时的 mapId），故 nodes 变化即代表
     * "当前 mapId 的新数据已就绪"。用 lastFitNodesRef 记录上次 fit 的 nodes 引用，
     * 仅当引用真正变化时 fit 一次，避免渲染反复触发。
     */
    useEffect(() => {
        const mapId = currentMapInfo.mapId;
        // 无地图 / 节点未就绪 / 当前 nodes 已 fit 过 → 跳过
        if (!mapId || nodes.length === 0 || lastFitNodesRef.current === nodes) return;

        let cancelled = false;
        const startTime = Date.now();
        const pollInterval = 50;
        const timeoutMs = 5000;

        const tryFit = () => {
            if (cancelled) return;
            const stage = stageRef.current;
            // fitStageToNodes 对未挂载 / 尺寸为 0 的 stage 返回 null，借此作为等待条件
            const result = stage
                ? fitStageToNodes(
                    stage,
                    nodes.map(n => ({ x: n.x, y: -n.y })),
                    // 瞬时应用：首次进入无需动画过渡，且确定性写入不受其它 Tween 干扰
                    { animate: false },
                )
                : null;
            if (result) {
                lastFitNodesRef.current = nodes;
                return;
            }
            // 条件未满足：stage 未挂载或尺寸仍为 0（容器过渡中）→ 继续等
            if (Date.now() - startTime > timeoutMs) return;
            setTimeout(tryFit, pollInterval);
        };
        tryFit();

        return () => { cancelled = true; };
    }, [currentMapInfo.mapId, nodes]);

    useEffect(() => {
        // 退出时销毁实例
        return () => {
            stageRef.current?.destroy();
        }
    }, [])

    return (
        <>
            <Spin
                className={styles.spinning}
                spinning={spinning}
                delay={200}
                size="large"
                tip={t("加载中...")}
            >
                <Stage
                    width={stageSize.width}
                    height={stageSize.height}
                    ref={stageRef}
                    draggable
                    onWheel={onStageWheel}
                    onClick={onStageClick}
                    onMouseDown={onStageMouseDown}
                    onContextMenu={onStageContextMenu}
                >
                    {/* 网格图层放在最底层，用于辅助距离观测 */}
                    <GridLayer
                        visible={overlayVisible.grid}
                        gridSpacing={gridSpacing}
                    />
                    {/* 卸载掉组件重新加载可以减少加载的时间 */}
                    {
                        !spinning && <EdgesLayer
                            edges={edges}
                            enableOptimize={enableOptimize}
                            edgeLabelVisible={overlayVisible.edgeLabel}
                            areaColorIndex={areaColorIndex}
                        />
                    }
                    {/* 三方设备图标层：挂载于 EdgesLayer 之后 */}
                    {
                        !spinning && <DeviceLayer
                            edges={edges}
                            visible={overlayVisible.device}
                            enableOptimize={enableOptimize}
                            isDark={isDark}
                            visualScale={visualScaleForReact}
                        />
                    }
                    {/* 动作角标层：挂载于 DeviceLayer 之后 */}
                    {
                        !spinning && <ActionBadgeLayer
                            nodes={nodes}
                            edges={edges}
                            visible={overlayVisible.actions}
                            enableOptimize={enableOptimize}
                            isDark={isDark}
                            onActionHover={onActionHover}
                            visualScale={visualScaleForReact}
                        />
                    }
                    {
                        !spinning && <NodesLayer
                            nodes={nodes}
                            enableOptimize={enableOptimize}
                            nodeLabelVisible={overlayVisible.nodeLabel}
                            areaColorIndex={areaColorIndex}
                        />
                    }
                    {
                        !spinning && <RobotLayer
                            overlayVisible={overlayVisible}
                            visibleAgvKeys={visibleTrafficAgvKeys}
                            onVehiclesChange={onVehiclesChange}
                        />
                    }
                </Stage>
            </Spin>
            {/* 动作角标 hover 详情浮层（每动作一卡，贴锚点定位，D9-D11） */}
            <ActionTooltip data={actionHover} isDark={isDark} />
            <OrderInfoModal open={orderModalOpen} orderKey={orderModalKey} onClose={() => setOrderModalOpen(false)} />
            <VehicleInfoModal open={vehicleModalOpen} vehicleKey={vehicleModalKey} onClose={() => setVehicleModalOpen(false)} />
            {/* 右键节点快捷创建任务弹窗（与 OrderInfoModal/VehicleInfoModal 并列，绝不能放进 Stage 内） */}
            <QuickCreateOrderModal
                open={quickCreate.open}
                defaultMission={{ mapId: quickCreate.mapId, stationId: quickCreate.stationId }}
                onClose={() => setQuickCreate({ open: false })}
            />
        </>
    )
}, propsForceGraphIsEqual);
