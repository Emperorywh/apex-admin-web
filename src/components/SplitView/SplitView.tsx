/**
 * SplitView 布局原语：主从双栏 + 可拖拽分隔条（横向）。
 * - 左栏宽度与折叠状态按 paneKey 持久化到 localStorage（apex-admin:pane:<paneKey>），刷新后还原
 * - 拖拽期间关闭宽度过渡并禁用文本选择；折叠/恢复走动效令牌过渡
 * - 容器语义约定：左栏承载列表 / 导航（Content List），右栏承载详情 / 画布；
 *   「当前所选对象的属性」这类 Inspector 语义浮层走右侧 Drawer，不用本组件承载
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from '@/components/SplitView/SplitView.module.css'

/** 持久化 key 前缀（统一 apex-admin 命名空间） */
const STORAGE_PREFIX = 'apex-admin:pane:'

/** 分隔条占位宽度（px）：拖拽命中区与布局计算共用 */
const DIVIDER_WIDTH = 9

interface SplitViewState {
  width: number
  collapsed: boolean
}

function readState(paneKey: string): SplitViewState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + paneKey)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<SplitViewState>
    if (typeof parsed.width !== 'number' || !Number.isFinite(parsed.width)) return null
    return { width: parsed.width, collapsed: parsed.collapsed === true }
  } catch {
    return null
  }
}

function writeState(paneKey: string, state: SplitViewState): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + paneKey, JSON.stringify(state))
  } catch {
    // 隐私模式等存储不可用场景：静默降级为会话内状态
  }
}

interface SplitViewProps {
  /** 持久化键：同一处布局使用稳定 key，宽度与折叠状态跨会话还原 */
  paneKey: string
  /** 左栏（列表 / 导航） */
  left: ReactNode
  /** 右栏（详情 / 画布），占据剩余宽度 */
  right: ReactNode
  /** 左栏初始宽度（px），无持久化值时生效 */
  defaultLeftWidth?: number
  /** 左栏最小宽度（px） */
  minLeftWidth?: number
  /** 右栏保留的最小宽度（px），拖拽与窗口缩放都不侵入 */
  minRightWidth?: number
  /** 是否提供折叠左栏能力（悬停分隔条出现圆形按钮） */
  collapsible?: boolean
}

export function SplitView({
  paneKey,
  left,
  right,
  defaultLeftWidth = 320,
  minLeftWidth = 240,
  minRightWidth = 320,
  collapsible = true,
}: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const restored = useMemo(() => readState(paneKey), [paneKey])
  const [width, setWidth] = useState(() =>
    Math.max(restored?.width ?? defaultLeftWidth, minLeftWidth),
  )
  const [collapsed, setCollapsed] = useState(() => restored?.collapsed ?? false)
  const [dragging, setDragging] = useState(false)
  /** 拖拽期间固定的容器矩形（拖拽中窗口不变，缓存避免每帧 reflow） */
  const dragRectRef = useRef<DOMRect | null>(null)
  /** 折叠前宽度：恢复时还原到折叠前的位置而非默认值 */
  const widthBeforeCollapseRef = useRef(width)

  useEffect(() => {
    writeState(paneKey, { width, collapsed })
  }, [paneKey, width, collapsed])

  /* 窗口缩放时保证右栏最小宽度：左栏宽度向右栏让位（不重置为默认值） */
  useEffect(() => {
    const clampToViewport = () => {
      const containerWidth = containerRef.current?.clientWidth
      if (containerWidth === undefined || containerWidth === 0) return
      const maxLeft = Math.max(containerWidth - DIVIDER_WIDTH - minRightWidth, minLeftWidth)
      setWidth((prev) => Math.min(prev, maxLeft))
    }
    clampToViewport()
    window.addEventListener('resize', clampToViewport)
    return () => window.removeEventListener('resize', clampToViewport)
  }, [minLeftWidth, minRightWidth])

  const clampWidth = useCallback(
    (next: number): number => {
      const containerWidth = dragRectRef.current?.width ?? containerRef.current?.clientWidth ?? 0
      const maxLeft = Math.max(containerWidth - DIVIDER_WIDTH - minRightWidth, minLeftWidth)
      return Math.min(Math.max(next, minLeftWidth), maxLeft)
    },
    [minLeftWidth, minRightWidth],
  )

  const onDividerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || collapsed) return
    event.preventDefault()
    dragRectRef.current = containerRef.current?.getBoundingClientRect() ?? null
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onDividerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const rectLeft = dragRectRef.current?.left
    if (rectLeft === undefined) return
    setWidth(clampWidth(event.clientX - rectLeft))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragRectRef.current = null
    setDragging(false)
  }

  const toggleCollapse = () => {
    if (!collapsed) {
      widthBeforeCollapseRef.current = width
      setCollapsed(true)
      return
    }
    setCollapsed(false)
    setWidth(Math.max(widthBeforeCollapseRef.current, minLeftWidth))
  }

  return (
    <div ref={containerRef} className={`${styles.split} ${dragging ? styles.dragging : ''}`}>
      <div className={styles.left} style={{ width: collapsed ? 0 : width }}>
        {left}
      </div>
      <div
        className={styles.divider}
        style={collapsed ? { cursor: 'default' } : undefined}
        onPointerDown={onDividerPointerDown}
        onPointerMove={onDividerPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {collapsible ? (
          <button
            type="button"
            className={styles.collapseBtn}
            title={collapsed ? '展开' : '折叠'}
            aria-expanded={!collapsed}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={toggleCollapse}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        ) : null}
      </div>
      <div className={styles.right}>{right}</div>
    </div>
  )
}
