/**
 * @description 数学算法
 * @date 2025-5-24
 */
import type { BezierPoints, ArrowPoints, LinePoint } from "./typing";

/**
 * @description 求贝塞尔曲线几分之几处的点
 * @param t 例 2/3
 * @param points [起点x, 起点y, 控制点1x, 控制点1y, 控制点2x, 控制点2y, 终点x, 终点y]
 * @returns {x, y}
 */
export const getBezierFractPoint = (points: BezierPoints, t: number) => {
    const [sx, sy, cx, cy, dx, dy, ex, ey] = points;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    const x = mt2 * mt * sx + 3 * mt2 * t * cx + 3 * mt * t2 * dx + t * t2 * ex;
    const y = mt2 * mt * sy + 3 * mt2 * t * cy + 3 * mt * t2 * dy + t * t2 * ey;

    return { x, y };
}

/**
 * @description 计算切线方向
 * @param {number} t 几分之几 2/3
 * @param {BezierPoints} points [起点x, 起点y, 控制点1x, 控制点1y, 控制点2x, 控制点2y, 终点x, 终点y]
 * @returns {qx, qy}
 */
export const getBezierTangent = (points: BezierPoints, t: number) => {
    const [sx, sy, cx, cy, dx, dy, ex, ey] = points;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    const qx = 3 * mt2 * (cx - sx) + 6 * mt * t * (dx - cx) + 3 * t2 * (ex - dx);
    const qy = 3 * mt2 * (cy - sy) + 6 * mt * t * (dy - cy) + 3 * t2 * (ey - dy);

    return { qx, qy };
}

/**
 * @description 计算三次贝塞尔曲线的箭头坐标
 * @param {BezierPoints} points
 * @param {qx: number, qy: number} tangent getBezierTangent的返回值
 * @param {number} size 箭头的尺寸
 * @returns {number[]} []
 */
export const computeCubicArrowPoints = (points: BezierPoints, t: number = 0.4, size: number = .3): ArrowPoints => {
    // 获取贝塞尔曲线在2/3处的切线
    const point = getBezierFractPoint(points, t);
    // 计算切线的方向
    const tangent = getBezierTangent(points, t);
    // 标准化切线向量
    const length = Math.sqrt(tangent.qx * tangent.qx + tangent.qy * tangent.qy);
    const nx = tangent.qx / length;
    const ny = tangent.qy / length;

    // 计算垂直向量（用于箭头宽度）
    const perpX = -ny;
    const perpY = nx;

    // 箭头三个顶点
    const tip = { x: point.x, y: point.y };
    const left = {
        x: point.x - size * nx + size * 0.6 * perpX,
        y: point.y - size * ny + size * 0.6 * perpY
    };
    const right = {
        x: point.x - size * nx - size * 0.6 * perpX,
        y: point.y - size * ny - size * 0.6 * perpY
    };

    return [left.x, left.y, tip.x, tip.y, right.x, right.y];
}

/**
 * 计算直线上终点1/3处的箭头坐标
 * @param {LinePoint} [起点x, 起点y, 终点x, 终点y]
 * @param {number} [arrowLength=10] 箭头长度
 * @param {number} [arrowWidth=6] 箭头宽度
 * @param {number} [t=2/3] 在直线靠近终点的2/3处
 * @returns {Array} 箭头三个顶点的坐标 [xLeft, yLeft, xTip, yTip, xRight, yRight]
 */
export const computeLineArrowPoints = (points: LinePoint, t: number = 0.4, size: number = .3): ArrowPoints => {
    const arrowWidth = size / 2;
    const [sx, sy, ex, ey] = points;
    // 1. 计算直线上距离终点1/3处的点 (t = 2/3)
    const pointX = sx + (ex - sx) * t;
    const pointY = sy + (ey - sy) * t;

    // 2. 计算直线角度
    const angle = Math.atan2(ey - sy, ex - sx);

    // 3. 计算箭头三个顶点
    // 箭头尖端
    const tipX = pointX;
    const tipY = pointY;

    // 箭头左侧点
    const leftX = pointX - size * Math.cos(angle) + arrowWidth * Math.sin(angle);
    const leftY = pointY - size * Math.sin(angle) - arrowWidth * Math.cos(angle);

    // 箭头右侧点
    const rightX = pointX - size * Math.cos(angle) - arrowWidth * Math.sin(angle);
    const rightY = pointY - size * Math.sin(angle) + arrowWidth * Math.cos(angle);

    return [leftX, leftY, tipX, tipY, rightX, rightY];
}

