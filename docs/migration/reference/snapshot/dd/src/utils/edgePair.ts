/**
 * @description 处理同两节点之间方向相反的两条边（edge pair）相关的工具方法
 *              用于支持「两条贝塞尔曲线轨迹重合时联动调整对方控制点」的能力
 * @date 2026-5-8
 */
import type Konva from "konva";

/**
 * 判断给定的 edge data 是否是一条三次贝塞尔（cx/cy/dx/dy 全部非空）
 * @param {Record<string, any>} data edge.attrs.data
 * @returns {boolean} 是否为有效的贝塞尔曲线数据
 */
const isBezierEdgeData = (data: Record<string, any> | null | undefined): boolean => {
    if (!data) return false;
    const { cx, cy, dx, dy } = data;
    return (
        cx !== null && cx !== undefined &&
        cy !== null && cy !== undefined &&
        dx !== null && dx !== undefined &&
        dy !== null && dy !== undefined
    );
};

/**
 * @description 通过 stage 反查与给定边方向相反、连接同两个节点的另一条 edge Shape
 *              复用 ContextMenu 中通过 snodeId/enodeId 互换匹配的检索方式
 * @param {Konva.Stage | null | undefined} stage 当前 Konva.Stage
 * @param {Record<string, any> | null | undefined} currentData 当前边的 data（包含 snodeId/enodeId）
 * @returns {Konva.Shape | undefined} 反向边的 Shape，找不到时返回 undefined
 */
export const findReverseEdgeShape = (
    stage: Konva.Stage | null | undefined,
    currentData: Record<string, any> | null | undefined
): Konva.Shape | undefined => {
    if (!stage || !currentData) return undefined;
    const { snodeId, enodeId } = currentData;
    if (!snodeId || !enodeId) return undefined;
    // 反向边：snodeId 与 enodeId 互换
    const candidates: Konva.Shape[] = stage.find(
        (shape: Konva.Shape) =>
            shape.attrs?.enableSelect === "edge" &&
            shape.attrs?.data?.snodeId === enodeId &&
            shape.attrs?.data?.enodeId === snodeId
    );
    // 同两节点之间最多 1 条反向边，取第一条即可
    return candidates[0];
};

/**
 * @description 判断两条贝塞尔曲线是否可以联动调整控制点
 *              联动条件：两条都是贝塞尔曲线且连接同一对节点（方向相反）
 *              创建边的唯一性检查保证了同一对节点间最多只有一条正向和一条反向贝塞尔，
 *              因此只要两条贝塞尔曲线连接同一对节点，就视为可联动。
 *              不再要求控制点精确镜像，以兼容手动添加的曲线（控制点未镜像但轨迹实际重合）。
 * @param {Record<string, any> | null | undefined} a 第一条边的 data
 * @param {Record<string, any> | null | undefined} b 第二条边的 data
 * @returns {boolean} 是否可联动（两条都是贝塞尔且连接同一对节点）
 */
export const isBezierOverlapped = (
    a: Record<string, any> | null | undefined,
    b: Record<string, any> | null | undefined
): boolean => {
    if (!isBezierEdgeData(a) || !isBezierEdgeData(b)) return false;
    /**
     * 仅判断两条边是否连接同一对节点（snodeId/enodeId 互换），
     * 不再依赖控制点精确镜像匹配。
     * 手动添加的曲线控制点在各自方向的 1/3 处（AddEdge 的 computeLinePoint
     * 默认参数问题导致两个控制点重合），镜像检查永远失败，
     * 但它们的实际轨迹是重合的，应当允许联动。
     */
    return (
        a!.snodeId === b!.enodeId &&
        a!.enodeId === b!.snodeId
    );
};
