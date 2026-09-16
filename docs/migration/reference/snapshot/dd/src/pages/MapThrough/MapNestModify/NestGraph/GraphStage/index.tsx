/**
 * @description react-konva画布
 * @date 2025-6-5
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocalStorageState } from "ahooks";
import { Stage } from "react-konva";
import { Spin, message } from "antd";
import Konva from "konva";
import styles from "./index.less";
import { getMapInfo, getMapInfoVersion } from "@/api";
import type { MapNode, MapEdge, MapInfo } from "@/utils/typing";
import NodesLayer from "./NodesLayer";
import EdgesLayer from "./EdgesLayer";
import DeviceLayer from "./DeviceLayer";
import AnglesLayer from "./AnglesLayer";
import ActionLayer from "./ActionLayer";
import { unSelectShapeEvent, onNodeShapeDragMove, updateShapeStyle, setNodeDraggable, deselectShape } from "@/utils/graph";
import { saveSnapshot } from "@/utils/undoHistory";
import RobotLayer from "./RobotLayer";
import { konvaConfig } from "@/plugins/konva";
import AreaLayer from "./AreaLayer";
import GridLayer from "@/components/GridLayer";
import { degToRad } from "@/utils/bindStage";
import { getRotateCache } from "@/components/RotateMap";
import { computeRightAngleDragSnap } from "@/utils/angle";
import { deviceTypeLabels } from "@/plugins/konva/devices";
import type { DeviceIconType } from "@/plugins/konva/devices";
import { refreshDeviceIcons } from "@/plugins/konva/devices";
import { refreshActionBadges, ActionTooltip } from "@/plugins/konva/actions";
import type { ActionTooltipData } from "@/plugins/konva/actions";
import ActionBadgeLayer from "./ActionBadgeLayer";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";
import { applyVisualScaleToAllShapes } from "@/plugins/konva/runtime/applyVisualScale";
import { computeAdaptiveScale } from "@/plugins/konva/runtime/adaptiveScale";
import { findNearbyEdges } from "@/utils/nearbyElements";
import type { StageSize, ContextMenuType, NodeEdgeGroup, NearbyCandidate } from "@/types/MapNestModify";
import type { OverlayVisible } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

interface GraphStageProps {
    useMapId: string;
    /** 当前选中的地图版本 ID，undefined 时表示未选择地图 */
    useMapVersionId: number | undefined;
    stageSize: StageSize;
    manualKey: string;
    selectShapes: Konva.Shape[];
    enableModify: boolean;
    overlayVisible: OverlayVisible;
    /** 网格间距（米），由上层 NestGraph 管理 */
    gridSpacing: number;
    setStage: (value: React.SetStateAction<Konva.Stage | null>) => void;
    setMapInfo: (value: React.SetStateAction<MapInfo | null>) => void;
    setManualKey: (value: React.SetStateAction<string>) => void;
    setContextMenu: (value: React.SetStateAction<ContextMenuType>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    /** 地图数据加载完成后更新时间戳，通知 GraphPixel 刷新 */
    setMapLoadedAt: (value: React.SetStateAction<number>) => void;
}

/**
 * 自适应视觉倍率：根据画布缩放倍率自动调节节点大小和路径粗细。
 * 使用自然对数插值，锚点为 stageScale=50→ratio=1.0, stageScale=1000→ratio=0.05。
 * 仅影响地图编辑器显示，不持久化到数据库。
 * 计算逻辑已抽到共享模块 @/plugins/konva/runtime/adaptiveScale（Overlook 共用）。
 */

/**
 * 需要禁用节点拖动的模式：四种画线模式占用手势（画线时避免误拖节点）。
 * 与 ManualPane onManualSelect/onManualDeselect、onStageContextMenu 中的数组保持同步。
 */
const NODE_DRAG_DISABLED_MANUAL_KEYS = ["forwardLine", "reverseLine", "forwardBezier", "reverseBezier"];

