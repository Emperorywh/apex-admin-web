/**
 * @description 路径夹角层：在每个节点上画相邻 edge 间的夹角
 *              90° 显示直角符号 "┐"，其余角度画一段圆弧 + 度数文字
 * @date 2026-04-27
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Shape } from "react-konva";
import type Konva from "konva";
import { buildAngleMarks } from "@/utils/angle";
import type { AngleEdgeLike, AngleNodeLike, AngleMark } from "@/utils/angle";
import type { MapEdge, MapNode } from "@/utils/typing";

interface AnglesLayerProps {
    nodes: MapNode[];
    edges: MapEdge[];
    visible: boolean;
    /**
     * GraphStage 当前所处的"手动模式"。仅当处于 AddEdge 系列时才需要监听 stage.mousemove，
     * 因为引导线（addEdgePreview）只在这些模式下存在并随鼠标移动。
     * 其它情况下挂 mousemove 是常驻空转。
     */
    manualKey: string;
    /** 自适应视觉倍率 */
    visualScale: number;
}

/** AddEdge 系列模式：引导线随鼠标移动，需要 mousemove 实时刷新角度 */
const ADD_EDGE_MANUAL_KEYS = new Set<string>([
    "forwardLine",
    "reverseLine",
    "forwardBezier",
    "reverseBezier"
]);

/**
 * 对齐 / 平移 / 复制等"在 React 之外直接 setAttrs 改 Konva 节点"的工具
 * 不会触发 dragmove / mousemove，需要在改完之后主动 stage.fire 这个自定义事件，
 * AnglesLayer 才能感知到几何变化并重算夹角标记。
 */
const ANGLES_REFRESH_EVENT = "angles:refresh";

const ARC_RADIUS = 0.4;
const RIGHT_ANGLE_SIZE = 0.28;
const RIGHT_ANGLE_TOLERANCE_DEG = 0.1;
const STROKE = "#FF6B00";
const TEXT_FILL = "#FF6B00";
const LINE_WIDTH = 0.04;
const TEXT_FONT = "bold 0.22px Arial";
const TEXT_OFFSET = 0.28;

/**
 * @description AddEdge 组件预览线的 Shape id（节点上正在拖拽尚未落点的引导线）
 * 通过这个 id 在 stage 上找到引导线，构造一条临时的"预览 edge"参与夹角计算，
 * 实现绘制过程中起点节点处实时显示夹角。
 */
const PREVIEW_EDGE_SHAPE_ID = "addEdgePreview";
/** 预览 edge 在夹角计算里的占位 id（不会被持久化，仅用于内部去重 / mark key） */
const PREVIEW_EDGE_VIRTUAL_ID = "__addEdgePreview__";

/**
 * @description 从 Konva stage 实时收集节点 / edge 的几何数据
 * - 节点：NodesLayer 把 (x, -y) 写到 Konva 上，所以 y 取负还原为地图坐标
 * - edge：attrs.data 里就是地图坐标，直接用
 *
 * id 取 shape 自身的 attrs.id（每条 edge 在挂载时一定会写入），
 * 而不是 attrs.data.id —— mountGraphEdges 在拆解 edge 时把 id 从 data 里
 * 解构出去了，导致 React 渲染的 edge 上 data.id 为 undefined；如果按 data.id
 * 过滤，正常路径会被全部过滤掉，再叠加 AddEdge 直接 layer.add 进来的"含 data.id"
 * 的新边，就会出现"加完一条边，地图上其它角度全消失"的现象。
 */
const collectFromStage = (stage: Konva.Stage): { nodes: AngleNodeLike[]; edges: AngleEdgeLike[] } => {
    const edgeShapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge");
    const nodeShapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "node");
    const nodes: AngleNodeLike[] = nodeShapes.map((s: Konva.Shape) => ({
        id: s.attrs?.id,
        x: s.x(),
        y: -s.y()
    }));
    const edges: AngleEdgeLike[] = [];
    edgeShapes.forEach((s: Konva.Shape) => {
        const data = s.attrs?.data;
        const id = s.attrs?.id;
        if (!data || typeof id !== "string" || !id) return;
        edges.push({
            id,
            sx: data.sx,
            sy: data.sy,
            cx: data.cx ?? null,
            cy: data.cy ?? null,
            dx: data.dx ?? null,
            dy: data.dy ?? null,
            ex: data.ex,
            ey: data.ey,
            snodeId: data.snodeId,
            enodeId: data.enodeId
        });
    });

    /**
     * AddEdge 的引导线一旦从某个节点拉出（mousedown 命中节点 → 持续 mousemove），
     * 就把它当作一条临时的"虚拟 edge"加入计算：
     * - snodeId = 起点节点 id（AddEdge 用 setAttrs 写到引导线上）
     * - enodeId = ""（还没落点，不参与终点节点的夹角）
     * - 坐标系：引导线 attrs.points 用的是 canvas y 朝下，转回地图坐标需要 y 取负
     * 这样起点节点上"已有 edge ↔ 引导线"之间的夹角就能在拖拽过程中实时显示。
     */
    const previewShape = stage.findOne(`#${PREVIEW_EDGE_SHAPE_ID}`);
    if (previewShape) {
        const points = previewShape.attrs?.points;
        const previewSnodeId = previewShape.attrs?.snodeId;
        if (Array.isArray(points) && points.length === 4 && typeof previewSnodeId === "string" && previewSnodeId) {
            const [sxC, syC, exC, eyC] = points;
            edges.push({
                id: PREVIEW_EDGE_VIRTUAL_ID,
                sx: sxC,
                sy: -syC,
                cx: null,
                cy: null,
                dx: null,
                dy: null,
                ex: exC,
                ey: -eyC,
                snodeId: previewSnodeId,
                enodeId: ""
            });
        }
    }

    return { nodes, edges };
};

