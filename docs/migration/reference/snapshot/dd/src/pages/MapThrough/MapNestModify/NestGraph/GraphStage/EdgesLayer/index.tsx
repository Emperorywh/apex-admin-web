/**
 * @description 地图编辑-路径Layer（命令式创建）
 * @date 2025-7-8
 *
 * edges prop 仅在地图切换时变化，触发 Shape 重建。
 * 运行时所有操作都通过 Konva 命令式 API。
 */
import { memo, useRef, useEffect } from "react";
import { Layer } from "react-konva";
import Konva from "konva";
import type { MapEdge } from "@/utils/typing";
import { createEdgeShapeConfig } from "@/plugins/konva/shapeFuncs/createShapeConfig";
import { edgeSceneFunc, edgeHitFunc } from "@/plugins/konva/path/edgeDrawFuncs";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";

interface EdgesLayerProps {
    edges: MapEdge[];
}

export default memo((props: EdgesLayerProps) => {

    const { edges } = props;
    const layerRef = useRef<Konva.Layer>(null);

    /** 初始加载 / 地图切换：命令式创建所有路径 Shape */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;

        layer.destroyChildren();
        if (!edges.length) {
            layer.batchDraw();
            return;
        }

        const stage = layer.getStage();
        const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;

        edges.forEach(edge => {
            const config = createEdgeShapeConfig(edge, visualScale);
            const shape = new Konva.Shape({
                ...config,
                sceneFunc: edgeSceneFunc,
                hitFunc: edgeHitFunc,
            });
            layer.add(shape);
        });
        layer.batchDraw();
    }, [edges]);

    return <Layer ref={layerRef} name={MAP_NEST_LAYER_NAME.edges} />;
});
