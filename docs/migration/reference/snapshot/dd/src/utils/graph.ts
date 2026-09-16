/**
 * @description 处理画布相关的函数
 * @date 2025-5-22
 */
import { findMissNumber } from "@/utils/public";
import { computeCubicArrowPoints, computeLineArrowPoints, computeBezierLabelPoint, computeLinePoint, computeBezierLength, rotatePointByRad } from "./math";
import type { MapEdge, BezierPoints, LinePoint, RobotRect, SocketDispatcherState, TrafficPath, MountLine, MapNode, MountNode, VehicleType, ClientRect } from "./typing";
import { forwardPath } from "@/plugins/konva/path/forwardPath";
import { reversePath } from "@/plugins/konva/path/reversePath";
import { getNodeStyle } from "@/plugins/konva/nodes";
import { robotProperty } from "@/plugins/konva/nodes/robot";
import type Konva from "konva";
import { selectedState } from "@/plugins/konva/state/selected";

/**
 * @description 挂载所有节点
 * @param {MapNode[]} nodes 接口拿到的所有节点
 * @param {number} nodeScale 节点视觉倍率（默认 1）
 * @returns {MountNode[]} 界面上需要用的所有节点
 */
export const mountGraphNodes = (nodes: MapNode[], nodeScale: number = 1): MountNode[] => {
    const mountNodes: MountNode[] = [];
    nodes.forEach(node => {
        const { id, x, y, type, angle, ...rest } = node;
        // 找设置的样式
        const { radius, showArrow, fill, stroke, lineWidth, labelFill } = getNodeStyle(type);
        const scaledRadius = radius * nodeScale;
        const scaledLineWidth = lineWidth * nodeScale;
        // 方向箭头
        const arrowPoints = showArrow && angle !== null ? computeRotateArrow(scaledRadius, -angle) : undefined;
        mountNodes.push({
            id,
            x,
            y: -y,
            shapeStyle: {
                radius: scaledRadius,
                fill,
                stroke,
                lineWidth: scaledLineWidth,
                labelFill,
            },
            data: {
                ...rest,
                type,
                angle,
                arrowPoints
            }
        });
    })
    return mountNodes;
};

/**
 * @description 手动几何命中检测：Overlook NodesLayer listening=false，
 *              Konva 事件无法命中节点，右键时以世界坐标遍历找最近节点
 * @param nodes 原始地图节点（MapNode[]，GraphStage state）
 * @param world 指针世界坐标（screenToWorld 转换结果）
 * @param visualScale 当前视觉缩放（visualScaleRef.current），保证命中半径与绘制半径一致
 * @returns 命中的最近节点，未命中返回 null
 */
export const findHitNode = (
    nodes: MapNode[],
    world: { x: number; y: number },
    visualScale: number,
): MapNode | null => {
    let hit: MapNode | null = null;
    let minDist = Infinity;
    nodes.forEach(node => {
        // 节点世界坐标为 (x, -y)（mountGraphNodes 翻转 y 轴）
        const dx = world.x - node.x;
        const dy = world.y - (-node.y);
        const dist = Math.hypot(dx, dy);
        // 命中半径 = 样式半径 × visualScale，与 sceneFunc 实际绘制半径一致（所见即所点）
        const radius = getNodeStyle(node.type).radius * visualScale;
        if (dist <= radius && dist < minDist) {
            minDist = dist;
            hit = node;
        }
    });
    return hit;
};

/**
 * @description 处理从接口拿到的路径数据 处理路径的时候添加路径的箭头
 * @param {mapEdge[]} edge 接口里mapJson里面的边
 * @param {number} edgeScale 路径视觉倍率（默认 1）
 * @returns {MountLine[]}
 */