/**
 * @description 计算贝塞尔曲线上"标签点"的坐标（名称标签锚点）
 *
 * 默认 t = 0.4，与 computeCubicArrowPoints 的箭头 t 保持一致，
 * 使名称标签落在箭头附近；二者必须同 t，否则会出现"标签离箭头一段距离"的现象。
 * 调用方一般使用默认值即可，不要单独传不同的 t（除非确知在改谁）。
 *
 * @param {BezierPoints} point
 * @param t 计算的点的位置（默认 0.4，与箭头同 t）
 * @returns { x: number, y: number }
 */
export const computeBezierLabelPoint = (point: BezierPoints, t: number = 0.4) => {
    const [sx, sy, cx, cy, dx, dy, ex, ey] = point;
    // 计算贝塞尔曲线上t位置的点坐标
    const ox = 3 * (cx - sx);
    const oy = 3 * (cy - sy);
    const bx = 3 * (dx - cx) - ox;
    const by = 3 * (dy - cy) - oy;
    const ax = ex - sx - ox - bx;
    const ay = ey - sy - oy - by;

    const tSquared = t * t;
    const tCubed = tSquared * t;

    // 点坐标计算
    const x = ax * tCubed + bx * tSquared + ox * t + sx;
    const y = ay * tCubed + by * tSquared + oy * t + sy;

    return { x, y };
}

/**
 * @description 计算直线在终点的2/3处的坐标
 * @param point 直线的起点和终点坐标
 * @param t 位置
 * @returns {x, y, length: 直线的长度}
 */
export const computeLinePoint = (point: LinePoint, t: number = 1 / 3) => {
    const [sx, sy, ex, ey] = point;
    // 计算直线的方向向量
    const dx = ex - sx;
    const dy = ey - sy;
    // 1. 计算t的坐标
    const tx = sx + dx * t;
    const ty = sy + dy * t;

    // 计算直线的长度
    const length = Math.sqrt(dx * dx + dy * dy);

    // 返回直线在t处的坐标
    return {
        x: tx,
        y: ty,
        length
    };
};

/**
 * @description 计算路径在标签点处的切线角度（弧度），供三方设备图标朝向使用
 *
 * 切线与标签点必须使用同一个 t，否则图标朝向与位置错位：
 *   - 直线：与 computeLinePoint 一致，t=1/3（直线任意点切线相同，故直接用起止点）
 *   - 贝塞尔：与 computeBezierLabelPoint 一致，t=0.4（与箭头同 t），复用 getBezierTangent
 *
 * 口径说明：入参 sy/cy/dy/ey 为地图原始 y（与 MapEdge 数据一致），
 *           渲染层统一用 -y，故本函数内部按渲染口径构造取反后的坐标再算切线。
 *
 * @param sx sy ex ey 起止点（sy/ey 为地图原值）
 * @param cx cy dx dy 控制点（cy/dy 为地图原值；直线时传 null）
 * @returns 切线角度（弧度），可直接用于 context.rotate
 */
export const computeEdgeTangentAngle = (
    sx: number, sy: number,
    cx: number | null, cy: number | null,
    dx: number | null, dy: number | null,
    ex: number, ey: number
): number => {
    // 直线：canvas 坐标系下方向向量 = (ex - sx, -ey - (-sy)) = (ex - sx, sy - ey)
    if (cx === null || cy === null || dx === null || dy === null) {
        return Math.atan2(sy - ey, ex - sx);
    }
    // 贝塞尔：复用 t=0.4 处的切线（与 computeBezierLabelPoint 同 t，保证标签/箭头/设备图标三者锚点一致）
    const points: BezierPoints = [sx, -sy, cx, -cy, dx, -dy, ex, -ey];
    const { qx, qy } = getBezierTangent(points, 0.4);
    return Math.atan2(qy, qx);
};

/**
 * @description 计算点逆时针旋转rad弧度后的坐标
 * @param point 点的坐标
 * @param rad 旋转的弧度
 * @returns {x: number, y: number}
 */
export const rotatePointByRad = (point: [number, number], rad: number) => {
    const [x = 0, y = 0] = point;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const radX = x * cos - y * sin;
    const radY = x * sin + y * cos;
    return [radX, radY];
};