export default memo((props: AnglesLayerProps) => {

    const { nodes, edges, visible, manualKey, visualScale } = props;

    // 角度层渲染常量受自适应视觉倍率影响
    const arcRadius = ARC_RADIUS * visualScale;
    const rightAngleSize = RIGHT_ANGLE_SIZE * visualScale;
    const lineWidth = LINE_WIDTH * visualScale;
    const textFont = `bold ${0.22 * visualScale}px Arial`;
    const textOffset = TEXT_OFFSET * visualScale;

    const layerRef = useRef<Konva.Layer>(null);
    /**
     * 仅用于在 Konva 内部状态变化（节点拖拽、控制点拖拽、AddEdge 新增边等）
     * 不触发 React re-render 时强制重算 marks。不存储任何业务数据，只是个 tick。
     */
    const [tick, setTick] = useState<number>(0);
    /**
     * requestAnimationFrame id，用于把同一帧内的多次刷新合并成一次 setState，
     * 避免 mousemove 这种高频事件每次都触发 React 渲染。
     */
    const rafIdRef = useRef<number>(0);

    /**
     * 调度一次重算：在下一帧把 tick + 1。
     * 任意 mousemove / dragmove 都会调用，但每一帧最多只触发一次 setState。
     */
    const scheduleUpdate = () => {
        if (rafIdRef.current) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            setTick(t => t + 1);
        });
    };

    /**
     * 计算夹角标记。
     * stage 挂载后一律以 stage 实时几何为准：运行时的拖拽 / 新增 / 删除 / 对齐 / 平移
     * 都是命令式 setAttrs 或 destroy，nodes/edges props 只反映地图初始加载、不会随之更新，
     * 只有 stage 才是当前真相。仅在首次渲染（layerRef 尚未绑定、读不到 stage）时退回 props，
     * 让夹角与节点 / 路径同帧出现，避免一帧空白闪烁。
     *
     * 不能再用"必须同时有节点和边（&&）才用 stage、否则退回 props"的兜底：删除导致某类图形
     * 为空时退回 props，会拿初始加载的旧数据把"已删节点 / 路径"的夹角重新画出来 —— 这正是
     * "删了节点和路径，夹角还在"的根因。buildAngleMarks 本身已对空输入安全返回 []，
     * 所以"删到只剩节点或只剩边"时直接信任 stage 即可正确清空夹角。
     */
    const marks: AngleMark[] = useMemo(() => {
        if (!visible) return [];
        const stage = layerRef.current?.getStage();
        if (stage) {
            const live = collectFromStage(stage);
            return buildAngleMarks(live.nodes, live.edges);
        }
        return buildAngleMarks(
            nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
            edges.map(e => ({
                id: e.id,
                sx: e.sx, sy: e.sy,
                cx: e.cx, cy: e.cy,
                dx: e.dx, dy: e.dy,
                ex: e.ex, ey: e.ey,
                snodeId: e.snodeId,
                enodeId: e.enodeId
            }))
        );
    }, [nodes, edges, visible, tick]);

    /**
     * 监听 stage 上的事件，触发重算。
     * - dragmove / dragend：节点 / 控制点拖拽时 attrs 会被修改但不触发 React re-render；
     *                      只有真正按住拖拽时才高频，平时静默，永久挂载即可。
     * - mousemove / mouseup：仅 AddEdge 系列模式下才挂载。
     *                       AddEdge 走的是 stage mousemove（不会触发 Konva drag 事件），
     *                       需要靠 mousemove 实时驱动起点节点的夹角刷新；mouseup 兜底取最新数据。
     *                       非 AddEdge 模式下挂 mousemove 会让用户每一次空闲移动鼠标都触发
     *                       全树 stage.find + setState + useMemo 重算，是常驻空转开销。
     * 所有事件经过 rAF 合流，单帧最多一次 setState。
     */
    useEffect(() => {
        if (!visible) return;
        const stage = layerRef.current?.getStage();
        if (!stage) return;
        stage.on("dragmove.angleslayer", scheduleUpdate);
        stage.on("dragend.angleslayer", scheduleUpdate);
        // 对齐 / 平移等静默 setAttrs 流程结束后，调用方会 stage.fire(ANGLES_REFRESH_EVENT)
        // 触发一次重算，弥补 Konva drag 事件路径覆盖不到的几何变更
        stage.on(`${ANGLES_REFRESH_EVENT}.angleslayer`, scheduleUpdate);
        const isAddingEdge = ADD_EDGE_MANUAL_KEYS.has(manualKey);
        if (isAddingEdge) {
            stage.on("mousemove.angleslayer", scheduleUpdate);
            stage.on("mouseup.angleslayer", scheduleUpdate);
        }
        // 挂载 / 模式切换时主动触发一次：
        //   - 首次挂载：让 useMemo 从 props 数据切到 stage 实时数据
        //   - 进入 AddEdge：让起点节点已有边的夹角立即可见
        //   - 退出 AddEdge：让残留的引导线虚拟边及时从 marks 中消失
        scheduleUpdate();
        return () => {
            stage.off("dragmove.angleslayer");
            stage.off("dragend.angleslayer");
            stage.off("mousemove.angleslayer");
            stage.off("mouseup.angleslayer");
            stage.off(`${ANGLES_REFRESH_EVENT}.angleslayer`);
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = 0;
            }
        };
    }, [visible, manualKey]);

    if (!visible) return null;

    return (
        <Layer ref={layerRef} listening={false}>
            {
                marks.map((mark: AngleMark) => {
                    const isRight = Math.abs(mark.degree - 90) < RIGHT_ANGLE_TOLERANCE_DEG;
                    const key = `${mark.nodeId}-${mark.edgeIdA}-${mark.edgeIdB}`;
                    return (
                        <Shape
                            key={key}
                            listening={false}
                            perfectDrawEnabled={false}
                            shadowForStrokeEnabled={false}
                            sceneFunc={(context, shape) => {
                                const { nodeX, nodeY, angleA, sweep, degree } = mark;
                                /**
                                 * 渲染坐标系是 Canvas（y 向下），地图坐标系 y 向上，
                                 * 所以 y 取负，方向向量也跟着取负 sin。
                                 */
                                const cx = nodeX;
                                const cy = -nodeY;

                                if (isRight) {
                                    /**
                                     * 直角符号：沿 angleA 方向走一个边长，再沿 angleB 方向走一个边长，
                                     * 形成一个开口朝节点方向的"┐"。
                                     */
                                    const aB = angleA + sweep;
                                    const sz = rightAngleSize;
                                    const p1x = cx + Math.cos(angleA) * sz;
                                    const p1y = cy + (-Math.sin(angleA)) * sz;
                                    const cornerX = cx + (Math.cos(angleA) + Math.cos(aB)) * sz;
                                    const cornerY = cy + (-Math.sin(angleA) - Math.sin(aB)) * sz;
                                    const p2x = cx + Math.cos(aB) * sz;
                                    const p2y = cy + (-Math.sin(aB)) * sz;
                                    context.beginPath();
                                    context.moveTo(p1x, p1y);
                                    context.lineTo(cornerX, cornerY);
                                    context.lineTo(p2x, p2y);
                                    context.strokeStyle = STROKE;
                                    context.lineWidth = lineWidth;
                                    context.stroke();
                                } else {
                                    /**
                                     * 圆弧：地图角 [angleA, angleA + sweep] 对应 canvas 角 [-angleA, -angleA - sweep]
                                     * 视觉 CCW = canvas 数学 CCW = anticlockwise=true（角度递减）
                                     */
                                    context.beginPath();
                                    context.arc(
                                        cx, cy, arcRadius,
                                        -angleA,
                                        -angleA - sweep,
                                        true
                                    );
                                    context.strokeStyle = STROKE;
                                    context.lineWidth = lineWidth;
                                    context.stroke();
                                }

                                const bisector = angleA + sweep / 2;
                                const textR = arcRadius + textOffset;
                                const textX = cx + Math.cos(bisector) * textR;
                                const textY = cy + (-Math.sin(bisector)) * textR;
                                const text = isRight ? "90°" : `${degree.toFixed(1)}°`;
                                context.font = textFont;
                                context.fillStyle = TEXT_FILL;
                                context.textAlign = "center";
                                context.textBaseline = "middle";
                                context.fillText(text, textX, textY);

                                context.fillStrokeShape(shape);
                            }}
                        />
                    );
                })
            }
        </Layer>
    );
});