export const mountGraphEdges = (edges: MapEdge[], edgeScale: number = 1): MountLine[] => {
    if (!edges?.length) return [];
    const mountEdges: MountLine[] = [];
    edges.forEach((edge: MapEdge) => {
        const { id, sx, sy, cx, cy, dx, dy, ex, ey, isBackEdge, ...rest } = edge;
        const stroke = isBackEdge ? reversePath.stroke : forwardPath.stroke;
        const labelFill = isBackEdge ? reversePath.labelFill : forwardPath.labelFill;
        // 定义路径宽度
        const lineWidth = (isBackEdge ? reversePath.lineWidth : forwardPath.lineWidth) * edgeScale;
        // 没有 cx cy dx dy 的是直线，其他情况是三次贝塞尔曲线
        if (cx === null || cy === null || dx === null || dy === null) {
            // 直线
            const points: LinePoint = [sx, -sy, ex, -ey];
            // 计算直线的箭头坐标
            const edgeArrowPoints = computeLineArrowPoints(points);
            // 计算直线的标签位置
            const { x, y } = computeLinePoint(points);
            mountEdges.push({
                id,
                shapeStyle: {
                    labelFill,
                    stroke,
                    lineWidth
                },
                data: {
                    ...rest,
                    sx,
                    sy,
                    cx,
                    cy,
                    dx,
                    dy,
                    ex,
                    ey,
                    labelX: x,
                    labelY: y,
                    isBackEdge,
                    arrowPoints: edgeArrowPoints
                }
            });
        } else {
            // 贝塞尔曲线
            const points: BezierPoints = [sx, -sy, cx, -cy, dx, -dy, ex, -ey];
            // 计算贝塞尔曲线的箭头坐标（t=0.4）
            const cubicArrowPoints = computeCubicArrowPoints(points);
            // 计算贝塞尔曲线的标签锚点（默认 t=0.4，与箭头同 t，使标签落在箭头附近）
            const { x, y } = computeBezierLabelPoint(points);
            mountEdges.push({
                id,
                shapeStyle: {
                    labelFill,
                    stroke,
                    lineWidth
                },
                data: {
                    ...rest,
                    sx,
                    sy,
                    cx,
                    cy,
                    dx,
                    dy,
                    ex,
                    ey,
                    labelX: x,
                    labelY: y,
                    isBackEdge,
                    arrowPoints: cubicArrowPoints
                }
            });
        }
    })
    return mountEdges;
};

/**
 * @description 处理从接口拿到的车辆数据和交管信息
 * @param {RobotRunningState[]} data 车辆数据
 * @returns {RobotRect[], TrafficPath[], TrafficPath[]}
 */
export const transformTrafficInfo = ({ vehicles }: SocketDispatcherState) => {
    // 过滤掉没有坐标的车，不显示没有坐标的车
    const positionVehicles = vehicles.filter(vehicle => typeof vehicle.agvPosition?.x === "number" && typeof vehicle.agvPosition?.y === "number");
    const robots: RobotRect[] = [];
    const applyingPath: TrafficPath[] = [];
    const lockedPath: TrafficPath[] = [];
    if (!vehicles?.length) {
        return {
            robots,
            applyingPath,
            lockedPath
        }
    }
    positionVehicles.forEach((state: VehicleType) => {
        const {
            agvKey,
            agvName,
            agvPosition: { x = 0, y = 0, theta = 0, localizationScore = 1 },
            agvDimension: { width, length, centerOffset, loadLength, loadWidth },
            trafficShapeResources: { applyingRectangles, lockedRectangles },
            type,
            batteryState: { batteryCharge, charging },
            vehicleProcStatus,
            connectionState,
            loaded,
            orderTaskKey,
            dispatchState,
            velocity: { vx, vy, omega },
            paused,
            errorEntryList
        } = state;
        robots.push({
            agvKey,
            agvName,
            x: x,
            y: -y,
            theta, // 弧度
            width: loaded ? loadWidth : width, // 矩形的高度
            length: loaded ? loadLength : length, // 矩形的宽度
            centerOffset, // 偏移量
            loadLength,
            loadWidth,
            type, // 车辆类型 1：叉车 2：非叉车
            batteryCharge, // 当前电量
            charging, // 是否充电中
            connectionState,
            robotFill: connectionState !== "ONLINE" ? robotProperty.robotFill.OFFLINE : robotProperty.robotFill[vehicleProcStatus], // 车辆的颜色
            strokeStyle: connectionState !== "ONLINE" ? robotProperty.strokeStyle.OFFLINE : robotProperty.strokeStyle[vehicleProcStatus], // 车辆边框的颜色
            pathFill: robotProperty.pathFill.OFFLINE, // 车辆箭头的颜色
            vehicleProcStatus: connectionState !== "ONLINE" ? connectionState : vehicleProcStatus, // 车辆的状态
            loaded, // 载货状态
            orderTaskKey, // 订单编号
            omega, // 旋转速度
            vx,
            vy,
            paused,
            localizationScore, // 定位置信度
            errorEntryList // 告警信息
        })
        applyingRectangles.forEach(applying => {
            // 为8位数字的数组代表举行的四个顶点的x,y值 顺序为 左上 左下 右上 右下
            const [ltx, lty, lbx, lby, rtx, rty, rbx, rby] = applying;
            const data: string = `M ${ltx},${-lty} L ${lbx},${-lby} L ${rbx},${-rby} L ${rtx},${-rty} Z`;
            applyingPath.push({
                agvKey,
                data
            })
        })
        lockedRectangles.forEach(locked => {
            // 为8位数字的数组代表举行的四个顶点的x,y值 顺序为 左上 左下 右上 右下
            const [ltx, lty, lbx, lby, rtx, rty, rbx, rby] = locked;
            const data: string = `M ${ltx},${-lty} L ${lbx},${-lby} L ${rbx},${-rby} L ${rtx},${-rty} Z`;
            lockedPath.push({
                agvKey,
                data
            })
        })
    })
    return {
        robots,
        applyingPath,
        lockedPath
    };
};

