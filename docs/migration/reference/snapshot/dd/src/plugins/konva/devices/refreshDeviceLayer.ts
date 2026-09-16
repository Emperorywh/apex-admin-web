/**
 * @description 三方设备图标 Layer 的命令式全量刷新（MapNestModify 专用）
 * @date 2026-6-27
 *
 * 为什么需要这个函数：
 * MapNestModify 画布采用「React state(edges) 初始挂载 + 命令式运行时编辑」模式——
 * 拖动节点(onNodeShapeDragMove)、拖动控制点(ControlPoints)、修改设备类型(ThirdDevice)
 * 都通过 shape.setAttrs 直接改 Konva attrs，不会更新 React edges state。
 * 路径 Shape 的 sceneFunc 实时从 data 读坐标，故路径能跟随移动；
 * 但设备图标的位置/朝向若只在 React effect 里快照一次，就会与命令式编辑脱节，
 * 表现为「拖动节点/控制点时图标不跟随」「修改设备类型后图标不立即出现/消失」。
 *
 * 本函数直接从 edge Shape 的实时 data 重建设备图标，作为运行时编辑点
 * 与 DeviceLayer 初始挂载共用的统一刷新入口，彻底消除两套数据源的割裂。
 *
 * 调用点：
 *   - DeviceLayer 的 edges/isDark effect（初始加载 / 地图切换 / 主题切换）
 *   - GraphStage.onStageDragMove（节点拖动，onNodeShapeDragMove 之后）
 *   - ControlPoints 两个控制点 DragMove（贝塞尔控制点拖动）
 *   - ThirdDevice/DeviceType.onDeviceTypeChange（修改设备类型后立即增删图标）
 */
import Konva from "konva";
import { resolveDeviceType, deviceIconSceneFunc, deviceIconHitFunc } from "./index";
import { computeEdgeTangentAngle, computeLinePoint, computeBezierLabelPoint } from "@/utils/math";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "../runtime/constants";
import type { LinePoint, BezierPoints } from "@/utils/typing";

/**
 * 命令式全量重建设备图标 Layer。
 *
 * 实现：
 *   1. 按 name 定位三方设备图标 Layer；
 *   2. 取 visualScale / isDark：优先用 options 覆盖值，否则从 stage 自定义 attr 读取；
 *   3. 从 stage 实时读取「当前选中的 edge id 集合」以驱动图标联动高亮（D19）；
 *   4. 遍历所有 edge Shape 的实时 data，对 resolveDeviceType 命中的边重建一个图标 Shape，
 *      设备类型被清空的边自然不再创建（实现「取消设备后图标立即消失」）。
 *
 * 边数量级通常为几十到几百、有设备的边更少，每次编辑点全量重建开销可忽略，
 * 且与 onNodeShapeDragMove 每帧重算路径 arrowPoints/label 同节奏。
 *
 * 关于 options 覆盖参数（isDark/visualScale）：
 * React effect 执行顺序是「子组件先于父组件」，DeviceLayer（子）的 isDark effect 会先于
 * GraphStage（父）的 setAttr(isDark) 执行——若本函数总从 stage attr 读 isDark，
 * 主题切换瞬间会读到旧值。因此 DeviceLayer 调用时通过 options 显式传入最新 prop 值，
 * 规避时序问题；运行时编辑点（节点/控制点拖动、改设备类型）调用时不传 options，
 * 此时主题与缩放均未变化，stage attr 即为稳定的正确值。
 *
 * @param stage 当前 Konva.Stage
 * @param options 可选覆盖值（DeviceLayer 初始/主题切换时传入最新 prop，编辑点不传）
 */
export const refreshDeviceIcons = (
    stage: Konva.Stage,
    options?: { isDark?: boolean; visualScale?: number }
) => {
    if (!stage) return;
    /**
     * 按 layer name 定位三方设备图标图层。
     * Konva find 接受函数谓词（同 onNodeShapeDragMove 用法），返回 Collection，这里取首个。
     */
    const layer = (stage.find((node: Konva.Node) => node instanceof Konva.Layer && node.name() === MAP_NEST_LAYER_NAME.devices) as unknown as Konva.Layer[])[0];
    if (!layer) return;

    /** 视觉倍率与暗黑主题：优先 options 覆盖值，否则回退 stage 自定义 attr */
    const visualScale: number = options?.visualScale ?? (stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1);
    const isDark: boolean = options?.isDark ?? (stage.getAttr(MAP_NEST_STAGE_ATTR.isDark) ?? false);

    /**
     * 当前选中的 edge id 集合：直接从 stage 实时读取（state === "selected"），
     * 这样运行时编辑后刷新也能保留正确的选中联动高亮，无需依赖 React selectShapes。
     */
    const selectedEdgeIds = new Set<string>();
    (stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge" && shape.attrs?.state === "selected") as unknown as Konva.Shape[])
        .forEach(shape => {
            const id = shape.id();
            if (id) selectedEdgeIds.add(id);
        });

    /** 所有路径 Shape 的实时数据（运行时编辑后的最新坐标/类型都在这里） */
    const edgeShapes = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge") as unknown as Konva.Shape[];

    layer.destroyChildren();
    edgeShapes.forEach(edgeShape => {
        const data = edgeShape.getAttrs()?.data;
        if (!data) return;
        const deviceType = resolveDeviceType(data.userDefinedProperties);
        // 非设备边不绘制；设备类型被清空后这里自然跳过 → 图标立即消失
        if (!deviceType) return;

        const { sx, sy, cx, cy, dx, dy, ex, ey, isBackEdge } = data;
        /**
         * 锚点 = 路径标签点（与 createEdgeShapeConfig 同口径：y 取反后的 canvas 坐标）。
         * 直线用 computeLinePoint(默认 t=1/3)，贝塞尔用 computeBezierLabelPoint(默认 t=0.4，与箭头同 t)。
         */
        let anchorX: number;
        let anchorY: number;
        if (cx === null || cy === null || dx === null || dy === null) {
            const p = computeLinePoint([sx, -sy, ex, -ey] as LinePoint);
            anchorX = p.x;
            anchorY = p.y;
        } else {
            const p = computeBezierLabelPoint([sx, -sy, cx, -cy, dx, -dy, ex, -ey] as BezierPoints);
            anchorX = p.x;
            anchorY = p.y;
        }
        // 切线角度（图标朝向跟随路径切线，D10）
        const angle = computeEdgeTangentAngle(sx, sy, cx, cy, dx, dy, ex, ey);

        const iconShape = new Konva.Shape({
            sceneFunc: deviceIconSceneFunc,
            // 命中区域：以图标中心为圆心、R 为半径的整圆，保证点击图标任意位置都能命中
            hitFunc: deviceIconHitFunc,
            // listening=true：点击设备图标即选中其所属路径，hover 显示 pointer 手势
            listening: true,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            data: {
                deviceType,
                anchorX,
                anchorY,
                angle,
                isBackEdge,
                scale: visualScale,
                isDark,
                isSelected: selectedEdgeIds.has(edgeShape.id()),
                edgeId: edgeShape.id(),
            },
        });
        layer.add(iconShape);
    });
    layer.batchDraw();
};
