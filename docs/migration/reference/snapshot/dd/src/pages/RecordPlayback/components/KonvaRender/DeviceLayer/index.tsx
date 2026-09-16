/**
 * @description 录制回放-三方设备图标Layer（声明式）
 * @date 2026-6-27
 *
 * 与 Overlook DeviceLayer 同构。复用 KonvaRender 已计算的 mountEdges（含设备字段）。
 * listening=false，纯展示（D8）。受 overlayVisible.device 控制。
 */
import { memo, useMemo } from "react";
import { Layer, Shape } from "react-konva";
import { resolveDeviceType, deviceIconSceneFunc } from "@/plugins/konva/devices";
import type { DeviceIconType } from "@/plugins/konva/devices";
import { computeEdgeTangentAngle } from "@/utils/math";
import type { MountLine } from "@/utils/typing";

interface DeviceLayerProps {
    mountEdges: MountLine[];
    visible: boolean;
    isDark: boolean;
    /** 自适应视觉倍率（写入 data.scale） */
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

const DeviceLayer = ({ mountEdges, visible, isDark, visualScale }: DeviceLayerProps) => {
    // deviceShapes 的 useMemo 依赖保持 [mountEdges]，不加入 visualScale（仅 data.scale 在 render 取最新）
    const deviceShapes = useMemo<DeviceShapeItem[]>(() => {
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
    }, [mountEdges]);

    return (
        <Layer listening={false} visible={visible}>
            {deviceShapes.map(item => (
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
                        // 设备图标半径随 visualScale 自适应（共享 sceneFunc 已内置 R = DEVICE_BASE_RADIUS * scale）
                        scale: visualScale,
                        isDark,
                        isSelected: false,
                    }}
                />
            ))}
        </Layer>
    );
};

// 默认浅比较：mountEdges（useMemo 稳定）/ visible / isDark / visualScale（原始值）
export default memo(DeviceLayer);
