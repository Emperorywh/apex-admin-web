/**
 * @description 区域高亮(独占区/三方交管)的公共工具。
 *              blendColors 从两个 Drawer 抽取去重；removeAreaHighlightFromShape
 *              供 Drawer 的 toggle 全扫描兜底与三类成员变动入口(右键/列表/PathDrawer)
 *              共用，保证"从高亮区域移除成员时立即褪色"(决策 D1/D5)。
 *              调色板 / getAreaColor / splitNodeEdgeGroups / buildAreaColorIndex /
 *              getAreaFocusPosition / focusStageToArea 供监控页(Overlook / RecordPlayback)
 *              的声明式高亮(渲染时查表派生)使用，编辑器两份 Drawer 代码保持原样(D6)。
 */
import type Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { calcStagePosition } from "@/utils/bindStage";

/**
 * 独占区调色板，值与 ExclusiveDrawer.AREA_COLORS 一致(同哈希 + 同调色板 ⇒ 跨页面同色)。
 * ⚠️ 两处必须同值修改：ExclusiveDrawer.AREA_COLORS / 此处，后续可选让 Drawer 改为引用此处去重。
 */
export const EXCLUSIVE_AREA_COLORS: string[] = [
    "#FF6F00", "#2979FF", "#00C853", "#AA00FF", "#FF1744",
    "#00BFA5", "#FFD600", "#F50057", "#00B0FF", "#76FF03",
    "#D500F9", "#FF9100",
];

/**
 * 三方交管调色板，值与 TrafficDrawer.AREA_COLORS 一致。
 * ⚠️ 两处必须同值修改：TrafficDrawer.AREA_COLORS / 此处。
 */
export const TRAFFIC_AREA_COLORS: string[] = [
    "#3F51B5", "#009688", "#795548", "#607D8B", "#E91E63",
    "#9C27B0", "#CDDC39", "#FFC107", "#FF5722", "#8BC34A",
    "#03A9F4", "#F44336",
];

/**
 * 按 areaId 哈希取色(h*31+c 累积 >>> 0，取模调色板长度)。
 * 与两个 Drawer 内的 getAreaColor 实现逐行一致，保证同一区域跨页面颜色相同。
 * @param id 区域ID
 * @param palette 调色板(独占区/三方交管各自独立，有意区分)
 */
export function getAreaColor(id: string, palette: string[]): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = (h * 31 + id.charCodeAt(i)) >>> 0;
    }
    return palette[h % palette.length];
}

/**
 * 按 nodeEdgeGroupType 把 nodeEdgeGroups 拆成独占区/三方交管两组。
 * 容错：groups 为 undefined/null 返回两组空数组；缺 userDefinedProperties 或
 * nodeEdgeGroupType 未知的分组被忽略(不归入任何一组)。
 */
export function splitNodeEdgeGroups(groups?: NodeEdgeGroup[]): {
    exclusiveGroups: NodeEdgeGroup[];
    trafficGroups: NodeEdgeGroup[];
} {
    const exclusiveGroups: NodeEdgeGroup[] = [];
    const trafficGroups: NodeEdgeGroup[] = [];
    (groups || []).forEach(group => {
        const type = group?.userDefinedProperties?.nodeEdgeGroupType;
        if (type === "SINGLE_VEHICLE") exclusiveGroups.push(group);
        else if (type === "TRIPARTITE_TRAFFIC") trafficGroups.push(group);
    });
    return { exclusiveGroups, trafficGroups };
}

/**
 * 声明式高亮的核心：构建 shapeId → 混色 的索引。
 * 仅统计「高亮中」区域的成员；同一 shape 属于多个高亮区域时 blendColors 均值混色(对齐编辑器语义)。
 * 引用不到的成员 id 不进索引(静默容错——索引本就不校验 shape 存在性，查不到即不亮)。
 * 纯函数且每次新建 Map，供调用方 useMemo。
 */
export function buildAreaColorIndex(groups: NodeEdgeGroup[], highlightedIds: Set<string>): Map<string, string> {
    const colorLists = new Map<string, string[]>();
    if (!highlightedIds.size) return new Map();
    groups.forEach(group => {
        // 未高亮的区域不参与
        if (!highlightedIds.has(group.id)) return;
        const areaColor = getAreaColor(group.id, getPaletteByType(group));
        if (!areaColor) return;
        [...(group.nodeIds || []), ...(group.edgeIds || [])].forEach(shapeId => {
            const list = colorLists.get(shapeId);
            if (list) list.push(areaColor);
            else colorLists.set(shapeId, [areaColor]);
        });
    });
    // 收集完再统一均值混色，与编辑器 blendColors(Object.values(colorMap)) 的「全量一次均值」语义一致
    const colorIndex = new Map<string, string>();
    colorLists.forEach((colors, shapeId) => colorIndex.set(shapeId, blendColors(colors)));
    return colorIndex;
}

/** 按分组类型取对应调色板；类型未知(面板不展示、理论上不会高亮)时回退独占区调色板。 */
function getPaletteByType(group: NodeEdgeGroup): string[] {
    return group?.userDefinedProperties?.nodeEdgeGroupType === "TRIPARTITE_TRAFFIC"
        ? TRAFFIC_AREA_COLORS
        : EXCLUSIVE_AREA_COLORS;
}

