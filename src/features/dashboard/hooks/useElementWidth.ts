/**
 * 容器宽度测量 Hook：SVG 图表按容器实际像素宽度渲染（viewBox 拉伸会变形文字），
 * 通过 ResizeObserver 跟随页签窗口与视口变化。
 */

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const update = () => setWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