/**
 * @description 判断是不是所有的点都在矩形的的范围内
 * @param points 二维点集合
 * @param rect 矩形
 * @returns boolean
 */
export const isPointsInRect = (points: [number, number][], rect: ClientRect) => {
    const { x, y, width, height } = rect;

    const left = Math.min(x, x + width);
    const right = Math.max(x, x + width);
    const top = Math.min(y, y + height);
    const bottom = Math.max(y, y + height);
    return points.every(([px, py]) => px >= left && px <= right && py >= top && py <= bottom)
};

/**
 * @description 两条线段是否相交（跨立实验 + 共线退化处理）
 * @param a1 线段A起点 [x,y]
 * @param a2 线段A终点 [x,y]
 * @param b1 线段B起点 [x,y]
 * @param b2 线段B终点 [x,y]
 * @returns 是否相交
 */
const segmentsIntersect = (
    a1: [number, number],
    a2: [number, number],
    b1: [number, number],
    b2: [number, number]
): boolean => {
    // 三角形有向面积（叉积），>0 左转，<0 右转，=0 共线
    const cross = (p: [number, number], q: [number, number], r: [number, number]) =>
        (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = cross(b1, b2, a1);
    const d2 = cross(b1, b2, a2);
    const d3 = cross(a1, a2, b1);
    const d4 = cross(a1, a2, b2);
    // 规范相交：两侧跨立
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    // 共线退化：端点落在另一线段上才算相交
    const onSeg = (p: [number, number], q: [number, number], r: [number, number]) =>
        Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) &&
        Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
    if (d1 === 0 && onSeg(b1, b2, a1)) return true;
    if (d2 === 0 && onSeg(b1, b2, a2)) return true;
    if (d3 === 0 && onSeg(a1, a2, b1)) return true;
    if (d4 === 0 && onSeg(a1, a2, b2)) return true;
    return false;
};

/**
 * @description 线段是否与轴对齐矩形相交（含端点在矩形内的退化情况，处理负 width/height）
 * @param points 线段两端点 [[x,y],[x,y]]
 * @param rect 矩形（width/height 允许为负）
 * @returns 是否相交
 */
