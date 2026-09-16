/**
 * @description 直线边（LINE）的命令式创建函数 + 等距插入自动连线的两个辅助工具
 *              供"等距插入节点"弹窗（EvenlyInsertModal）在等距建点后自动连边复用，
 *              与 createNodeShape.ts 对称：后者负责命令式建孤立节点，本文件负责命令式建直线边。
 * @date 2026-7-30
 *
 * 约定（与 createNodeShape / onAddReverseEdge / AddEdge 全库一致）：
 * - 坐标符号（关键陷阱，见 SPEC §2.3）：
 *     · from / to 用画布世界坐标（米，正 y 向下），与 node shape.x()/y() 同空间；
 *     · data.sy / data.ey 存「后端坐标 = −画布 y」，sx / ex 不取反；
 *     · arrowPoints / labelX / labelY 一律用「画布正 y」计算与存储。
 *   即 data.sy = -from.y()，但 computeLineArrowPoints([from.x(), from.y(), ...]) 用正 y，两套符号不可混用。
 * - 标签锚点 t = 1/3（SPEC §2.4 / D17）：computeLinePoint 默认 t=1/3，
 *   与 AddEdge / onAddReverseEdge / refreshDeviceLayer（设备图标锚点，永远按 t=1/3 重算、不读 labelX/labelY）三处同口径。
 *   若改传 1/2，名称标签/动作角标（锚 labelX/labelY）会与设备图标（t=1/3）纵向错位。
 * - 属性继承白名单（SPEC §4.3）：inheritedProps 只接受「标量偏好 12 字段」+「实例绑定 2 字段」子集，
 *   几何/拓扑字段（id/name/sx/sy/.../reverseEdgeId/edgeType/...）一律逐条重建、绝不继承。
 *   刻意显式 pick 而非整体展开旧 data：防止 reverseEdgeId 等拓扑字段漏入新边
 *   （reverseEdgeId 前端无消费方，但保存时随 EnableModify 的 ...rest 提交后端，继承它会把指向已销毁旧边的悬空 id 写库）。
 * - 与 createNodeShape 对称：不在此处 saveSnapshot / 判重 / 弹提示，由调用方按各自流程处理。
 * - 命名：nextNameByShapes 基于 stage 当前所有 edge 自增（SPEC D16）。
 */
import Konva from "konva";
import type { MapEdge, LinePoint } from "@/utils/typing";
import { defaultPathProperty } from "@/plugins/konva/path/defaultPathProperty";
import { forwardPath } from "@/plugins/konva/path/forwardPath";
import { reversePath } from "@/plugins/konva/path/reversePath";
import { nextNameByShapes } from "@/utils/graph";
import { getRandomString } from "@/utils/public";
import { computeLineArrowPoints, computeLinePoint } from "@/utils/math";
import { edgeSceneFunc, edgeHitFunc } from "@/plugins/konva/path/edgeDrawFuncs";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";

/**
 * 从旧边 data 显式提取「标量偏好」白名单字段（SPEC §4.3-a）。
 *
 * 刻意显式 pick 而非整体展开旧 data：防止 reverseEdgeId 等拓扑字段漏入新边
 * （reverseEdgeId 前端无消费方，但保存时随 EnableModify 的 ...rest 提交后端，
 *  继承它会把指向已销毁旧边的悬空 id 写库）。
 *
 * undefined 值被剔除：避免旧数据缺字段时把 defaultPathProperty 的有效默认
 * （如 maxFreeSpeed=1）冲掉（与 onAddReverseEdge 的 `loadType ?? 0` 同理）。
 * 注意：null 是有效值（如 allowVehicleGroup=null）应保留，仅剔除 undefined。
 *
 * forward_avoid / reverse_avoid 原样继承、不随方向翻转互换——与 onAddReverseEdge 的处理一致。
 *
 * @param data 旧边的 data 字段
 * @returns 仅含白名单标量字段的局部对象，可直接并入新边 data
 */
