/**
 * @description Stage 坐标变换工具函数（兼容旋转）
 * @date 2026-4-7
 *
 * Stage 变换矩阵：translate(x, y) * rotate(r) * scale(sx, sy)
 * Konva.angleDeg = false，角度单位为弧度
 */
import Konva from "konva";

/**
 * 屏幕坐标 → 世界坐标
 * 逆变换：scale(1/s) * rotate(-r) * translate(-x, -y) * screenPoint
 */
export function screenToWorld(screenX: number, screenY: number, stage: Konva.Stage) {
    const r = stage.rotation();
    const dx = screenX - stage.x();
    const dy = screenY - stage.y();
    const cos = Math.cos(-r);
    const sin = Math.sin(-r);
    return {
        x: (dx * cos - dy * sin) / stage.scaleX(),
        y: (dx * sin + dy * cos) / stage.scaleY(),
    };
}

/**
 * 世界坐标 → 屏幕坐标
 * 正变换：translate(x, y) * rotate(r) * scale(s) * worldPoint
 * 与 screenToWorld 严格互逆
 */
export function worldToScreen(worldX: number, worldY: number, stage: Konva.Stage) {
    const r = stage.rotation();
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const sx = worldX * stage.scaleX();
    const sy = worldY * stage.scaleY();
    return {
        x: sx * cos - sy * sin + stage.x(),
        y: sx * sin + sy * cos + stage.y(),
    };
}

/**
 * 世界坐标 → 屏幕坐标偏移，返回 stage 需要设置的 position
 * 使得 worldPoint 恰好显示在 (anchorX, anchorY) 屏幕位置
 */
export function calcStagePosition(
    worldX: number,
    worldY: number,
    scaleX: number,
    scaleY: number,
    rotation: number,
    anchorX: number,
    anchorY: number,
) {
    const sx = worldX * scaleX;
    const sy = worldY * scaleY;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
        x: anchorX - (sx * cos - sy * sin),
        y: anchorY - (sx * sin + sy * cos),
    };
}

/**
 * 将用户在屏幕上看到的视觉偏移量转换为世界坐标偏移量
 * offsetX 表示屏幕向右（米），offsetY 表示屏幕向上（米）
 * 当 stage 有旋转时，视觉方向与世界坐标轴不对齐，
 * 需要将偏移向量反向旋转回世界坐标系
 */
export function visualOffsetToWorld(offsetX: number, offsetY: number, stageRotation: number) {
    const cos = Math.cos(stageRotation);
    const sin = Math.sin(stageRotation);
    return {
        dx: offsetX * cos - offsetY * sin,
        dy: offsetX * sin + offsetY * cos,
    };
}

/** 角度转弧度 */
export function degToRad(deg: number) {
    return deg * Math.PI / 180;
}

/** 弧度转角度 */
export function radToDeg(rad: number) {
    return rad * 180 / Math.PI;
}

/**
 * @description 让给定的世界坐标点集合完整、居中地显示在 stage 视口内
 * @date 2026-6-25
 *
 * Konva 没有开箱即用的自适应 API，此处自行实现：
 * 求节点包围盒 → 算缩放比（含留白）→ 算居中 position → 应用到 stage。
 *
 * Stage 变换：translate(x, y) * rotate(r) * scale(s)
 *
 * - keepRotation=false（默认）：fit 后 stage 旋转重置为 0，position 直接复用
 *   calcStagePosition。向后兼容初始化等场景。
 * - keepRotation=true：保持 stage 当前旋转角度 r 不变。此时世界点经 R(r)
 *   旋转后才在屏幕上铺开，因此需在"旋转后的屏幕方向坐标系"里求 AABB：
 *   对每个世界点 w 计算 R(r)·w 得到屏幕方向坐标，据此求 bbox 与 scale；
 *   居中时把 bbox 中心世界点用 calcStagePosition（传真实 r）映射到视口中心。
 */
export interface FitOptions {
    /** 四周留白比例（向中心外扩），默认 0.1 即四周各留 10% */
    paddingRatio?: number;
    /** 空地图 / 退化场景的回退缩放，默认 60（沿用历史初始化值） */
    defaultScale?: number;
    /** 是否动画过渡，默认 false */
    animate?: boolean;
    /** 动画时长（秒），默认 0.3 */
    duration?: number;
    /** 是否保持 stage 当前旋转角度不变（默认 false，即重置为 0） */
    keepRotation?: boolean;
}

