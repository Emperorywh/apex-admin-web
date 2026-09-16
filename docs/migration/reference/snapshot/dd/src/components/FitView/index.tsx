/**
 * @description 自适应窗口的聚焦组件（保持地图旋转角度）
 * @date 2026-6-26
 *
 * 收集 stage 上所有节点（enableSelect="node"）的世界坐标，
 * 调用 fitStageToNodes 让节点完整、居中地显示在视口内。
 * 聚焦保持 stage 当前旋转角度不变，故不再写旋转缓存。
 */
import Konva from "konva";
import { Icon } from "@umijs/max";
import { fitStageToNodes } from "@/utils/bindStage";

export interface FitViewProps {
    stage: Konva.Stage | null;
}

export default (props: FitViewProps) => {

    const { stage } = props;

    const handleFitViewClick = () => {
        if (!stage) return;
        // 节点由 NodesLayer 渲染为 Shape，挂 enableSelect="node" 且 x/y 在 attrs
        const shapes = stage.find<Konva.Shape>("Shape");
        const points = shapes
            .filter(s => s.getAttr("enableSelect") === "node")
            .map(s => ({ x: s.getAttr("x") as number, y: s.getAttr("y") as number }));
        fitStageToNodes(stage, points, {
            animate: true,
            duration: 0.3,
            // 聚焦保持地图当前旋转角度
            keepRotation: true,
        });
    };

    return (
        <Icon icon="local:fit-view" width="20" height="20" onClick={handleFitViewClick} />
    )
};