export const segmentIntersectsRect = (
    points: [number, number][],
    rect: ClientRect
): boolean => {
    const { x, y, width, height } = rect;
    const left = Math.min(x, x + width);
    const right = Math.max(x, x + width);
    const top = Math.min(y, y + height);
    const bottom = Math.max(y, y + height);
    const [p1, p2] = points;
    // 快速短路：任一端点在矩形内
    const inside = (p: [number, number]) =>
        p[0] >= left && p[0] <= right && p[1] >= top && p[1] <= bottom;
    if (inside(p1) || inside(p2)) return true;
    // 矩形 4 条边
    const tl: [number, number] = [left, top];
    const tr: [number, number] = [right, top];
    const br: [number, number] = [right, bottom];
    const bl: [number, number] = [left, bottom];
    return (
        segmentsIntersect(p1, p2, tl, tr) ||
        segmentsIntersect(p1, p2, tr, br) ||
        segmentsIntersect(p1, p2, br, bl) ||
        segmentsIntersect(p1, p2, bl, tl)
    );
};

/**
 * @description 三次贝塞尔曲线采样：返回 N 个世界坐标系采样点（已对 y 取反，匹配渲染口径）
 *
 * 关键口径：edge 数据中 sy/cy/dy/ey 存的是原始世界 y，渲染处统一用 -y。
 * 本函数返回的点已是 (B_x(t), -B_y(t))，调用方对每个点 worldToScreen(p.x, p.y, st)
 * 即可与现有 worldToScreen(sx, -sy, st) 端点变换完全一致，避免双重取反。
 *
 * @param sx sy ex ey 起止点（sy/ey 为原始世界 y，函数内取反）
 * @param cx cy dx dy 控制点（cy/dy 为原始世界 y，函数内取反）
 * @param n 采样点数（默认 32）
 * @returns 采样点数组 [{x, y}, ...]，y 已取反
 */
export const bezierSamplePoints = (
    sx: number, sy: number, cx: number, cy: number,
    dx: number, dy: number, ex: number, ey: number,
    n: number = 32
): { x: number; y: number }[] => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const u = 1 - t;
        // 三次贝塞尔参数方程
        const x = u * u * u * sx + 3 * u * u * t * cx + 3 * u * t * t * dx + t * t * t * ex;
        const y = u * u * u * sy + 3 * u * u * t * cy + 3 * u * t * t * dy + t * t * t * ey;
        pts.push({ x, y: -y }); // y 取反，匹配渲染口径
    }
    return pts;
};



/**
 * @description 根据名称顺序找到第一个缺失的名称
 * @param shapes 所有需要找的图形
 * @param name 名称例子 默认按纯数字查找
 * @returns 缺失的名称
 */
export const nextNameByShapes = (shapes: Konva.Shape[], name: string = "1"): string => {
    // 判断名称是不是纯数字
    const isNumber = !isNaN(Number(name.trim()));
    if (isNumber) {
        // 是纯数字，顺序找出缺失的第一项
        // 找到所有的名称为纯数字的shape
        const numberNameShapes = shapes.filter(shape => shape.attrs?.data?.name && !isNaN(Number(shape.attrs?.data?.name?.trim())));
        const numberNames = numberNameShapes.map(shape => Number(shape.attrs?.data?.name));
        numberNames.sort((preName, nextName) => preName - nextName);
        const nextName = findMissNumber(numberNames);
        return nextName.toString();
    } else {
        // 带前缀的名称：前缀取开头的若干个非数字字符（兼容中文与拉丁字母前缀，如「充电站1」「L5」）。
        // 原先只匹配中文字符，会导致「L5」这类名称前缀识别为空串而错误归并到一组。
        const match = name.match(/^[^\d]+/);
        const prefix = match ? match[0] : "";
        // 找到相同前缀的名称
        const prefixNameShapes = shapes.filter(shape => shape.attrs?.data?.name && shape.attrs?.data?.name?.startsWith(prefix));
        const suffixNames = prefixNameShapes.map(shape => {
            const name = shape.attrs?.data?.name;
            const match = name.match(/\d+$/);
            return match ? Number(match[0]) : -1;
        });
        // findMissNumber 依赖升序数组查找首个缺失项，必须先排序；
        // 缺少排序时，非升序的后缀序列（如 [1,5,1,6,1,4]）会提前返回一个已存在的数字，
        // 从而生成与已有路径重名的名称，导致保存被校验拦截。
        suffixNames.sort((preName, nextName) => preName - nextName);
        const nextName = findMissNumber(suffixNames);
        return prefix + nextName;
    }
};

