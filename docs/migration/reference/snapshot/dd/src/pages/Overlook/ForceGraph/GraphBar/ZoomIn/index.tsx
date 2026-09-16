/**
 * @description 工具栏中的放大组件
 * @date 2025-5-21
 */

import Konva from "konva";
import { Icon } from "@umijs/max";
import { useKeyPress } from "ahooks";
import { konvaConfig } from "@/plugins/konva";
import { screenToWorld, calcStagePosition } from "@/utils/bindStage";

export interface ZoomInProps {
    stage: Konva.Stage | null;
}

export default (props: ZoomInProps) => {

    const { stage } = props;

    const handleZoomInClick = () => {
        if (!stage) return;
        const scaleX = stage.scaleX();
        const scaleY = stage.scaleY();
        const scaleBy = 1.1;
        const newScaleX = scaleX * scaleBy;
        const newScaleY = scaleY * scaleBy;
        if (newScaleX <= konvaConfig.minZoom || newScaleX >= konvaConfig.maxZoom) return;
        const width = stage.width();
        const height = stage.height();
        const centerX = width / 2;
        const centerY = height / 2;
        const worldCenter = screenToWorld(centerX, centerY, stage);
        const position = calcStagePosition(worldCenter.x, worldCenter.y, newScaleX, newScaleY, stage.rotation(), centerX, centerY);
        const tween = new Konva.Tween({
            node: stage,
            duration: .3,
            x: position.x,
            y: position.y,
            scaleX: newScaleX,
            scaleY: newScaleY,
            easing: Konva.Easings.Linear,
        });
        tween.play();
    };

    useKeyPress(187, () => {
        handleZoomInClick();
    })

    return (
        <Icon icon="local:zoom-in" width="20" height="20" onClick={handleZoomInClick} />
    )
};
