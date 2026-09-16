/**
 * @description 元素闪烁 hook
 * 定位到节点/路径后，对目标元素执行 3 秒透明度闪烁高亮。
 * 参考 GraphPixel 组件（c:\code\dd\src\components\GraphPixel）的 startBlink / clearBlink 实现。
 * 通过命令式 setAttrs 直接修改 Konva 节点的 opacity，不依赖 React 重渲染，
 * 因 react-konva 不会管理未声明的 opacity 属性，闪烁期间的透明度不会被覆盖。
 */
import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";

const BLINK_INTERVAL = 300; // 300ms 切换一次透明度
const BLINK_DURATION = 3000; // 持续 3 秒
const MIN_OPACITY = 0.2; // 最暗状态

export const useBlink = () => {
  // 闪烁定时器引用，用于清除闪烁
  const blinkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 当前正在闪烁的元素引用，用于恢复 opacity
  const blinkTargetRef = useRef<Konva.Node | null>(null);

  /** 清除正在进行的闪烁，恢复目标元素 opacity */
  const clearBlink = useCallback(() => {
    if (blinkTimerRef.current) {
      clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }
    // 恢复上一个闪烁元素的 opacity
    if (blinkTargetRef.current) {
      try {
        blinkTargetRef.current.setAttrs({ opacity: 1 });
      } catch {}
      blinkTargetRef.current = null;
    }
  }, []);

  /** 对目标元素执行 3 秒透明度闪烁 */
  const startBlink = useCallback(
    (target: Konva.Node) => {
      // 隐藏元素不闪烁
      if (!target.isVisible()) return;

      // 清除可能残留的闪烁
      clearBlink();
      blinkTargetRef.current = target;

      let opacity = 1;
      const startTime = Date.now();

      blinkTimerRef.current = setInterval(() => {
        // 到达 3 秒后停止并恢复 opacity
        if (Date.now() - startTime >= BLINK_DURATION) {
          clearBlink();
          return;
        }
        // 切换 opacity
        opacity = opacity === 1 ? MIN_OPACITY : 1;
        try {
          target.setAttrs({ opacity });
        } catch {}
      }, BLINK_INTERVAL);
    },
    [clearBlink],
  );

  // 组件卸载时清理闪烁定时器，避免泄漏与残留半透明元素
  useEffect(() => {
    return () => clearBlink();
  }, [clearBlink]);

  return { startBlink, clearBlink };
};