/**
 * @description 还原单个元素的「选中样式」：state 置空、radius/lineWidth 除回去。
 *              抽取自 unSelectShapeEvent / ContextMenu 的单 shape 还原逻辑，供 toggle 取消选中复用。
 *              与 updateShapeStyle 互为逆操作（按 D7 不还原 moveToTop 的 z-order）。
 *              只处理 node / edge；非选中态直接跳过，幂等。
 * @param shape 要取消选中的元素
 * @returns void
 */
export const deselectShape = (shape: Konva.Shape | Konva.Node) => {
    const { attrs } = shape;
    if (attrs?.enableSelect !== "node" && attrs?.enableSelect !== "edge") return;
    // 仅当处于选中态才还原，避免重复除法导致样式越来越小（幂等）
    if (attrs?.state !== "selected") return;
    // shapeStyle 缺省 {} 以防极端情况下 attrs 无该字段，保证解构默认值生效
    const { enableSelect, shapeStyle: { radius = 0, lineWidth = 0, ...rest } = {} } = attrs;
    if (enableSelect === "node") {
        // 节点：radius 与 lineWidth 都除回去
        shape.setAttrs({
            state: "",
            shapeStyle: {
                ...rest,
                radius: radius / selectedState.radius,
                lineWidth: lineWidth / selectedState.lineWidth
            }
        });
    } else {
        // 路径：只除 lineWidth（路径无 radius）
        shape.setAttrs({
            state: "",
            shapeStyle: {
                ...rest,
                lineWidth: lineWidth / selectedState.lineWidth
            }
        });
    }
};

/**
 * @description 按 attrs.id 对 shape 数组去重，保留首次出现项。
 *              attrs.id 是节点 / 路径的业务稳定标识（ContextMenu 既有过滤亦用此字段）。
 *              无 attrs.id 的元素退化为按 Konva 内部 id 去重，保证不被误判为重复。
 * @param shapes 待去重的 shape 数组
 * @returns 去重后的新数组（保持原序）
 */
