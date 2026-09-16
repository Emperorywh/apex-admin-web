/**
 * @description 按给定画布世界坐标与类型创建一个孤立节点（不连边）
 *              供"根据车体建站"两处入口与"等距插入节点"复用（决策 14：建点函数通用化）
 * @date 2026-6-15
 *
 * 约定：
 * - 坐标 (x, y) 一律为画布世界坐标（米），与节点 shape.x()/y() 同空间，绝不混入后端 y。
 * - angle=null、不设置有效 arrowPoints ⇒ 不画方向箭头。
 * - 仅创建孤立节点，不连边；命名沿用 nextNameByShapes 自增规则。
 * - 不在此处 saveSnapshot / 判重 / 弹提示，由调用方按各自流程处理。
 * - 节点类型由调用方传入 type 决定样式（nodeStyles[type]）与数据 type。
 */
import Konva from "konva";
import { defaultNodeProperty } from "@/plugins/konva/nodes/defaultProperty";
import { nodeStyles } from "@/plugins/konva/nodes";
import type { NodeType } from "@/plugins/konva/nodes";
import { nextNameByShapes } from "@/utils/graph";
import { getRandomString } from "@/utils/public";
import { nodeSceneFunc, nodeHitFunc } from "@/plugins/konva/shapeFuncs/nodeSceneFunc";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";

/**
 * @param stage 画布舞台
 * @param useMapId 当前地图 id
 * @param x 落点画布世界坐标 x（米）
 * @param y 落点画布世界坐标 y（米）
 * @param type 节点类型（node/work/shelf/warehouse_font/warehouse_back/park/charge）
 * @returns 创建成功的节点 Shape；若 stage / nodesLayer 不存在则返回 undefined
 */
export const createNodeShape = (
    stage: Konva.Stage | null | undefined,
    useMapId: string,
    x: number,
    y: number,
    type: NodeType
): Konva.Shape | undefined => {
    if (!stage) return;
    // 读取自适应视觉倍率，按比例缩放半径与线宽
    const visualScale = stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    // 关键改动：按传入 type 取样式（原实现硬编码 nodeStyles["work"]）
    const { radius, fill, stroke, lineWidth, labelFill } = nodeStyles[type];
    const style = {
        radius: radius * visualScale,
        fill,
        stroke,
        lineWidth: lineWidth * visualScale,
        labelFill
    };
    // 按现有节点名称补缺自增
    const shapes: Konva.Shape[] = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "node") || [];
    const nextName = nextNameByShapes(shapes);
    const data = {
        ...defaultNodeProperty,
        id: getRandomString(),
        name: nextName,
        type,                  // 关键改动：使用传入类型（原硬编码 "work"）
        mapId: useMapId,
        angle: null,           // 无方向
        arrowPoints: undefined // angle=null ⇒ 不画箭头
    };
    // 新节点统一挂到 nodesLayer，不依赖调用方传入的 layer
    const nodesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.nodes}`) as Konva.Layer | undefined;
    if (!nodesLayer) return;
    const shape = new Konva.Shape({
        id: data.id,
        x,
        y,
        visible: true,
        draggable: true,
        enableSelect: "node",
        shapeStyle: style,
        data,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        hitFunc: nodeHitFunc,
        sceneFunc: nodeSceneFunc
    });
    nodesLayer.add(shape);
    // 命令式新增节点后主动重绘，确保立即可见
    nodesLayer.batchDraw();
    return shape;
};
