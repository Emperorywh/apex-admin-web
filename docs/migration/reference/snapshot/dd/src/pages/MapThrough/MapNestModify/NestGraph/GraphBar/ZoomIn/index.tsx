/**
 * @description 工具栏中的放大组件
 * @date 2025-5-21
 */

import Konva from "konva";
import { Icon } from "@umijs/max";
import { useKeyPress } from "ahooks";
import { konvaConfig } from "@/plugins/konva";

export interface ZoomInProps {
    stage: Konva.Stage | null;
}

/**
 * 判断当前焦点是否落在可编辑元素（输入框、文本域、下拉框、富文本）上。
 * useKeyPress 监听的是 window 级别的 keydown，无法通过阻止冒泡拦截，
 * 因此在缩放回调里统一判断焦点：只要正在编辑输入框，就忽略 +/- 缩放快捷键，
 * 避免在输入框里输入 "+" 时触发画布放大。
 */
const isEditingField = (): boolean => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return el.isContentEditable;
};

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
        // 计算中心点
        const width = stage.width();
        const height = stage.height();
        const currentPoint = {
            x: (width / 2 - stage.x()) / scaleX,
            y: (height / 2 - stage.y()) / scaleY,
        };
        const position = {
            x: width / 2 - currentPoint.x * newScaleX,
            y: height / 2 - currentPoint.y * newScaleY,
        };
        // 创建补间动画
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
        if (isEditingField()) return;
        handleZoomInClick();
    })

    return (
        <Icon icon="local:zoom-in" width="20" height="20" onClick={handleZoomInClick} />
    )
};