/** 世界坐标点 */
export interface FitPoint {
    x: number;
    y: number;
}

/** fit 应用结果，供调用方做后续操作（如写旋转缓存） */
export interface FitResult {
    scale: number;
    x: number;
    y: number;
}

/**
 * 将 fit 结果应用到 stage。
 * rotation 由调用方决定（keepRotation 时为当前角度，否则为 0）。
 */
function applyFit(stage: Konva.Stage, result: FitResult, rotation: number, animate: boolean, duration: number) {
    if (animate) {
        // 与 ZoomIn 按钮风格一致：Konva.Tween 同时过渡缩放/旋转/位置
        const tween = new Konva.Tween({
            node: stage,
            duration,
            scaleX: result.scale,
            scaleY: result.scale,
            rotation,
            x: result.x,
            y: result.y,
            easing: Konva.Easings.Linear,
        });
        tween.play();
    } else {
        stage.scale({ x: result.scale, y: result.scale });
        stage.rotation(rotation);
        stage.position({ x: result.x, y: result.y });
    }
}

/**
 * 让给定的世界坐标点集合完整、居中地显示在 stage 视口内。
 *
 * @param stage Konva.Stage 实例
 * @param points 世界坐标点集合（通常为节点的 x/y）
 * @param opts 可选项
 * @returns 应用的 { scale, x, y }；若 stage 尺寸为 0（未挂载）则返回 null，不应用任何变换
 */
export function fitStageToNodes(
    stage: Konva.Stage,
    points: FitPoint[],
    opts?: FitOptions,
): FitResult | null {
    const {
        paddingRatio = 0.1,
        defaultScale = 60,
        animate = false,
        duration = 0.3,
        keepRotation = false,
    } = opts ?? {};

    const viewW = stage.width();
    const viewH = stage.height();
    // stage 未挂载，视口尺寸为 0，直接放弃
    if (viewW <= 0 || viewH <= 0) return null;

    // fit 后保留的旋转角度：keepRotation 时取当前角度，否则归零
    const rotation = keepRotation ? stage.rotation() : 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // 有效点过滤
    const valid = (points ?? []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (valid.length === 0) {
        // 空地图回退：默认缩放 + 原点居中（按当前 rotation 映射）
        const { x, y } = calcStagePosition(0, 0, defaultScale, defaultScale, rotation, viewW / 2, viewH / 2);
        const result: FitResult = { scale: defaultScale, x, y };
        applyFit(stage, result, rotation, animate, duration);
        return result;
    }

    /**
     * 求包围盒。
     * keepRotation 时世界点先经 R(r) 旋转才在屏幕上铺开，需在"旋转后的屏幕方向
     * 坐标系"里取 AABB 才能正确贴合视口；否则直接用世界坐标。
     */
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of valid) {
        const bx = p.x * cos - p.y * sin;
        const by = p.x * sin + p.y * cos;
        if (bx < minX) minX = bx;
        if (by < minY) minY = by;
        if (bx > maxX) maxX = bx;
        if (by > maxY) maxY = by;
    }

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    // 单点 / 共线退化，bbox 某一维度为 0，会导致除零，回退默认缩放
    if (bboxW === 0 || bboxH === 0) {
        const { x, y } = calcStagePosition(0, 0, defaultScale, defaultScale, rotation, viewW / 2, viewH / 2);
        const result: FitResult = { scale: defaultScale, x, y };
        applyFit(stage, result, rotation, animate, duration);
        return result;
    }

    // 四周留白（向中心外扩）
    const paddedW = bboxW * (1 + 2 * paddingRatio);
    const paddedH = bboxH * (1 + 2 * paddingRatio);
    const scale = Math.min(viewW / paddedW, viewH / paddedH);

    /**
     * 居中。
     * - 旋转坐标系下 bbox 中心为 (midx, midy)，需反算回世界坐标中心：
     *   因为 R(r)·w = (bx, by)，故 w = R(-r)·(bx, by)。
     * - r=0 时 cos=1/sin=0，直接等于世界坐标，分支自然合一。
     */
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const cx = midX * cos + midY * sin;
    const cy = -midX * sin + midY * cos;
    // 用真实 rotation 把世界中心点映射到视口中心
    const { x, y } = calcStagePosition(cx, cy, scale, scale, rotation, viewW / 2, viewH / 2);

    const result: FitResult = { scale, x, y };
    applyFit(stage, result, rotation, animate, duration);
    return result;
}
