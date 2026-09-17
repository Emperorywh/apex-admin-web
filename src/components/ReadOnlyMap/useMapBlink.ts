/**
 * 定位高亮闪烁（T00.7，迁移自旧 KonvaMap/hooks/useBlink，行为一致）。
 *
 * 通过命令式 setAttrs 直接修改 Konva 节点 opacity 实现 3 秒闪烁，
 * 不经 React 状态：react-konva 不管理未声明的 opacity 属性，
 * 闪烁期间不会被声明式渲染覆盖；组件卸载时清理定时器并恢复透明度。
 */

import type Konva from 'konva'
import { useCallback, useEffect, useRef } from 'react'

/** 闪烁切换周期（毫秒） */
const BLINK_INTERVAL_MS = 300
/** 闪烁总时长（毫秒） */
const BLINK_DURATION_MS = 3000
/** 最暗透明度 */
const MIN_OPACITY = 0.2

export function useMapBlink() {
  const blinkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blinkTargetRef = useRef<Konva.Node | null>(null)

  /** 停止闪烁并恢复目标元素透明度 */
  const clearBlink = useCallback(() => {
    if (blinkTimerRef.current) {
      clearInterval(blinkTimerRef.current)
      blinkTimerRef.current = null
    }
    if (blinkTargetRef.current) {
      try {
        blinkTargetRef.current.setAttrs({ opacity: 1 })
      } catch (error) {
        // 元素可能已随数据重建被销毁：恢复失败无需处理，静默即可
        console.debug('闪烁元素恢复失败（可能已销毁）', error)
      }
      blinkTargetRef.current = null
    }
  }, [])

  /** 对目标元素执行 3 秒透明度闪烁（隐藏元素不闪烁） */
  const startBlink = useCallback(
    (target: Konva.Node) => {
      if (!target.isVisible()) return
      clearBlink()
      blinkTargetRef.current = target

      let opacity = 1
      const startTime = Date.now()
      blinkTimerRef.current = setInterval(() => {
        if (Date.now() - startTime >= BLINK_DURATION_MS) {
          clearBlink()
          return
        }
        opacity = opacity === 1 ? MIN_OPACITY : 1
        try {
          target.setAttrs({ opacity })
        } catch (error) {
          // 同上：闪烁中元素被重建时终止闪烁即可
          console.debug('闪烁元素更新失败（可能已销毁）', error)
          clearBlink()
        }
      }, BLINK_INTERVAL_MS)
    },
    [clearBlink],
  )

  // 卸载清理：避免定时器泄漏与残留半透明元素
  useEffect(() => {
    return () => clearBlink()
  }, [clearBlink])

  return { startBlink, clearBlink }
}
