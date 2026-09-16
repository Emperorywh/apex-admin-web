/**
 * @description 录制回放-动作角标Layer（声明式）
 * @date 2026-6-28
 *
 * 与 Overlook ActionBadgeLayer 同构。复用 KonvaRender 已计算的 mountNodes/mountEdges（含 actions）。
 * 角标 listening=true 仅供 hover 弹 ActionTooltip（D9/D11）。受 overlayVisible.actions 控制。
 */
import { useMemo } from "react";
import { Layer, Shape } from "react-konva";
import Konva from "konva";
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
import type { MountNode, MountLine, ActionType } from "@/utils/typing";

interface ActionBadgeLayerProps {
    mountNodes: MountNode[];
    mountEdges: MountLine[];
    visible: boolean;
    isDark: boolean;
    onActionHover: (payload: ActionHoverPayload | null) => void;
    /** 自适应视觉倍率（写入 data.scale） */
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

const ActionBadgeLayer = ({ mountNodes, mountEdges, visible, isDark, onActionHover, visualScale }: ActionBadgeLayerProps) => {
    // badgeShapes 的 useMemo 依赖保持 [mountNodes, mountEdges]，【不要】加入 visualScale（只需 data.scale 在 render 取最新）
    const badgeShapes = useMemo<BadgeShapeItem[]>(() => {
        const result: BadgeShapeItem[] = [];
        // 节点角标：锚点 = 节点 canvas 坐标右上角偏移（D6）
        mountNodes.forEach(node => {
            const actions = (node.data as { actions?: ActionType[] }).actions;
            const summary = resolveActionSummary(actions);
            if (!summary) return;
            result.push({
                key: `node-${node.id}`,
                elementId: node.id,
                anchorX: node.x + ACTION_NODE_OFFSET,
                anchorY: node.y - ACTION_NODE_OFFSET,
                count: summary.count,
                severity: summary.severity,
                actions: actions ?? [],
            });
        });
        // 路径角标：锚点 = labelX/labelY 中点下方 + 正反沿法线错开（D7/D13）
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
    }, [mountNodes, mountEdges]);

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
                        scale: visualScale,
                        isDark,
                        isSelected: false,
                    }}
                />
            ))}
        </Layer>
    );
};

export default ActionBadgeLayer;
