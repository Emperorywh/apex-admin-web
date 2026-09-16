/**
 * @description 交管信息集合
 * @date 2025-5-27
 */
import { memo, useMemo } from "react";
import { Group, Path } from "react-konva/lib/ReactKonvaCore";
import { trafficProperty } from "@/plugins/konva/nodes/traffic";
import type { TrafficPath } from "@/utils/typing";
import type { OverlayVisible } from "@/types/OverLook";

interface TrafficGroupProps {
    applyingPath: TrafficPath[];
    lockedPath: TrafficPath[];
    overlayVisible: OverlayVisible;
    /**
     * 交管白名单：仅渲染 agvKey ∈ 此集合的交管路径。
     * 空数组 / undefined = 全显（短路，等价改造前，零开销）。
     * 见 SPEC_traffic_filter_by_vehicle.md §5.2
     */
    visibleAgvKeys?: string[];
}

export default memo((props: TrafficGroupProps) => {

    const { applyingPath, lockedPath, overlayVisible, visibleAgvKeys } = props;

    /**
     * 白名单集合：visibleAgvKeys 非空时构建 Set（O(1) 查找）；
     * 空 / undefined 时为 null，作为「全显短路」标志，避免无谓 filter（SPEC §5.2、§5.7）。
     */
    const visibleSet = useMemo(
        () => (visibleAgvKeys?.length ? new Set(visibleAgvKeys) : null),
        [visibleAgvKeys]
    );
    // 过滤后的申请区：白名单启用时仅保留选中车的申请区，否则原样返回（短路）
    const filteredApplying = visibleSet
        ? applyingPath.filter(p => visibleSet.has(p.agvKey))
        : applyingPath;
    // 过滤后的解锁区：同上
    const filteredLocked = visibleSet
        ? lockedPath.filter(p => visibleSet.has(p.agvKey))
        : lockedPath;

    return (
        <Group
            visible={overlayVisible.traffic}
        >
            {
                filteredApplying.map((applying, index) => (
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
                filteredLocked.map((locked, index) => (
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