export const pickEdgeBusinessProps = (data: MapEdge): Partial<MapEdge> => {
    const picked: Partial<MapEdge> = {
        loadType: data.loadType,
        allowVehicleGroup: data.allowVehicleGroup,
        avoidMap: data.avoidMap,
        forward_avoid: data.forward_avoid,
        reverse_avoid: data.reverse_avoid,
        limitV: data.limitV,
        cost: data.cost,
        enableLimitForkLiftReturn: data.enableLimitForkLiftReturn,
        maxFreeSpeed: data.maxFreeSpeed,
        maxLoadSpeed: data.maxLoadSpeed,
        sfacing: data.sfacing,
        efacing: data.efacing
    };
    // 过滤掉值为 undefined 的字段：旧数据缺字段时不冲掉 defaultPathProperty 的有效默认
    return Object.fromEntries(
        Object.entries(picked).filter(([, v]) => v !== undefined)
    ) as Partial<MapEdge>;
};

/**
 * 返回链上「中点距 (labelX, labelY) 最近」的段索引（并列取靠前段，SPEC §4.6 / D21）。
 *
 * 锚点与段中点同为画布坐标（旧边 labelX/labelY 存的就是画布正 y，SPEC §2.3），空间一致。
 * 对贝塞尔旧边同样成立：其 labelX/labelY 是曲线标签点，最近段即配置应归属的段。
 *
 * @param labelX 旧边标签 x（画布坐标）
 * @param labelY 旧边标签 y（画布坐标，正 y）
 * @param chain  节点链序列 [A, ...新点们, B]，各元素为 node shape
 * @returns 锚点归属段在 chain 中的起始索引（0 ~ chain.length-2）
 */
export const findAnchorSegmentIndex = (
    labelX: number,
    labelY: number,
    chain: Konva.Shape[]
): number => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < chain.length - 1; i++) {
        // 段中点（画布坐标）
        const mx = (chain[i].x() + chain[i + 1].x()) / 2;
        const my = (chain[i].y() + chain[i + 1].y()) / 2;
        const dist = (mx - labelX) ** 2 + (my - labelY) ** 2;
        if (dist < bestDist) {
            bestDist = dist;
            best = i;
        }
    }
    return best;
};

/**
 * 点到线段的最近欧氏距离（画布世界坐标，SPEC §4.11-d / B14）。
 *
 * 与 findAnchorSegmentIndex 同为「点→线段最近」族几何：后者返回链上最近段的索引，
 * 本函数返回点 (px,py) 到线段 (ax,ay)-(bx,by) 的最小欧氏距离。态二链路等距化用它
 * 在原路径边中找「段中点最近」的那条，作为方向(isBackEdge) + 业务属性 + 区域成员的来源边。
 *
 * 全程画布正 y 坐标，参数同空间；不涉及后端 y 取反（调用方传入的端点已取自节点 shape.x()/y()）。
 *
 * @param px/py 待测点
 * @param ax/ay 线段起点
 * @param bx/by 线段终点
 * @returns 点到线段的最小欧氏距离；线段退化为点时返回到该点的距离
 */
export const pointToSegmentDist = (
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
): number => {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    // 线段退化为点
    if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
    // 投影参数 t，钳到 [0,1]（最近点落在线段延长线上时取端点）
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
};

/**
 * 按起点/终点 node shape 创建一条直线(LINE)边并挂到 edgesLayer（SPEC §4.4 / §4.5）。
 *
 * - 坐标：from/to 用画布世界坐标；data.sy/ey 存 -y（后端），arrowPoints/label 用画布正 y（D18）。
 * - 方向：isBackEdge=false 正向（forwardPath 样式 #BDBDBD）、true 反向（reversePath 样式 #E57373）。
 * - 属性：inheritedProps 只接受 §4.3 白名单子集（标量 12 字段，锚点段另加 actions/userDefinedProperties），
 *   未提供字段用 defaultPathProperty；几何/拓扑字段由本函数逐条重建，绝不继承。
 * - 命名：nextNameByShapes 基于 stage 当前所有 edge 自增（D16）。
 * - 不在此处 saveSnapshot / 弹提示，由调用方处理（与 createNodeShape 一致）。
 *
 * @param stage          画布舞台
 * @param useMapId       当前地图 id
 * @param from           起点节点 shape（取 x()/y() 与 attrs.id）
 * @param to             终点节点 shape
 * @param isBackEdge     是否反向边（true ⇒ 红色 reversePath 样式）
 * @param inheritedProps 白名单业务属性（标量 + 可选实例字段），JSON 深拷贝后并入新边
 * @returns 创建成功的 edge Shape；stage / edgesLayer 不存在时返回 undefined
 */
