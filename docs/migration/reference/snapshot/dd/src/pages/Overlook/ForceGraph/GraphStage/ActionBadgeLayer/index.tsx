/**
 * @description 调度监控-动作角标Layer（声明式）
 * @date 2026-6-28
 *
 * 在节点右上角、路径中点下方渲染动作角标（染色圆 + 内嵌数量）。
 * 仿 DeviceLayer 声明式 <Shape>，数据源同 NodesLayer/EdgesLayer（mountGraphNodes/mountGraphEdges 已含 actions）。
 * 角标 listening=true 仅供 hover 弹 ActionTooltip（D9/D11）。enableOptimize 时不渲染（D15，与标签/设备一致）。
 */
import { useMemo, memo } from "react";
import { Layer, Shape } from "react-konva/lib/ReactKonvaCore";
import Konva from "konva";
import { mountGraphNodes, mountGraphEdges } from "@/utils/graph";
import {
    resolveActionSummary,
    actionBadgeSceneFunc,
    actionBadgeHitFunc,
    ACTION_NODE_OFFSET,
    ACTION_EDGE_NORMAL_OFFSET,
    ACTION_EDGE_OFFSET_Y,
    stageToScreen,
} from "@/plugins/konva/actions";
import type { ActionHoverPayload, ActionSeverity } from "@/plugins/konva/actions";
import { computeEdgeTangentAngle } from "@/utils/math";
import type { MapNode, MapEdge, ActionType } from "@/utils/typing";

interface ActionBadgeLayerProps {
    nodes: MapNode[];
    edges: MapEdge[];
    visible: boolean;
    enableOptimize: boolean;
    isDark: boolean;
    onActionHover: (payload: ActionHoverPayload | null) => void;
    /** 自适应视觉倍率（来自 visualScaleForReact，写入 data.scale） */
    visualScale: number;
}

/** 预计算的单个角标绘制参数 */
interface BadgeShapeItem {
    key: string;
    elementId: string;
    anchorX: number;
    anchorY: number;
    count: number;
    severity: ActionSeverity;
    actions: ActionType[];
}

export default memo((props: ActionBadgeLayerProps) => {

    const { nodes, edges, visible, enableOptimize, isDark, onActionHover, visualScale } = props;

    // 复用 mountGraphNodes/mountGraphEdges（已含 actions），仅保留有动作的节点/路径
    const badgeShapes = useMemo<BadgeShapeItem[]>(() => {
        const result: BadgeShapeItem[] = [];
        // 节点角标：锚点 = 节点 canvas 坐标（mountNode.x/y）右上角偏移（D6）
        const mountNodes = mountGraphNodes(nodes);
        mountNodes.forEach(node => {
            const actions = (node.data as { actions?: ActionType[] }).actions;
            const summary = resolveActionSummary(actions);
            if (!summary) return;
            // 角标位置偏移（ACTION_NODE_OFFSET）保持固定地图坐标，不随 visualScale 缩放
            // （§5.7 权衡：醒目优先 + 零改动成本，仅角标「大小」随缩放）
            result.push({
                key: `node-${node.id}`,
                elementId: node.id,
                anchorX: node.x + ACTION_NODE_OFFSET,
                // canvas 坐标右上 = x+ / y-
                anchorY: node.y - ACTION_NODE_OFFSET,
                count: summary.count,
                severity: summary.severity,
                actions: actions ?? [],
            });
        });
        // 路径角标：锚点 = labelX/labelY 中点下方 + 正反沿法线错开（D7/D13）
        const mountEdges = mountGraphEdges(edges);
        mountEdges.forEach(edge => {
            const { data } = edge;
            const actions = (data as { actions?: ActionType[] }).actions;
            const summary = resolveActionSummary(actions);
            if (!summary) return;
            const sx = data.sx as number;
            const sy = data.sy as number;
            const cx = (data.cx ?? null) as number | null;
            const cy = (data.cy ?? null) as number | null;
            const dx = (data.dx ?? null) as number | null;
            const dy = (data.dy ?? null) as number | null;
            const ex = data.ex as number;
            const ey = data.ey as number;
            const labelX = data.labelX as number;
            const labelY = data.labelY as number;
            const isBackEdge = !!data.isBackEdge;
            // 切线角度决定法线方向（角标本身不旋转 D8，仅位置用法线方向）
            const angle = computeEdgeTangentAngle(sx, sy, cx, cy, dx, dy, ex, ey);
            const nx = -Math.sin(angle);
            const ny = Math.cos(angle);
            const iconSign = isBackEdge ? -1 : 1;
            // 路径角标法线偏移：落在设备图标外侧（更远离路径），与设备图标保持距离（SPEC §3.4/D16）
            const normalOffset = ACTION_EDGE_NORMAL_OFFSET;
            result.push({
                key: `edge-${edge.id}`,
                elementId: edge.id,
                anchorX: labelX + iconSign * nx * normalOffset,
                anchorY: labelY + iconSign * ny * normalOffset + ACTION_EDGE_OFFSET_Y,
                count: summary.count,
                severity: summary.severity,
                actions: actions ?? [],
            });
        });
        return result;
    }, [nodes, edges]);

    // 性能优化模式：元素过多时不渲染动作角标（与标签/设备一致，D15）
    if (enableOptimize) {
        return null;
    }

    return (
        <Layer visible={visible}>
            {badgeShapes.map(item => (
                <Shape
                    key={item.key}
                    sceneFunc={actionBadgeSceneFunc}
                    hitFunc={actionBadgeHitFunc}
                    listening={true}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                    onMouseEnter={(e: Konva.KonvaEventObject<MouseEvent>) => {
                        const stage = e.target.getStage();
                        const screen = stageToScreen(stage, item.anchorX, item.anchorY);
                        onActionHover({ actions: item.actions, screenX: screen.x, screenY: screen.y });
                    }}
                    onMouseLeave={() => onActionHover(null)}
                    data={{
                        anchorX: item.anchorX,
                        anchorY: item.anchorY,
                        count: item.count,
                        severity: item.severity,
                        // 接入自适应视觉倍率（D5）：角标大小随缩放与节点保持比例一致
                        scale: visualScale,
                        isDark,
                        isSelected: false,
                    }}
                />
            ))}
        </Layer>
    );
});
