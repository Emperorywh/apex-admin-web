/**
 * @description 地图编辑-三方设备图标Layer（命令式创建）
 * @date 2026-6-27
 *
 * 在路径标签点处渲染三方设备图标（电梯/自动门/风淋门/交通灯/占位）。
 * 仿 EdgesLayer 命令式 new Konva.Shape。
 * 图标 listening=true：点击设备图标即选中其所属路径（GraphStage.onStageClick 按 edgeId 重定向），
 * hover 时显示 pointer 手势（GraphStage.onStageMouseMove）。
 * 路径选中时图标联动高亮（D19），由 selectShapes 驱动。
 *
 * 几何/类型刷新机制：
 *   - 初始加载 / 地图切换 / 主题切换：由 edges/isDark 变化触发，调用 refreshDeviceIcons 全量重建；
 *   - 运行时编辑（拖动节点/控制点、修改设备类型）：由各编辑点直接调用 refreshDeviceIcons，
 *     从 edge Shape 的实时 data 重建，保证图标跟随路径移动、随设备类型增删立即响应。
 *   - visualScale 缩放：仅更新 data.scale（不重建，性能更优）。
 */
import { memo, useRef, useEffect } from "react";
import { Layer } from "react-konva/lib/ReactKonvaCore";
import Konva from "konva";
import type { MapEdge } from "@/utils/typing";
import { refreshDeviceIcons } from "@/plugins/konva/devices";
import { MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";

interface DeviceLayerProps {
    edges: MapEdge[];
    visible: boolean;
    /** 自适应视觉倍率（与 GraphStage 的 visualScaleForReact 同源），图标半径与法线偏移据此自适应 */
    visualScale: number;
    /** 是否暗黑主题 */
    isDark: boolean;
    /** 当前选中的元素（用于设备图标选中联动高亮 D19） */
    selectShapes: Konva.Shape[];
}

export default memo((props: DeviceLayerProps) => {

    const { edges, visible, visualScale, isDark, selectShapes } = props;
    const layerRef = useRef<Konva.Layer>(null);
    // 用 ref 持有最新 visualScale，避免它进入重建 effect 依赖导致每次缩放都重建
    const visualScaleRef = useRef(visualScale);
    visualScaleRef.current = visualScale;

    /**
     * 初始加载 / 地图切换 / 主题切换：全量重建设备图标。
     * refreshDeviceIcons 从 edge Shape 的实时 data 读取几何与设备类型，
     * 与运行时编辑点共用同一套刷新逻辑，避免两套数据源割裂。
     * edges/isDark 仅作为触发器（地图数据/主题变化时驱动重建）。
     *
     * 通过 options 显式传入 isDark/visualScale 的最新 prop 值：React effect 子先于父执行，
     * DeviceLayer 的 isDark effect 早于 GraphStage 的 setAttr(isDark)，若让 refresh 改读
     * stage attr 会读到旧值，故此处用 prop 覆盖值保证主题切换即时生效。
     */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        const stage = layer.getStage();
        if (!stage) return;
        refreshDeviceIcons(stage, { isDark, visualScale: visualScaleRef.current });
    }, [edges, isDark]);

    /** visualScale 变化：仅更新 data.scale 并重绘（不重建 Shape） */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        (layer.find("Shape") as Konva.Shape[]).forEach(shape => {
            const data = shape.getAttrs()?.data;
            if (!data) return;
            shape.setAttr("data", { ...data, scale: visualScale });
        });
        layer.batchDraw();
    }, [visualScale]);

    /** 选中联动（D19）：路径选中时其设备图标联动高亮 */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        const selectedIds = new Set(selectShapes.map(shape => shape.id()));
        (layer.find("Shape") as Konva.Shape[]).forEach(shape => {
            const data = shape.getAttrs()?.data;
            if (!data?.edgeId) return;
            shape.setAttr("data", { ...data, isSelected: selectedIds.has(data.edgeId) });
        });
        layer.batchDraw();
    }, [selectShapes]);

    return <Layer ref={layerRef} name={MAP_NEST_LAYER_NAME.devices} visible={visible} />;
});