export const createStraightEdge = (
    stage: Konva.Stage | null | undefined,
    useMapId: string,
    from: Konva.Shape,
    to: Konva.Shape,
    isBackEdge: boolean,
    inheritedProps?: Partial<MapEdge>
): Konva.Shape | undefined => {
    if (!stage) return;
    // 读取自适应视觉倍率，按比例缩放线宽（与 createNodeShape / onAddReverseEdge 同口径）
    const visualScale = stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    const stroke = isBackEdge ? reversePath.stroke : forwardPath.stroke;
    const labelFill = isBackEdge ? reversePath.labelFill : forwardPath.labelFill;
    const lineWidth = (isBackEdge ? reversePath.lineWidth : forwardPath.lineWidth) * visualScale;

    // 几何：画布正 y 算箭头/标签；标签用默认 t=1/3（D17 修正，与 AddEdge /
    // onAddReverseEdge / refreshDeviceLayer 同口径——设备图标锚点永远按 t=1/3 重算，
    // 若此处用 1/2，名称标签与角标（锚 labelX/labelY）会和设备图标纵向错位）
    const linePoints: LinePoint = [from.x(), from.y(), to.x(), to.y()];
    const arrowPoints = computeLineArrowPoints(linePoints);
    const label = computeLinePoint(linePoints); // 默认 t=1/3，勿传 1/2

    // 命名：基于 stage 当前所有 edge 自增（D16）；调用前旧边应已销毁，名称可回收
    const edgeShapes = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge") as Konva.Shape[];
    const nextName = nextNameByShapes(edgeShapes);

    // 深拷贝继承属性：调用方传入的白名单对象被 N+1 条边共用，浅展开会让各边
    // 共享同一 actions/allowVehicleGroup 数组引用；JSON 深拷贝（undoHistory 同款
    // 手法）使每条边持有独立副本，杜绝日后原地改数组时的串扰
    const inherited = inheritedProps
        ? (JSON.parse(JSON.stringify(inheritedProps)) as Partial<MapEdge>)
        : {};

    // 组装 data：defaultPathProperty 打底 → inherited（白名单业务字段）覆盖 →
    // 几何/拓扑字段逐条重建（在后覆盖，即使调用方误传拓扑字段也会被覆盖；
    // reverseEdgeId 另有显式置空双保险，SPEC §4.3-c）
    const data = {
        ...defaultPathProperty,
        ...inherited,                           // 白名单业务字段覆盖默认（D5/D6）
        id: getRandomString(),
        name: nextName,
        mapId: useMapId,
        reverseEdgeId: null,                    // 显式置空，双保险（§4.3-c）
        edgeType: "LINE",                       // 直线（D17）
        sx: from.x(),
        sy: -from.y(),                          // 后端 y（D18）
        cx: null, cy: null, dx: null, dy: null, // 直线无控制点（D17）
        ex: to.x(),
        ey: -to.y(),
        isBackEdge,
        snodeId: from.attrs.id,
        enodeId: to.attrs.id,
        arrowPoints,
        labelX: label.x,
        labelY: label.y
    };

    // 新边统一挂到 edgesLayer（与 onAddReverseEdge 一致）
    const edgesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.edges}`) as Konva.Layer | undefined;
    if (!edgesLayer) return;
    const shape = new Konva.Shape({
        id: data.id,
        shapeStyle: { labelFill, stroke, lineWidth },
        data,
        state: "",                          // 不选中（D11）
        enableSelect: "edge",
        hitStrokeWidth: Math.max(lineWidth * 5, 0.1),
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        sceneFunc: edgeSceneFunc,
        hitFunc: edgeHitFunc
    });
    edgesLayer.add(shape);
    // 命令式新增边后主动重绘，确保立即可见
    edgesLayer.batchDraw();
    return shape;
};
