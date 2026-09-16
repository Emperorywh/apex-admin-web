/**
 * @description 调度监控-三方设备图标Layer（声明式）
 * @date 2026-6-27
 *
 * 在路径标签点处渲染三方设备图标（电梯/自动门/风淋门/交通灯/占位）。
 * 仿 EdgesLayer 声明式 <Shape>，数据源同 EdgesLayer（mountGraphEdges 结果已含设备字段）。
 * listening=false，纯展示（D8）。enableOptimize 时不渲染（与标签一致，性能优化）。
 */
import { useMemo, memo } from "react";
import { Layer, Shape } from "react-konva/lib/ReactKonvaCore";
import { mountGraphEdges } from "@/utils/graph";
import { resolveDeviceType, deviceIconSceneFunc } from "@/plugins/konva/devices";
import type { DeviceIconType } from "@/plugins/konva/devices";
import { computeEdgeTangentAngle } from "@/utils/math";
import type { MapEdge } from "@/utils/typing";

interface DeviceLayerProps {
    edges: MapEdge[];
    visible: boolean;
    enableOptimize: boolean;
    isDark: boolean;
    /** 自适应视觉倍率（来自 visualScaleForReact，写入 data.scale） */
    visualScale: number;
}

/** 预计算的单个设备图标绘制参数 */
interface DeviceShapeItem {
    id: string;
    deviceType: DeviceIconType;
    anchorX: number;
    anchorY: number;
    angle: number;
    isBackEdge: boolean;
}

export default memo((props: DeviceLayerProps) => {

    const { edges, visible, enableOptimize, isDark, visualScale } = props;

    // 复用 mountGraphEdges 的计算（已含 labelX/labelY、userDefinedProperties），仅保留有设备的边
    const deviceShapes = useMemo<DeviceShapeItem[]>(() => {
        const mountEdges = mountGraphEdges(edges);
        const result: DeviceShapeItem[] = [];
        mountEdges.forEach(edge => {
            const { data } = edge;
            const deviceType = resolveDeviceType(data.userDefinedProperties as Record<string, unknown> | null);
            if (!deviceType) return;
            const sx = data.sx as number;
            const sy = data.sy as number;
            const cx = (data.cx ?? null) as number | null;
            const cy = (data.cy ?? null) as number | null;
            const dx = (data.dx ?? null) as number | null;
            const dy = (data.dy ?? null) as number | null;
            const ex = data.ex as number;
            const ey = data.ey as number;
            result.push({
                id: edge.id,
                deviceType,
                // 锚点直接复用 mountGraphEdges 已算好的标签点，保证与路径标签同源
                anchorX: data.labelX as number,
                anchorY: data.labelY as number,
                angle: computeEdgeTangentAngle(sx, sy, cx, cy, dx, dy, ex, ey),
                isBackEdge: !!data.isBackEdge,
            });
        });
        return result;
    }, [edges]);

    // 性能优化模式：元素过多时不渲染设备图标（与标签一致）
    if (enableOptimize) {
        return null;
    }

    return (
        <Layer listening={false} visible={visible}>
            {
                deviceShapes.map(item => (
                    <Shape
                        key={item.id}
                        sceneFunc={deviceIconSceneFunc}
                        listening={false}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                        data={{
                            deviceType: item.deviceType,
                            anchorX: item.anchorX,
                            anchorY: item.anchorY,
                            angle: item.angle,
                            isBackEdge: item.isBackEdge,
                            // 接入自适应视觉倍率（D5）：图标大小随缩放与节点保持比例一致，不再固定 1
                            scale: visualScale,
                            isDark,
                            isSelected: false,
                        }}
                    />
                ))
            }
        </Layer>
    );
});