/**
 * @description 根据直线的起始点计算直线的平行线
 * @param points 源直线的平行线
 * @param distance 和平行线的距离
 * @returns 平行线的坐标
 */
export const computeParallelLine = (points: LinePoint, distance: number = .5): LinePoint => {
    const [sx, sy, ex, ey] = points;
    // 计算直线的方向向量
    const dx = ex - sx;
    const dy = ey - sy;

    // 计算法向量（垂直于方向向量）
    // 法向量有两个方向：(dy, -dx) 和 (-dy, dx)
    // 这里选择 (dy, -dx)，对应于原直线逆时针旋转90度的方向
    const nx = dy;
    const ny = -dx;

    // 计算法向量的长度
    const length = Math.sqrt(nx * nx + ny * ny);

    // 单位化法向量
    const unitNx = nx / length;
    const unitNy = ny / length;

    // 计算偏移距离（单位化法向量乘以目标距离）
    const offsetX = unitNx * distance;
    const offsetY = unitNy * distance;

    // 计算平行线上的起点和终点坐标
    const parallelStartX = sx + offsetX;
    const parallelStartY = sy + offsetY;
    const parallelEndX = ex + offsetX;
    const parallelEndY = ey + offsetY;

    return [parallelStartX, parallelStartY, parallelEndX, parallelEndY];
};

/**
 * @description 使用自适应辛普森积分法计算三次贝塞尔曲线长度
 * @param {BezierPoints} point 起点x坐标 [sx, sy, ex, ey, cx, cy, dx, dy]
 * @param {number} [tolerance=1e-6] 容差，控制计算精度
 * @returns {number} 曲线长度
 */
export const computeBezierLength = (point: BezierPoints, tolerance = 1e-6) => {
    const [sx, sy, ex, ey, cx, cy, dx, dy] = point;
    // 贝塞尔曲线的导数函数（速度函数）
    function bezierDerivative(t: number) {
        const mt = 1 - t;
        const dxt = 3 * mt * mt * (cx - sx) + 
                   6 * mt * t * (dx - cx) + 
                   3 * t * t * (ex - dx);
        const dyt = 3 * mt * mt * (cy - sy) + 
                   6 * mt * t * (dy - cy) + 
                   3 * t * t * (ey - dy);
        return [dxt, dyt];
    }
    
    // 被积函数：计算在参数t处的速度大小（即导数向量的模）
    function integrand(t: number) {
        const [dxt, dyt] = bezierDerivative(t);
        return Math.sqrt(dxt * dxt + dyt * dyt);
    }
    
    // 自适应辛普森积分实现
    const adaptiveSimpson = (a: number, b: number, fa: number, fb: number, fc: number, tol: number): any => {
        const c = (a + b) / 2;
        const h = b - a;
        const d = (a + c) / 2;
        const e = (c + b) / 2;
        
        const fd = integrand(d);
        const fe = integrand(e);
        
        // 基本辛普森公式
        const S = h / 6 * (fa + 4 * fc + fb);
        // 更精确的辛普森公式
        const S2 = h / 12 * (fa + 4 * fd + 2 * fc + 4 * fe + fb);
        
        if (Math.abs(S2 - S) <= 15 * tol) {
            return S2 + (S2 - S) / 15;
        }
        
        return adaptiveSimpson(a, c, fa, fc, fd, tol / 2) + adaptiveSimpson(c, b, fc, fb, fe, tol / 2);
    }
    
    // 计算初始值
    const fa = integrand(0);
    const fb = integrand(1);
    const fc = integrand(0.5);
    
    return adaptiveSimpson(0, 1, fa, fb, fc, tolerance);
};

/**
 * @description 计算点C在直线A,B上的投影坐标
 * @param ponitA 点A的坐标
 * @param ponitB 点B的坐标
 * @param ponitC 要计算的点的坐标
 * @returns { x: number, y: number }
 */
export const pointInABline = (pointA: [number, number], pointB: [number, number], pointC: [number, number]) => {
    const [x1, y1] = pointA;
    const [x2, y2] = pointB;
    const [x3, y3] = pointC;

    const dotACAB = (x3 - x1) * (x2 - x1) + (y3 - y1) * (y2 - y1);
    const dotABAB = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);

    const t = dotACAB / dotABAB;
    
    const x = x1 + t * (x2 - x1);
    const y = y1 + t * (y2 - y1);

    return { x, y }
}
