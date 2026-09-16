/**
 * @description 把所有节点的样式引入 统一导出
 * @date 2025-6-12
 *
 * 合并说明（v1_dev 与 v2_dev 两条路线融合）：
 * - v1_dev：保留全部 7 种节点类型（node/charge/park/shelf/warehouse_font/warehouse_back/work），
 *   并导出 NodeType 联合类型，供 createNodeShape / nodeTypeOptions / 两个 Modal 约束合法类型。
 * - v2_dev：把 shelf / warehouse_font / warehouse_back 视为废弃类型、砍掉对应样式文件，
 *   改用 getNodeStyle + normalizeNodeType 兜底；并将 5 处渲染/交互调用改为 getNodeStyle。
 * - 融合结论：采用 v1_dev 的 7 种架构（类型可选是既有需求，nodeTypeOptions 已含 7 种），
 *   同时保留 v2_dev 引入的 getNodeStyle（5 个文件依赖它），但其实现改为「直接查表 + 兜底」，
 *   不再用 normalizeNodeType 降级——否则 shelf 会被错误回退为 node，与 7 种架构矛盾。
 */
import { nodeStyle } from "./node";
import { chargeStyle } from "./charge";
import { parkStyle } from "./park";
import { shelfStyle } from "./shelf";
import { warehouseBackStyle } from "./warehouseBack";
import { warehouseFontStyle } from "./warehouseFont";
import { workStyle } from "./work";

/**
 * 全部 8 种节点样式集合，按 NodeType 索引取值。
 * 供 createNodeShape（根据车体建站 / 等距插入节点）按传入类型直接取样式。
 * 注：warehouse 为 v2_dev 新增的兼容类型，样式复用 warehouse_font（库区前点，同为紫色 #EA80FC）。
 */
export const nodeStyles = {
    node: nodeStyle,
    charge: chargeStyle,
    park: parkStyle,
    shelf: shelfStyle,
    warehouse_back: warehouseBackStyle,
    warehouse_font: warehouseFontStyle,
    warehouse: warehouseFontStyle,
    work: workStyle
}

/**
 * 节点类型联合：nodeStyles 的所有 key（共 7 种）。
 * 供 createNodeShape / nodeTypeOptions 等复用，约束为合法的节点类型。
 */
export type NodeType = keyof typeof nodeStyles;

/**
 * 获取节点样式：按 type 直接查 nodeStyles，
 * 未命中（undefined 或未知类型）时回退到 node 兜底，避免解构 undefined 崩溃。
 * 供 graph.ts / createShapeConfig / applyVisualScale / TypeItem / AddNode 等渲染与交互场景使用。
 */
export const getNodeStyle = (type: string | undefined): typeof nodeStyle => {
    // type in nodeStyles 已做运行时校验，此处断言为 NodeType 安全；
    // 用断言而非 Record<string, ...>，以保留 nodeStyles 的精确 key 类型供 NodeType 推导
    if (type && type in nodeStyles) {
        return nodeStyles[type as NodeType];
    }
    return nodeStyles.node;
}
