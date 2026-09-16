/**
 * @description 画布交互 hook
 * 缩放（滚轮以鼠标为中心）、拖拽、点击空白清空选中
 */
import type Konva from "konva";
import { useCallback, useRef } from "react";
import {
  DEFAULT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_BY,
} from "../KonvaMap.types";

interface UseStageInteractionOptions {
  stageRef: React.RefObject<Konva.Stage | null>;
  onStageClick: () => void;
  width: number;
  height: number;
}

/**
 * 画布交互 hook
 */
export const useStageInteraction = (options: UseStageInteractionOptions) => {
  const { stageRef, onStageClick, width, height } = options;

  // 记录初始视口状态，用于 resetView
  const initialViewportRef = useRef<{
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);

  /** 滚轮缩放 */
  const handleWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleX = stage.scaleX();
      const scaleY = stage.scaleY();
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? scaleX * SCALE_BY : scaleX / SCALE_BY;

      if (newScale < MIN_SCALE || newScale > MAX_SCALE) return;

      // 以鼠标位置为中心缩放
      const mousePointTo = {
        x: (pointer.x - stage.x()) / scaleX,
        y: (pointer.y - stage.y()) / scaleY,
      };

      stage.scale({ x: newScale, y: newScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      stage.position(newPos);
    },
    [stageRef],
  );

  /** 点击空白 */
  const handleClick = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      // 右键不处理
      if (event.evt.button === 2) return;
      // 点击到 Stage 自身（即空白区域）时清空选中
      const target = event.target;
      if (target === target.getStage()) {
        onStageClick();
      }
    },
    [onStageClick],
  );

  /** 右键菜单阻止 */
  const handleContextMenu = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.evt.preventDefault();
    },
    [],
  );

  /** 计算并应用 fitView */
  const fitView = useCallback(
    (bbox?: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const stage = stageRef.current;
      if (!stage) return;

      if (!bbox) return;

      const bboxWidth = bbox.maxX - bbox.minX;
      const bboxHeight = bbox.maxY - bbox.minY;

      if (bboxWidth === 0 && bboxHeight === 0) return;

      // 计算适配 scale，留 10% 边距
      const padding = 0.9;
      const scaleX = (width * padding) / bboxWidth;
      const scaleY = (height * padding) / bboxHeight;
      let newScale = Math.min(scaleX, scaleY);
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      // 居中
      const centerX = (bbox.minX + bbox.maxX) / 2;
      const centerY = (bbox.minY + bbox.maxY) / 2;

      stage.to({
        x: width / 2 - centerX * newScale,
        y: height / 2 - centerY * newScale,
        scaleX: newScale,
        scaleY: newScale,
        duration: 0.3,
      });

      // 记录为初始视口
      initialViewportRef.current = {
        x: width / 2 - centerX * newScale,
        y: height / 2 - centerY * newScale,
        scaleX: newScale,
        scaleY: newScale,
      };
    },
    [stageRef, width, height],
  );

  /** 初始视口：使用 fitView 逻辑 */
  const applyInitialView = useCallback(
    (bbox?: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const stage = stageRef.current;
      if (!stage) return;

      if (bbox && (bbox.maxX - bbox.minX > 0 || bbox.maxY - bbox.minY > 0)) {
        // 有有效 bbox → fitView
        fitView(bbox);
        return;
      }

      // 无有效 bbox → 回退到默认 scale + 居中
      const fallbackScale = DEFAULT_SCALE;
      stage.scale({ x: fallbackScale, y: fallbackScale });
      stage.position({ x: width / 2, y: height / 2 });

      initialViewportRef.current = {
        x: width / 2,
        y: height / 2,
        scaleX: fallbackScale,
        scaleY: fallbackScale,
      };
    },
    [stageRef, width, height, fitView],
  );

  /** 放大一级 */
  const zoomIn = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const currentScale = stage.scaleX();
    const newScale = Math.min(currentScale * SCALE_BY, MAX_SCALE);
    // 以画布中心缩放
    const center = { x: width / 2, y: height / 2 };
    const mousePointTo = {
      x: (center.x - stage.x()) / currentScale,
      y: (center.y - stage.y()) / currentScale,
    };
    stage.to({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
      scaleX: newScale,
      scaleY: newScale,
      duration: 0.2,
    });
  }, [stageRef, width, height]);

  /** 缩小一级 */
  const zoomOut = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const currentScale = stage.scaleX();
    const newScale = Math.max(currentScale / SCALE_BY, MIN_SCALE);
    const center = { x: width / 2, y: height / 2 };
    const mousePointTo = {
      x: (center.x - stage.x()) / currentScale,
      y: (center.y - stage.y()) / currentScale,
    };
    stage.to({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
      scaleX: newScale,
      scaleY: newScale,
      duration: 0.2,
    });
  }, [stageRef, width, height]);

  /** 重置到初始视口 */
  const resetView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (initialViewportRef.current) {
      stage.to({
        ...initialViewportRef.current,
        duration: 0.3,
      });
    }
  }, [stageRef]);

  /** 定位到指定坐标点，带平滑动画 */
  const focusToPoint = useCallback(
    (
      focusX: number,
      focusY: number,
      scale: number = 125,
      duration: number = 1,
      onFinish?: () => void,
    ) => {
      const stage = stageRef.current;
      if (!stage) return;

      const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      stage.to({
        x: width / 2 - focusX * targetScale,
        y: height / 2 - focusY * targetScale,
        scaleX: targetScale,
        scaleY: targetScale,
        duration,
        onFinish,
      });
    },
    [stageRef, width, height],
  );

  return {
    handleWheel,
    handleClick,
    handleContextMenu,
    fitView,
    applyInitialView,
    zoomIn,
    zoomOut,
    resetView,
    focusToPoint,
  };
};