export const dedupShapes = (shapes: Konva.Shape[]): Konva.Shape[] => {
    const seen = new Set<string>();
    const result: Konva.Shape[] = [];
    shapes.forEach(shape => {
        const id = shape?.attrs?.id;
        // 有业务 id 用业务 id 作 key，否则退化为 Konva 内部 id，避免 undefined 互相覆盖
        const key = id != null ? String(id) : `__ref_${shape?.id?.() ?? Math.random()}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(shape);
    });
    return result;
};

/**
 * @description 还原被选中的元素的样式 按住ctrl的时候不还原样式
 *              重构后内部复用 deselectShape，消除与 ContextMenu 的重复还原逻辑。
 * @param event 画布鼠标事件
 * @returns void
 */
export const unSelectShapeEvent = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const { target, evt } = event;
    const stage = target.getStage();
    // Ctrl 守卫保留：保护 Ctrl 追加 / toggle 场景下已有元素的选中样式不被还原
    if (!stage || evt.ctrlKey) return;
    const shapes: Konva.Shape[] = stage.find((shape: Konva.Shape | Konva.Group) => shape.attrs?.state === "selected");
    if (!shapes) return;
    shapes.forEach(deselectShape);
};

/**
 * @description 拖动节点的时候要更新关联的边
 * @param event 拖动节点的事件event
 * @returns void
 */
export const onNodeShapeDragMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const { target } = event;
    const stage = target.getStage();
    if (!stage) return;
    const position: Konva.Vector2d = {
        x: target.x(),
        y: -target.y()
    };
    // 找到当前节点关联的边
    const relatedShape: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge" && (shape.attrs?.data?.snodeId === target?.attrs?.id || shape.attrs?.data?.enodeId === target?.attrs?.id));
    relatedShape.forEach(shape => {
        const { attrs: { data: { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, snodeId, enodeId, ...rest } } } = shape;
        if (snodeId === target?.attrs?.id) {
            // 起点相同，批量修改路径的起点，箭头，label
            if (cx === null || cy === null || dx === null || dy === null) {
                // 是直线
                const points: LinePoint = [position.x, -position.y, ex, -ey];
                // 计算直线箭头
                const arrowPoints = computeLineArrowPoints(points);
                const label = computeLinePoint(points);
                shape.setAttrs({
                    data: {
                        ...rest,
                        snodeId,
                        enodeId,
                        sx: position.x,
                        sy: position.y,
                        cx: null,
                        cy: null,
                        dx: null,
                        dy: null,
                        ex,
                        ey,
                        arrowPoints,
                        labelX: label.x,
                        labelY: label.y
                    }
                });
            } else {
                // 是曲线
                const points: BezierPoints = [position.x, -position.y, cx, -cy, dx, -dy, ex, -ey];
                // 计算曲线箭头
                const arrowPoints = computeCubicArrowPoints(points);
                const label = computeBezierLabelPoint(points);
                shape.setAttrs({
                    data: {
                        ...rest,
                        snodeId,
                        enodeId,
                        sx: position.x,
                        sy: position.y,
                        cx,
                        cy,
                        dx,
                        dy,
                        ex,
                        ey,
                        arrowPoints,
                        labelX: label.x,
                        labelY: label.y
                    }
                });
            }
        }
        if (enodeId === target?.attrs?.id) {
            // 终点相同，批量修改路径的终点坐标，箭头，label
            if (cx === null || cy === null || dx === null || dy === null) {
                // 是直线
                const points: LinePoint = [sx, -sy, position.x, -position.y];
                // 计算直线箭头
                const arrowPoints = computeLineArrowPoints(points);
                const label = computeLinePoint(points);
                shape.setAttrs({
                    data: {
                        ...rest,
                        snodeId,
                        enodeId,
                        sx,
                        sy,
                        cx: null,
                        cy: null,
                        dx: null,
                        dy: null,
                        ex: position.x,
                        ey: position.y,
                        arrowPoints,
                        labelX: label.x,
                        labelY: label.y
                    }
                });
            } else {
                // 是曲线
                const points: BezierPoints = [sx, -sy, cx, -cy, dx, -dy, position.x, -position.y];
                // 计算曲线箭头
                const arrowPoints = computeCubicArrowPoints(points);
                const label = computeBezierLabelPoint(points);
                shape.setAttrs({
                    data: {
                        ...rest,
                        snodeId,
                        enodeId,
                        sx,
                        sy,
                        cx,
                        cy,
                        dx,
                        dy,
                        ex: position.x,
                        ey: position.y,
                        arrowPoints,
                        labelX: label.x,
                        labelY: label.y
                    }
                });
            }
        }
    })
};

/**
 * @description 计算路径的长度
 * @param edgeShape 路径shape
 * @returns length 路径的长度
 */
export const computeEdgeLength = (edgeShape: Konva.Shape): number => {
    const { attrs: { data: { sx, sy, cx, cy, dx, dy, ex, ey } } } = edgeShape;
    if (cx === null || cy === null || dx === null || dy === null) {
        // 是直线，计算直线的坐标
        const { length } = computeLinePoint([sx, sy, dx, dy]);
        return length;
    } else {
        // 是贝塞尔曲线，计算贝塞尔曲线的坐标
        const length = computeBezierLength([sx, sy, cx, cy, dx, dy, ex, ey]);
        return length;
    }
};

/**
 * @description 根据圆的半径，旋转的弧度，计算旋转后的箭头的坐标
 * @param radius 圆的半径
 * @param rad 逆时针旋转的弧度
 * @param arrowWidth 箭头的宽度
 * @param arrowLength 箭头的长度
 * @returns 箭头的坐标
 */
export const computeRotateArrow = (radius: number, rad?: number) => {
    if (typeof rad !== "number") return;
    const top: [number, number] = [0, -radius / 2];
    const right: [number, number] = [radius / 2, 0];
    const bottom: [number, number] = [0, radius / 2];
    const points = [top, right, bottom].map(p => rotatePointByRad(p, rad));
    return points;
};

/**
 * @description 设置节点是不是可以拖动
 * @param stage Konva.Stage | null
 * @param draggable 是不是可以拖动
 * @returns void
 */
export const setNodeDraggable = (stage: Konva.Stage | null, draggable: boolean = true) => {
    if (!stage) return;
    const nodeShape: Konva.Shape[] = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node");
    nodeShape.forEach(shape => {
        shape.setAttr("draggable", draggable);
    });
};

/**
 * @description 还原元素选中的样式
 * @param stage 舞台
 * @returns void
 */
export const unSelectedShape = (stage: Konva.Stage) => {
    if (!stage) return;
    const shapes: Konva.Shape[] = stage.find((shape: Konva.Shape | Konva.Group) => shape.attrs?.state === "selected");
    if (!shapes) return;
    shapes.forEach(shape => {
        const { enableSelect, shapeStyle: { radius = 0, lineWidth = 0, ...rest } } = shape.attrs;
        if (enableSelect === "node") {
            shape.setAttrs({
                state: "",
                shapeStyle: {
                    ...rest,
                    radius: radius / selectedState.radius,
                    lineWidth: lineWidth / selectedState.lineWidth
                }
            })
        }
        if (enableSelect === "edge") {
            shape.setAttrs({
                state: "",
                shapeStyle: {
                    ...rest,
                    lineWidth: lineWidth / selectedState.lineWidth
                }
            })
        }
    });
};

/**
 * @description 更新元素的样式为状态样式
 * @param shape 要更新的元素样式
 * @param state 要更新为的状态 当前只有selected
 * @returns void
 */
export const updateShapeStyle = (shape: Konva.Shape | Konva.Node, state?: "selected") => {
    const { attrs } = shape;
    if (attrs?.enableSelect === "node" || attrs?.enableSelect === "edge") {
        // 是节点或者路径，设置选中状态
        if (attrs?.state === "selected") return;
        shape.setAttrs({
            state: "selected",
            shapeStyle: {
                ...(attrs?.shapeStyle || {}),
                radius: attrs?.enableSelect === "node" ? attrs?.shapeStyle?.radius * selectedState.radius : undefined,
                lineWidth: attrs?.shapeStyle?.lineWidth * selectedState.lineWidth
            }
        });
        shape.moveToTop();
    }
};

/**
 * 坐标判重容差（米）。
 * 决策 3：用户选择"精确相等"，默认 EPSILON=0。
 * 注意：车体微抖动 / 浮点误差可能导致精确相等漏判，
 *       若线上出现"明显同点却未判重"，把此值调到 0.01 即近似严格判定。
 */
export const DUPLICATE_EPSILON = 0;

/**
 * @description 在画布世界坐标空间内，判断 (x,y) 是否已存在节点
 * @param stage 画布舞台
 * @param x 目标点画布世界坐标 x（米）
 * @param y 目标点画布世界坐标 y（米）
 * @returns 命中则返回该节点名称，否则 null
 * 备注：比对的是画布空间 shape.x()/y()（与后端 y 的正负无关），
 *       覆盖所有 enableSelect==="node" 的节点类型（charge / park / shelf / work / warehouse_* 以及 node）。
 */
export const findDuplicateNodeName = (
    stage: Konva.Stage | null,
    x: number,
    y: number
): string | null => {
    if (!stage) return null;
    const hit = stage.findOne((s: Konva.Shape) => {
        if (s.attrs?.enableSelect !== "node") return false;
        const dx = Math.abs(s.x() - x);
        const dy = Math.abs(s.y() - y);
        return dx <= DUPLICATE_EPSILON && dy <= DUPLICATE_EPSILON;
    }) as Konva.Shape | undefined;
    return hit?.attrs?.data?.name ?? null;
};