export default (props: GraphStageProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { useMapId, useMapVersionId, stageSize, manualKey, selectShapes, enableModify, overlayVisible, gridSpacing, setStage, setMapInfo, setManualKey, setContextMenu, setSelectShapes, setTrafficGroups, setExclusiveGroups, setMapLoadedAt } = props;

    const stageRef = useRef<Konva.Stage>(null);
    // 三方设备图标 hover 提示节点（直接 DOM 操作，避免 mousemove 高频触发 React 重渲染）
    const deviceTooltipRef = useRef<HTMLDivElement>(null);
    const [spinning, setSpinning] = useState<boolean>(false);
    const [nodes, setNodes] = useState<MapNode[]>([]);
    const [edges, setEdges] = useState<MapEdge[]>([]);

    /**
     * visualScale 运行时值（命令式消费者通过 stage attr 读取）
     * 不再作为 React state 驱动 NodesLayer/EdgesLayer 的 useMemo
     */
    const visualScaleRef = useRef<number>(1);
    /**
     * rAF 合流 id，避免滚轮事件高频触发
     */
    const rafIdRef = useRef<number>(0);

    /**
     * 轻量 React state，仅驱动声明式组件（ControlPoints、AddNode、AnglesLayer）的 re-render。
     * 不会触发 NodesLayer/EdgesLayer 的重建，不引发 sync-back。
     */
    const [visualScaleForReact, setVisualScaleForReact] = useState<number>(1);

    /**
     * 暗黑主题：设备图标等命令式绘制据此切换配色（SPEC D15）。
     * 三个画布原本无任何主题逻辑，此处为新引入。
     */
    const [localTheme] = useLocalStorageState<"defaultAlgorithm" | "darkAlgorithm">("theme");
    const isDark = localTheme === "darkAlgorithm";

    /**
     * 动作角标 hover 状态：hover 角标时回传 {actions, 锚点屏幕坐标}，渲染 ActionTooltip 浮层（D9-D11）。
     * onActionHover 用 useCallback 稳定引用，避免 ActionBadgeLayer 因回调变化频繁重建。
     */
    const [actionHover, setActionHover] = useState<ActionTooltipData | null>(null);
    const onActionHover = useCallback((hover: ActionTooltipData | null) => setActionHover(hover), []);

    /**
     * rAF 合流更新自适应倍率。
     * 每帧最多执行一次，不经过 React 渲染周期，直接 setAttr + batchDraw。
     */
    const updateAdaptiveScale = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return;
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            const scaleX = stage.scaleX();
            const newScale = computeAdaptiveScale(scaleX);
            if (Math.abs(visualScaleRef.current - newScale) < 0.01) return;
            visualScaleRef.current = newScale;
            stage.setAttr(MAP_NEST_STAGE_ATTR.visualScale, newScale);
            setVisualScaleForReact(newScale);
            applyVisualScaleToAllShapes(stage, newScale);
            stage.batchDraw();
        });
    }, []);

    /** 监听 Konva scaleXChange 事件，统一捕获滚轮/按钮/Tween 所有缩放来源 */
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
     * 标签可见性变化时，写入 stage 自定义 attr 并重绘。
     * sceneFunc 运行时通过 shape.getStage()?.getAttr('labelVisible') 读取。
     */
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.setAttr(MAP_NEST_STAGE_ATTR.labelVisible, {
            node: overlayVisible.nodeLabel,
            edge: overlayVisible.edgeLabel,
        });
        stage.batchDraw();
    }, [overlayVisible.nodeLabel, overlayVisible.edgeLabel]);

    /**
     * 路径属性着色开关变化时，写入 stage 自定义 attr 并重绘（SPEC edge_attribute_color_toggle）。
     * edgeSceneFunc 运行时通过 stage.getAttr(edgeColorVisible) 读取，决定是否按属性着色。
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
     * 暗黑主题变化时，写入 stage 自定义 attr 并重绘。
     * 设备图标 sceneFunc 通过 data.isDark 读取（由 DeviceLayer 下传），
     * 此处写 stage attr 供未来其他命令式 sceneFunc 复用，保持与 visualScale/labelVisible 同机制（SPEC §3.4）。
     */
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.setAttr(MAP_NEST_STAGE_ATTR.isDark, isDark);
        stage.batchDraw();
    }, [isDark]);

    /**
     * v2 §4.2/§4.11：退出框选同向模式时清理基准快照与十字光标（兜底 effect）。
     * 所有退出路径（有效框选后 BrushSelect 内部退出、右键退出、切换其他模式）
     * 最终都表现为 manualKey 离开 brushSelectSameDir，这里统一兜底，
     * BrushSelect / onStageContextMenu 无需各自重复清理；
     * cursor 恢复 default 后，后续 mousemove 会按 hover 状态重设。
     */
    useEffect(() => {
        // 框选同向两种模式（拓扑/方向，SPEC_brush_same_direction_split）都占用手动判断，
        // 统一收口避免五处数组漂移
        const isSameDirMode = manualKey === "brushSelectSameDir" || manualKey === "brushSelectSameAngle";
        if (isSameDirMode) return;
        const stage = stageRef.current;
        if (!stage) return;
        if (stage.getAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge)) {
            stage.setAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge, null);
        }
        if (stage.container()?.style?.cursor === "crosshair") {
            stage.container().style.cursor = "default";
        }
    }, [manualKey]);

    /**
     * manualKey 变化时统一同步所有节点的 draggable（根因修复：复制后节点拖不动、变成拖动画布）。
     *
     * 背景：连线模式的禁用由菜单 onManualSelect 命令式调用 setNodeDraggable(stage, false)，
     * 恢复却挂在菜单 onManualDeselect 上。而 rc-menu 单选模式下从 A 项直接点击 B 项
     * 只触发 B 的 onSelect、不触发 A 的 onDeselect（rc-menu/es/Menu.js triggerSelection：
     * exist ? onDeselect : onSelect），"画线 → 直接切框选/添加节点"这条路径上恢复永远不执行，
     * 节点停留在 draggable=false：仍可点击选中（onStageClick 不检查 draggable），
     * 但 Konva 已摘掉节点自身的拖拽监听（_dragChange → _dragCleanup），
     * mousedown 冒泡到 Stage 后由 Stage 抢到拖拽，表现为"拖节点变成平移画布"；
     * 此时复制的节点也会通过 ...attrs 继承 draggable=false。
     * 这里以 manualKey 为唯一事实来源收口：非连线模式一律恢复节点可拖动，
     * 菜单层/右键处的命令式调用保留为幂等前置，行为不变。
     */
    useEffect(() => {
        setNodeDraggable(stageRef.current, !NODE_DRAG_DISABLED_MANUAL_KEYS.includes(manualKey));
    }, [manualKey]);

    /**
     * 编辑模式下 hover 节点/路径时切换鼠标指针样式。
     * 当 enableModify 开启且鼠标悬停在 enableSelect 的节点或路径上时，
     * 显示 pointer 光标；其余情况恢复 default。
     */
    const onStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = stageRef.current;
        if (!stage) return;
        const container = stage.container();
        const tip = deviceTooltipRef.current;
        // 设备类型（仅设备图标 data 带 deviceType）
        const deviceType = event.target?.attrs?.data?.deviceType as DeviceIconType | undefined;
        if (!enableModify) {
            container.style.cursor = "default";
            if (tip) tip.style.display = "none";
            return;
        }
        // v2 §4.11：框选同向模式（拓扑/方向）期间十字光标，覆盖 hover pointer/default
        if (manualKey === "brushSelectSameDir" || manualKey === "brushSelectSameAngle") {
            container.style.cursor = "crosshair";
            // 此处提前 return 后不再走下方 tooltip 分支：进入模式前若正 hover 三方设备图标，
            // 陈旧 tooltip 会挂在原地直到模式结束，这里提前隐藏（与 !enableModify 分支同款处理）
            if (tip) tip.style.display = "none";
            return;
        }
        const { attrs } = event.target;
        // 节点/路径/三方设备图标：显示 pointer 手势
        if (attrs?.enableSelect === "node" || attrs?.enableSelect === "edge" || deviceType !== undefined) {
            container.style.cursor = "pointer";
        } else {
            container.style.cursor = "default";
        }
        // hover 三方设备图标时，tooltip 跟随鼠标展示设备类型中文名（直接 DOM 操作，避免高频重渲染）
        if (tip) {
            if (deviceType !== undefined) {
                tip.textContent = deviceTypeLabels[deviceType] ?? "未知设备";
                tip.style.left = `${event.evt.clientX}px`;
                tip.style.top = `${event.evt.clientY}px`;
                tip.style.display = "block";
            } else {
                tip.style.display = "none";
            }
        }
    };

    // 画布鼠标左键的点击事件
    const onStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        console.log("stage被点击了", event)
        event.cancelBubble = true;
        const { target, evt } = event;
        evt.preventDefault();
        if (evt.button === 2) return;
        if (manualKey === "ranging") return;
        // v2 §4.7：框选同向模式（拓扑/方向）期间屏蔽选中变更——基准是进入模式时的快照，
        // 放任点击改选中会出现「高亮 B 边、基准实为 A 边」的脱节；
        // 顺带堵死退化框选（<2px）时 click 派发到 stage 清空选中的破坏路径
        if (manualKey === "brushSelectSameDir" || manualKey === "brushSelectSameAngle") return;
        // 点击三方设备图标时，重定向到其所属路径 Shape，实现「点设备即选中路径」
        // 设备图标 data 带 deviceType/edgeId，路径 Shape 的 Konva id === edge.id（createEdgeShapeConfig）
        let clickTarget = target as Konva.Shape;
        if (target.attrs?.data?.deviceType !== undefined) {
            const edgeShape = target.getStage()?.findOne<Konva.Shape>("#" + String(target.attrs.data.edgeId));
            if (edgeShape) clickTarget = edgeShape;
        }
        const { attrs } = clickTarget;
        if (clickTarget === clickTarget.getStage() && selectShapes?.length && !evt.ctrlKey) {
            setSelectShapes([]);
            unSelectShapeEvent(event);
            return;
        }
        if (attrs?.enableSelect === "node" || attrs?.enableSelect === "edge") {
            // 隐藏的元素不允许被单击选中 / 取消
            if (!clickTarget.isVisible()) return;
            // D6：用 state 作「是否已选中」唯一判据（视觉真相，§2.5）
            const isAlreadySelected = attrs?.state === "selected";
            if (evt.ctrlKey) {
                if (isAlreadySelected) {
                    // Ctrl + 已选中 → 取消选中（本次新增的 toggle）
                    deselectShape(clickTarget);
                    // 按 attrs.id 从数组移除（与 ContextMenu 既有模式一致）
                    setSelectShapes(selected => selected.filter(s => s.attrs?.id !== attrs?.id));
                } else {
                    // Ctrl + 未选中 → 追加（去重由 D12 源头 wrapper 保证）
                    updateShapeStyle(clickTarget);
                    setSelectShapes(selected => [...selected, clickTarget as Konva.Shape]);
                }
            } else {
                // D3：非 Ctrl + 已选中 → 保持现状（原无差别 return 收窄到此分支）
                if (isAlreadySelected) return;
                // 非 Ctrl + 未选中 → 覆盖单选（清其他选中样式 + 设本元素选中）
                unSelectShapeEvent(event);
                updateShapeStyle(clickTarget);
                setSelectShapes([clickTarget as Konva.Shape]);
            }
        }
    };

    // 画布的缩放事件
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
        if (newScaleX >= konvaConfig.maxZoom || newScaleX <= konvaConfig.minZoom) return;
        stage.scale({ x: newScaleX, y: newScaleY });
        const currentMousePoint = {
            x: (pointer.x - stage.x()) / scaleX,
            y: (pointer.y - stage.y()) / scaleY,
        };
        const position = {
            x: pointer.x - currentMousePoint.x * newScaleX,
            y: pointer.y - currentMousePoint.y * newScaleY,
        };
        stage.position({ x: position.x, y: position.y });
    };

    // 节点拖拽开始时保存快照
    const onStageDragStart = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (event.target.attrs?.enableSelect === "node") {
            saveSnapshot();
        }
    };

    // 拖动的目标是节点的时候要更新关联的路径
    const onStageDragMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
        const { target, evt } = event;
        evt.preventDefault();
        if (target.attrs?.enableSelect === "node") {
            const stage = target.getStage();
            if (!evt.altKey) {
                if (stage) {
                    const snapped = computeRightAngleDragSnap(
                        stage,
                        target as Konva.Shape,
                        target.x(),
                        -target.y()
                    );
                    if (snapped) {
                        target.position({ x: snapped.x, y: -snapped.y });
                    }
                }
            }
            onNodeShapeDragMove(event);
            // 节点拖动会改变关联路径的几何，需同步刷新三方设备图标位置/朝向，
            // 否则图标停留在拖动前的快照位置（命令式 attrs 更新不触发 React edges 重建）
            if (stage) {
                refreshDeviceIcons(stage);
                // 同步刷新动作角标位置/数量（D23，与设备 refreshDeviceIcons 同源教训）
                refreshActionBadges(stage, { onActionHover });
            }
        }
    };

    /**
     * 节点拖拽结束。
     * Konva attrs 已在 dragMove 中被 onNodeShapeDragMove 更新，
     * 保存时从 Konva attrs 读取，无需同步到 React state。
     */
    const onStageDragEnd = (event: Konva.KonvaEventObject<MouseEvent>) => {
        const { target } = event;
        if (target.attrs?.enableSelect !== "node") return;
    };

    // stage的右键事件
    const onStageContextMenu = (event: Konva.KonvaEventObject<MouseEvent>) => {
        console.log("stage的右键事件", event)
        event.cancelBubble = true;
        const { evt } = event;
        evt.preventDefault();
        if (evt.button === 0) return;
        /**
         * 框选同向两种模式（brushSelectSameDir / brushSelectSameAngle，split §2）都是一次性模式，
         * 右键 = 任务转向 → 静默退出模式但照常弹出菜单（不 return）：
         * 避免"首次右键退出、第二次才出菜单"，且菜单里两个入口仍可点——
         * 基准选中态未变，点它等于重新进入，无副作用。
         */
        if (manualKey === "brushSelectSameDir" || manualKey === "brushSelectSameAngle") {
            setManualKey("");
        } else if (
            /**
             * 框选系列常驻模式（brushSelect / brushSelectNode / brushSelectEdge）右键直接打开菜单，
             * 不退出模式、不 return：框选是 mousedown→mouseup 的瞬时操作，没有"进行中"的中间态
             * 需要取消，保持模式可让用户在删除/分组后继续框选。
             * 其余模式（画线、加节点、测距、平移、复制、对齐等）维持原行为——右键先退出模式。
             */
            manualKey &&
            !["brushSelect", "brushSelectNode", "brushSelectEdge"].includes(manualKey)
        ) {
            if (["forwardLine", "reverseLine", "forwardBezier", "reverseBezier"].includes(manualKey)) {
                setNodeDraggable(stageRef.current);
            }
            setManualKey("");
            return;
        }
        /**
         * 右键瞬间计算「附近元素」候选（SPEC §5.6）。
         * 此时鼠标仍在右键位置，getPointerPosition() 准确；Dropdown 打开后
         * 鼠标移走会让 getPointerPosition 失真，故在事件触发瞬间算好并暂存入 state。
         */
        const stage = stageRef.current;
        let nearbyCandidates: NearbyCandidate[] = [];
        if (stage) {
            const pointer = stage.getPointerPosition();
            if (pointer) {
                nearbyCandidates = findNearbyEdges(stage, pointer.x, pointer.y);
            }
        }
        setContextMenu({
            open: true,
            left: evt.clientX,
            top: evt.clientY,
            event,
            nearbyCandidates
        });
    };

    /**
     * 地图切换时重置画布视角
     * 仅处理 scale、rotation、position 等非数据逻辑
     */
    useEffect(() => {
        if (!useMapId) return;
        if (stageRef.current) {
            setStage(stageRef.current);
            stageRef.current.scale({ x: 50, y: 50 });
            const cachedDegree = getRotateCache()[useMapId] ?? 0;
            stageRef.current.rotation(degToRad(cachedDegree));
            stageRef.current.position({ x: stageSize.width / 2, y: stageSize.height / 2 });
            /**
             * 地图切换时重置 visualScale 相关状态
             */
            visualScaleRef.current = 1;
            stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.visualScale, 1);
            stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.labelVisible, {
                node: overlayVisible.nodeLabel,
                edge: overlayVisible.edgeLabel,
            });
            /**
             * 地图切换时同步写入路径属性着色初始 attr（SPEC edge_attribute_color_toggle）。
             * 与 labelVisible 同处重置块，确保新地图首次绘制即按当前着色开关渲染。
             */
            stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible, {
                loadSecurity: overlayVisible.loadSecurityColor,
                freeSecurity: overlayVisible.freeSecurityColor,
                allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
            });
            setVisualScaleForReact(1);
        }
    }, [useMapId])

    /**
     * 版本数据加载入口
     * 当 useMapVersionId 变化时，调用 getMapInfoVersion 获取版本数据并更新画布
     * 统一替代原有的 getMapInfo 数据加载逻辑
     */
    useEffect(() => {
        if (!useMapVersionId) return;
        setSpinning(true);
        getMapInfoVersion({ mapVersionId: useMapVersionId }).then((res: any) => {
            if (res.code === 200 && res.message === "success" && res.data) {
                const mapJson = res.data.mapJson;
                if (mapJson) {
                    const { nodes, edges, nodeEdgeGroups } = mapJson;
                    setNodes(nodes);
                    setEdges(edges);
                    setTrafficGroups(
                        nodeEdgeGroups.filter((group: NodeEdgeGroup) => group?.userDefinedProperties?.nodeEdgeGroupType === "TRIPARTITE_TRAFFIC")
                    );
                    setExclusiveGroups(
                        nodeEdgeGroups.filter((group: NodeEdgeGroup) => group?.userDefinedProperties?.nodeEdgeGroupType === "SINGLE_VEHICLE")
                    );
                    // 首次加载版本数据时，同时加载地图元数据（用于面板显示楼层、状态等）
                    if (useMapId) {
                        getMapInfo({ mapId: useMapId }).then(mapRes => {
                            if (mapRes.code === 200 && mapRes.message === "success" && mapRes.data) {
                                setMapInfo(mapRes.data);
                            }
                        });
                    }
                    /**
                     * 地图数据加载完成，更新时间戳
                     * 通知 GraphPixel 等依赖 stage 数据的组件刷新
                     */
                    setMapLoadedAt(Date.now());
                }
            } else {
                message.warning(t("加载版本数据失败") + res?.message);
            }
            setSpinning(false);
        }).catch(err => {
            if (err) {
                setSpinning(false);
                message.error(t("加载版本数据失败") + err?.message);
            }
        });
    }, [useMapVersionId])

    useEffect(() => {
        // 退出时销毁实例
        return () => {
            stageRef.current?.destroy();
        }
    }, [])

    return (
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
                preventDefault={true}
                draggable={!["brushSelect", "brushSelectNode", "brushSelectEdge", "brushSelectSameDir", "brushSelectSameAngle", "ranging", "forwardLine", "reverseLine", "forwardBezier", "reverseBezier"].includes(manualKey)}
                listening={enableModify}
                onWheel={onStageWheel}
                onMouseMove={onStageMouseMove}
                onClick={onStageClick}
                onContextMenu={enableModify ? onStageContextMenu : e => e.evt.preventDefault()}
                onDragStart={onStageDragStart}
                onDragMove={onStageDragMove}
                onDragEnd={onStageDragEnd}
            >
                {/* 网格图层放在最底层，用于辅助距离观测 */}
                <GridLayer
                    visible={overlayVisible.grid}
                    gridSpacing={gridSpacing}
                />
                <AreaLayer />
                {
                    !spinning && <EdgesLayer
                        edges={edges}
                    />
                }
                {/* 三方设备图标层：挂载于 EdgesLayer 之后、NodesLayer 之前 */}
                {
                    !spinning && <DeviceLayer
                        edges={edges}
                        visible={overlayVisible.device}
                        visualScale={visualScaleForReact}
                        isDark={isDark}
                        selectShapes={selectShapes}
                    />
                }
                {/* 动作角标层：挂载于 DeviceLayer 之后、NodesLayer 之前 */}
                {
                    !spinning && <ActionBadgeLayer
                        nodes={nodes}
                        edges={edges}
                        visible={overlayVisible.actions}
                        visualScale={visualScaleForReact}
                        isDark={isDark}
                        selectShapes={selectShapes}
                        onActionHover={onActionHover}
                    />
                }
                {
                    !spinning && <AnglesLayer
                        nodes={nodes}
                        edges={edges}
                        visible={overlayVisible.angle}
                        manualKey={manualKey}
                        visualScale={visualScaleForReact}
                    />
                }
                {
                    !spinning && <NodesLayer
                        nodes={nodes}
                    />
                }
                {/**
                  * ActionLayer 必须挂在 NodesLayer 之后（节点之上）：
                  * 层内的控制点/Transformer/框选框是编辑操作元素，Konva 命中取最上层图形，
                  * 若被节点压住，控制点与节点重叠时 mousedown 会命中节点（拖走的变成节点），
                  * 表现为"控制点拖不动、节点乱晃"。上移后为不拦截节点命中，
                  * 层内纯展示图形（控制辅助线、加边/加点预览）必须保持 listening=false。
                  */}
                {
                    !spinning && (
                        <ActionLayer
                            stage={stageRef.current}
                            useMapId={useMapId}
                            manualKey={manualKey}
                            selectShapes={selectShapes}
                            enableModify={enableModify}
                            visualScale={visualScaleForReact}
                            setSelectShapes={setSelectShapes}
                            setManualKey={setManualKey}
                        />
                    )
                }
                {
                    !spinning && <RobotLayer
                        useMapId={useMapId}
                        visible={overlayVisible.robot}
                    />
                }
            </Stage>
            {/* 三方设备图标 hover 提示：跟随鼠标展示设备类型中文名 */}
            <div
                ref={deviceTooltipRef}
                style={{
                    position: "fixed",
                    display: "none",
                    padding: "4px 8px",
                    background: "rgba(0, 0, 0, 0.75)",
                    color: "#fff",
                    fontSize: 12,
                    borderRadius: 4,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    zIndex: 1000,
                    transform: "translate(12px, -50%)",
                }}
            />
            {/* 动作角标 hover 详情浮层（每动作一卡，贴锚点定位，D9-D11） */}
            <ActionTooltip data={actionHover} isDark={isDark} />
        </Spin>
    )
};
