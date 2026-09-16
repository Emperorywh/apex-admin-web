/**
 * @description 交管信息集合
 * @date 2025-5-27
 */
import { memo } from "react";
import { Group, Path } from "react-konva/lib/ReactKonvaCore";
import { trafficProperty } from "@/plugins/konva/nodes/traffic";
import type { TrafficPath } from "@/utils/typing";
import type { OverlayVisible } from "@/types/OverLook";

interface TrafficGroupProps {
    applyingPath: TrafficPath[];
    lockedPath: TrafficPath[];
    overlayVisible: OverlayVisible;
}

export default memo((props: TrafficGroupProps) => {

    const { applyingPath, lockedPath, overlayVisible } = props;

    return (
        <Group
            visible={overlayVisible.traffic}
        >
            {
                applyingPath.map((applying, index) => (
                    <Path
                        key={index}
                        listening={false}
                        x={0}
                        y={0}
                        data={applying.data}
                        fill={trafficProperty.applyProperty.fill}
                        stroke={trafficProperty.applyProperty.stroke}
                        strokeWidth={trafficProperty.applyProperty.strokeWidth}
                        dash={trafficProperty.applyProperty.dash}
                        perfectDrawEnabled={false}
                    />
                ))
            }
            {
                lockedPath.map((locked, index) => (
                    <Path
                        key={index}
                        listening={false}
                        x={0}
                        y={0}
                        data={locked.data}
                        fill={trafficProperty.lockedProperty.fill}
                        stroke={trafficProperty.lockedProperty.stroke}
                        strokeWidth={trafficProperty.lockedProperty.strokeWidth}
                        dash={trafficProperty.lockedProperty.dash}
                        perfectDrawEnabled={false}
                    />
                ))
            }
        </Group>
    )
});
