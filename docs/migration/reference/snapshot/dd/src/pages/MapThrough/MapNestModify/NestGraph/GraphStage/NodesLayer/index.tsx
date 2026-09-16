/**
 * @description 地图编辑-节点Layer（命令式创建）
 * @date 2025-7-8
 *
 * nodes prop 仅在地图切换时变化，触发 Shape 重建。
 * 运行时所有操作（visualScale、拖拽、属性修改等）都通过 Konva 命令式 API，
 * 不再依赖 React re-render 或 useMemo。
 */
import { memo, useRef, useEffect } from "react";
import { Layer } from "react-konva/lib/ReactKonvaCore";
import Konva from "konva";
import type { MapNode } from "@/utils/typing";
import { createNodeShapeConfig } from "@/plugins/konva/shapeFuncs/createShapeConfig";
import { nodeSceneFunc, nodeHitFunc } from "@/plugins/konva/shapeFuncs/nodeSceneFunc";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";
import { useI18n } from "@/hooks/useI18n";

export interface NodesLayerProps {
    nodes: MapNode[];
}

export default memo((props: NodesLayerProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { nodes } = props;
    const layerRef = useRef<Konva.Layer>(null);

    /** 初始加载 / 地图切换：命令式创建所有节点 Shape */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;

        // 清除旧节点（地图切换时）
        layer.destroyChildren();
        if (!nodes.length) {
            layer.batchDraw();
            return;
        }

        const stage = layer.getStage();
        // 从 stage attr 获取当前 visualScale
        const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;

        nodes.forEach(node => {
            const config = createNodeShapeConfig(node, visualScale);
            const shape = new Konva.Shape({
                ...config,
                hitFunc: nodeHitFunc,
                sceneFunc: nodeSceneFunc,
            });
            layer.add(shape);
        });
        layer.batchDraw();
    }, [nodes]); // 仅在 nodes 数据变化时重建（地图切换）

    return <Layer ref={layerRef} name={MAP_NEST_LAYER_NAME.nodes} />;
});
