/**
 * @description 添加节点的组件
 * @date 2025-7-14
 */
import { useEffect, useRef, memo } from "react";
import { Shape } from "react-konva";
import Konva from "konva";
import { getNodeStyle } from "@/plugins/konva/nodes";
import type { MapNode, MountNode } from "@/utils/typing";
import { getRandomString } from "@/utils/public";
import { defaultNodeProperty } from "@/plugins/konva/nodes/defaultProperty";
import { nextNameByShapes, computeRotateArrow } from "@/utils/graph";
import { saveSnapshot } from "@/utils/undoHistory";
import { screenToWorld } from "@/utils/bindStage";
import { nodeSceneFunc, nodeHitFunc } from "@/plugins/konva/shapeFuncs/nodeSceneFunc";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";

interface AddNodeProps {
    stage: Konva.Stage | null;
    useMapId: string;
    manualKey: string;
    /** 自适应视觉倍率（来源于 visualScaleForReact，用于触发预览 attrs 重算的 useEffect） */
    visualScale: number;
}

export default memo((props: AddNodeProps) => {

    const { stage, useMapId, manualKey, visualScale } = props;

    // 跟随鼠标的shape
    const shapeRef = useRef<Konva.Shape>(null);
    // 当前模式的ref
    const manualKeyRef = useRef<string>("");

    // 鼠标移动的事件
    const onStageMouseMove = () => {
        if (!stage) return;
        if (!["node", "work", "warehouse", "park", "charge"].includes(manualKeyRef.current)) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldPos = screenToWorld(pointer.x, pointer.y, stage);
        shapeRef.current?.setAttrs({
            x: worldPos.x,
            y: worldPos.y
        });
    };

    // 点击添加一个节点，更新名字和id
    const onStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!stage || event.evt.button === 2) return;
        if (!["node", "work", "warehouse", "park", "charge"].includes(manualKeyRef.current)) return;
        saveSnapshot();
        const attrs = shapeRef.current?.attrs;
        /**
         * 新节点必须挂到 nodesLayer，不能依赖 target.getLayer()，
         * 否则节点会落入 ActionLayer 而非 nodesLayer，
         * 导致 applyVisualScaleToAllShapes 无法更新它。
         */
        const nodesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.nodes}`) as Konva.Layer | undefined;
        const layer = nodesLayer || event.target.getLayer();
        const shape = new Konva.Shape({
            ...attrs,
            /**
             * 预览 Shape 为不拦截命中已设 listening=false，attrs 整体展开会把它带进新节点，
             * 必须显式还原——否则新节点不参与命中（无法选中/拖拽/右键），
             * 画边按下它时 target 不是节点，会落入 AddEdge 的 isPanning 分支变成拖动画布。
             */
            listening: true,
            hitFunc: nodeHitFunc,
            sceneFunc: nodeSceneFunc,
            draggable: true,
            enableSelect: "node"
        });
        layer?.add(shape);
        // 准备节点的名称
        const shapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node") || [];
        const nextName = nextNameByShapes(shapes);
        shapeRef.current?.setAttrs({
            id: getRandomString(),
            data: {
                ...(attrs?.data || {}),
                name: nextName
            }
        });
    };

    useEffect(() => {
        manualKeyRef.current = manualKey;
    }, [manualKey])

    useEffect(() => {
        if (!stage) return;
        stage.on("mousemove.mapNestAddNode", onStageMouseMove);
        stage.on("click.mapNestAddNode", onStageClick);
        return () => {
            stage.off("mousemove.mapNestAddNode", onStageMouseMove);
            stage.off("click.mapNestAddNode", onStageClick);
        }
    }, [])

    // 根据当前要创建的目标准备shape的属性
    useEffect(() => {
        if (!["node", "work", "warehouse", "park", "charge"].includes(manualKey)) return;
        const type = manualKey as MapNode["type"];
        const id = getRandomString();
        const { radius, showArrow, fill, stroke, lineWidth, labelFill } = getNodeStyle(type);
        const scaledRadius = radius * visualScale;
        const scaledLineWidth = lineWidth * visualScale;
        const { angle: defaultAngle } = defaultNodeProperty;
        const arrowPoints = showArrow && defaultAngle !== null ? computeRotateArrow(scaledRadius, -defaultAngle) : undefined;
        const shapeStyle: MountNode["shapeStyle"] = {
            radius: scaledRadius,
            fill,
            stroke,
            lineWidth: scaledLineWidth,
            labelFill
        };
        const shapes: Konva.Shape[] = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node") || [];
        const nextName = nextNameByShapes(shapes);
        shapeRef.current?.setAttrs({
            id,
            shapeStyle,
            data: {
                ...defaultNodeProperty,
                id,
                name: nextName,
                type,
                mapId: useMapId,
                arrowPoints,
                /**
                 * 是否可解锁的领域默认值按节点类型区分：
                 * 充电站点/库区站点默认不可解锁（false），其余类型默认可解锁（true）。
                 * 创建时显式落值，保证属性面板回显与保存地图的数据一致，
                 * 不依赖 VirtualAvoidStation 回显组件的兜底值。
                 */
                enableVirtualAvoidStation: !["charge", "warehouse"].includes(type)
            }
        });
    }, [manualKey, useMapId, visualScale])

    return (
        <Shape
            ref={shapeRef}
            visible={["node", "work", "warehouse", "park", "charge"].includes(manualKey)}
            id="addNode"
            /**
             * 预览节点仅作展示，必须关闭监听：
             * ActionLayer 已上移到节点之上，而预览始终跟随指针，
             * 若可监听会拦截指针处一切命中（悬停已有节点不再 pointer、落点事件目标改变）。
             * 放置逻辑全部走 stage 级 click/mousemove 监听，不依赖预览命中。
             */
            listening={false}
            shapeStyle={{
                radius: 0,
                fill: "",
                stroke: "",
                lineWidth: 10,
                labelFill: ""
            }}
            data={{
                name: ""
            }}
            state=""
            x={0}
            y={0}
            forceShowLabel={true}
            hitFunc={nodeHitFunc}
            sceneFunc={nodeSceneFunc}
        />
    )
});