/**
 * 计算聚焦某区域时 stage 应处的 position(纯计算，不改 stage 状态)。
 * 遍历顺序与编辑器一致(nodeIds → edgeIds)，取第一个 stage.findOne 命中的成员 shape；
 * 坐标取 shape.attrs.x / attrs.y(mountGraphNodes 已做 y: -y 翻转，此即 shape attrs 口径)，
 * 边 shape 无 x/y 属性，回退 data.labelX / labelY(编辑器 ExclusiveDrawer 既有兜底，两处同口径)；
 * 经 calcStagePosition(传入 stage.rotation()，兼容 translate/rotate/scale)换算为
 * 「成员居中于画布中心」的 stage position。
 * 区域无任何可见成员(stage 未挂载 / 成员 id 全部引用不到)返回 null，调用方跳过聚焦。
 */
export function getAreaFocusPosition(stage: Konva.Stage, group: NodeEdgeGroup): { x: number; y: number } | null {
    if (!stage || !group) return null;
    const allIds = [...(group.nodeIds || []), ...(group.edgeIds || [])];
    for (const id of allIds) {
        const shape = stage.findOne(`#${id}`);
        if (!shape) continue;
        const scaleX = stage.scaleX();
        const scaleY = stage.scaleY();
        const rotation = stage.rotation();
        const { x, y, data = {} } = shape.attrs as {
            x?: number;
            y?: number;
            data?: { labelX?: number; labelY?: number };
        };
        const { labelX = 0, labelY = 0 } = data;
        // 用 ?? 避免 0 这种合法坐标被错误地 fallback 到 labelX/Y
        const targetX = x ?? labelX;
        const targetY = y ?? labelY;
        // 兼容地图旋转：用 calcStagePosition 同时考虑 translate/rotate/scale
        return calcStagePosition(
            targetX,
            targetY,
            scaleX,
            scaleY,
            rotation,
            stage.width() / 2,
            stage.height() / 2,
        );
    }
    return null;
}

/**
 * Overlook 用聚焦：getAreaFocusPosition + stage.to({ duration: 0.3 }) 平移。
 * 返回是否实际聚焦(无可见成员返回 false)。
 * 编辑器 Drawer 不改(其内联实现保持原样)。
 */
export function focusStageToArea(stage: Konva.Stage, group: NodeEdgeGroup): boolean {
    const pos = getAreaFocusPosition(stage, group);
    if (!pos) return false;
    stage.to({
        x: pos.x,
        y: pos.y,
        duration: 0.3,
    });
    return true;
}

/**
 * 混合多个十六进制颜色(#RRGGBB)，取 RGB 均值后返回大写 hex。
 * 抽取自独占区/三方交管 Drawer 的同名重复实现，供高亮对账公共使用。
 * @param colors 颜色数组
 * @returns 混色后的颜色字符串
 */
export function blendColors(colors: string[]): string {
    if (colors.length === 0) return "#000000";
    if (colors.length === 1) return colors[0].toUpperCase();
    let r = 0, g = 0, b = 0;
    for (const hex of colors) {
        r += parseInt(hex.slice(1, 3), 16);
        g += parseInt(hex.slice(3, 5), 16);
        b += parseInt(hex.slice(5, 7), 16);
    }
    const n = colors.length;
    return `#${Math.round(r / n).toString(16).padStart(2, "0")}${Math.round(g / n).toString(16).padStart(2, "0")}${Math.round(b / n).toString(16).padStart(2, "0")}`.toUpperCase();
}

/**
 * 从单个 shape 上移除某个区域的高亮条目(按 areaId 精确移除)。
 * - shape 上 highlightColorMap 无该 areaId → 直接返回(幂等：新增成员时调用也安全)。
 * - 移除后仍有其它区域高亮 → 用剩余颜色重新混色并更新 shapeStyle(节点 fill、路径 stroke、label labelFill)。
 * - 移除后无任何区域高亮 → 还原 originalColors，清空 highlightColorMap / originalColors。
 * 不触发 batchDraw，由调用方统一刷新，避免批量场景多次重绘。
 * @param stage Konva 舞台
 * @param areaId 要移除的区域 ID
 * @param shapeId 目标 shape 的 id
 */
export function removeAreaHighlightFromShape(stage: Konva.Stage, areaId: string, shapeId: string): void {
    const shape = stage.findOne(`#${shapeId}`);
    if (!shape) return;
    const colorMap: Record<string, string> = { ...((shape.getAttr("highlightColorMap") as Record<string, string>) || {}) };
    // 无该区域高亮条目，幂等跳过(新增成员/区域未高亮等场景)
    if (!Object.prototype.hasOwnProperty.call(colorMap, areaId)) return;
    delete colorMap[areaId];
    const currentStyle = shape.attrs.shapeStyle || {};
    const isNode = shape.attrs.enableSelect === "node";
    if (Object.keys(colorMap).length === 0) {
        // 无任何高亮区域残留：还原原始颜色
        const originalColors = shape.getAttr("originalColors");
        if (originalColors) {
            shape.setAttrs({
                highlightColorMap: {},
                originalColors: undefined,
                shapeStyle: { ...currentStyle, ...originalColors }
            });
        } else {
            // 兜底：originalColors 缺失（异常态，正常首次染色必写入）时，
            // 至少清掉 highlightColorMap，避免 shape 残留空映射条目
            shape.setAttr("highlightColorMap", {});
        }
    } else {
        // 仍有其它区域高亮：用剩余颜色重新混色(维持 D2 混色语义)
        const blended = blendColors(Object.values(colorMap));
        shape.setAttrs({
            highlightColorMap: colorMap,
            shapeStyle: {
                ...currentStyle,
                fill: isNode ? blended : currentStyle.fill,
                stroke: isNode ? currentStyle.stroke : blended,
                labelFill: blended
            }
        });
    }
}
