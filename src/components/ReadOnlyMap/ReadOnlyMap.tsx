/**
 * 只读地图组件（T00.7 共享业务能力，迁移自旧 KonvaMap 选点组件）。
 *
 * 能力边界（迁移规格 11.1 / D06）：只读渲染、平移缩放、节点/路径选点、
 * 定位高亮与回填回调；不引入地图编辑、监控、回放与车辆图层。
 * 消费场景：节点映射选点（P07）、点边组合（P11）、地图关联（P10）等。
 *
 * 数据供给二选一：
 * - mapId：组件内部经 fetchMapGraph（GET /dispatcher/map/getMapInfo）拉取，
 *   加载/失败/空态在组件内闭环（失败渲染 StateBlock offline + 显式重试，
 *   绝不以空画布冒充成功）；
 * - graph：外部直供数据（跳过请求），适合已有上下文复用；数据准确性由调用方负责。
 *
 * 按需加载：konva 体积较大，页面务必以 React.lazy 挂载本组件，
 * 使其与 konva 一起进入异步 chunk（默认导出即为 lazy 便利而设）：
 *   const LazyMap = lazy(() => import('@/components/ReadOnlyMap/ReadOnlyMap'))
 *
 * React 19 兼容：react-konva@19.3.0（peer react ^19.3.0）+ konva@10，
 * 已随 T00.7 核对安装；本组件不使用 Konva.rotation API（全部 sceneFunc
 * 几何绘制），不受全局角度制设置影响，宿主无需配置 Konva.angleDeg。
 */

import type Konva from 'konva'
import { Select, Spin } from 'antd'
import { Stage } from 'react-konva'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import type {
  MapBoundingBox,
  ReadOnlyMapProps,
  ReadOnlyMapRef,
} from '@/components/ReadOnlyMap/ReadOnlyMap.types'
import { MapEdgesLayer } from '@/components/ReadOnlyMap/MapEdgesLayer'
import { MapEdgeHitLayer } from '@/components/ReadOnlyMap/MapEdgeHitLayer'
import { MapNodesLayer } from '@/components/ReadOnlyMap/MapNodesLayer'
import { computeBezierLabelPoint, type BezierPoints } from '@/components/ReadOnlyMap/mapGraphGeometry'
import { mountGraphEdges, mountGraphNodes } from '@/components/ReadOnlyMap/mapGraphMount'
import { useMapBlink } from '@/components/ReadOnlyMap/useMapBlink'
import { useMapGraph } from '@/components/ReadOnlyMap/useMapGraph'
import { useMapSelection } from '@/components/ReadOnlyMap/useMapSelection'
import { useMapStageInteraction } from '@/components/ReadOnlyMap/useMapStageInteraction'

/**
 * 只读地图主组件。
 * ref 暴露视口/选中/定位/重载命令（见 ReadOnlyMapRef）。
 */
export const ReadOnlyMap = forwardRef<ReadOnlyMapRef, ReadOnlyMapProps>(function ReadOnlyMap(props, ref) {
  const {
    mapId,
    graph: externalGraph,
    selectMode = 'node',
    multiple = false,
    onChange,
    width: propWidth,
    height: propHeight,
    showNodeLabels = true,
    showEdgeLabels = false,
    showArrows = true,
    initialSelectedIds,
    defaultFocus,
    disabledNodeTypes,
    onBlankClick,
    className,
    style,
  } = props

  const { t } = useTranslation('map')

  /* ------------------------------ 容器尺寸 ------------------------------ */

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    // 显式尺寸直接采用；否则随父容器自适应（Drawer/Modal 内尺寸多变）
    if (propWidth && propHeight) {
      setContainerSize({ width: propWidth, height: propHeight })
      return
    }
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 0 && h > 0) {
          setContainerSize({ width: Math.floor(w), height: Math.floor(h) })
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [propWidth, propHeight])

  const stageWidth = propWidth ?? containerSize.width
  const stageHeight = propHeight ?? containerSize.height

  /* ------------------------------ 数据供给 ------------------------------ */

  // 外部 graph 优先：传入后内部请求关闭（enabled=false 由 mapId 缺省保证）
  const effectiveMapId = externalGraph ? undefined : mapId
  const { graph: loadedGraph, loading, error, errorText, reload } = useMapGraph(effectiveMapId)
  const graph = externalGraph ?? loadedGraph
  // 稳定化 nodes/edges 引用：避免 graph 为空时每次渲染产生新数组，导致下游 memo/effect 反复重算
  const nodes = useMemo(() => graph?.nodes ?? [], [graph])
  const edges = useMemo(() => graph?.edges ?? [], [graph])

  /* ------------------------------ 选中状态 ------------------------------ */

  const {
    setNodeMap,
    setEdgeMap,
    toggleSelect,
    clearSelection,
    setSelectedIds: setSelectedIdsExternal,
    getSelectedItems,
    getSelectedIds,
    isSelected,
  } = useMapSelection({ multiple, selectMode, onChange })

  useEffect(() => {
    setNodeMap(nodes)
  }, [nodes, setNodeMap])

  useEffect(() => {
    setEdgeMap(edges)
  }, [edges, setEdgeMap])

  // 数据目标变化（mapId 切换 / 外部 graph 更换）时清空选中：
  // 旧选中项不属于新地图，跨图保留会产生"看似选中实则失效"的假回填
  const graphKeyRef = useRef('')
  useEffect(() => {
    const key = effectiveMapId ?? (externalGraph ? `ext:${externalGraph.nodes[0]?.mapId ?? ''}` : '')
    if (graphKeyRef.current !== key) {
      graphKeyRef.current = key
      clearSelection()
    }
  }, [effectiveMapId, externalGraph, clearSelection])

  /* ------------------------------ 渲染模型 ------------------------------ */

  const mountNodes = useMemo(() => mountGraphNodes(nodes), [nodes])
  const mountEdges = useMemo(() => mountGraphEdges(edges), [edges])

  /** 内容包围盒（画布坐标）：节点与全部路径控制点参与，供 fitView */
  const boundingBox = useMemo<MapBoundingBox | undefined>(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const { x, y } of mountNodes) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    for (const edge of edges) {
      const points: Array<[number, number]> = [
        [edge.sx, -edge.sy],
        [edge.ex, -edge.ey],
      ]
      if (edge.cx !== null && edge.cy !== null) points.push([edge.cx, -edge.cy])
      if (edge.dx !== null && edge.dy !== null) points.push([edge.dx, -edge.dy])
      for (const [px, py] of points) {
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
      }
    }
    if (minX === Infinity) return undefined
    return { minX, minY, maxX, maxY }
  }, [mountNodes, edges])

  /* ------------------------------ 视口交互 ------------------------------ */

  const stageRef = useRef<Konva.Stage>(null)

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)

  const handleStageBlankClick = useCallback(() => {
    // 空白点击 = 清空选中（上层可感知：选点弹窗据此禁用确定按钮）
    clearSelection()
    onBlankClick?.()
  }, [clearSelection, onBlankClick])

  const { handleWheel, handleClick, handleContextMenu, fitView, applyInitialView, zoomIn, zoomOut, resetView, focusToPoint } =
    useMapStageInteraction({ stageRef, onStageClick: handleStageBlankClick, width: stageWidth, height: stageHeight })

  /** 触摸点按空白：与鼠标空白点击同一语义（触摸事件无按键概念） */
  const handleStageTap = useCallback(
    (event: Konva.KonvaEventObject<TouchEvent>) => {
      const target = event.target
      if (target === target.getStage()) handleStageBlankClick()
    },
    [handleStageBlankClick],
  )

  /* --------------------------- 定位与高亮闪烁 --------------------------- */

  const { startBlink, clearBlink } = useMapBlink()

  // 聚焦的视觉呈现由 useMapBlink 命令式闪烁承担，无需 React 状态跟踪
  const [locatorValue, setLocatorValue] = useState<string | undefined>(undefined)

  /** 定位到节点；blink 控制定位结束后是否闪烁（首次默认聚焦不闪烁） */
  const focusNode = useCallback(
    (nodeId: string, blink = true) => {
      const mountNode = mountNodes.find((n) => n.id === nodeId)
      if (!mountNode) return
      clearBlink()
      focusToPoint(mountNode.x, mountNode.y, 125, 1, blink
        ? () => {
            const target = stageRef.current?.findOne(`#${nodeId}`)
            if (target) startBlink(target)
          }
        : undefined)
    },
    [mountNodes, focusToPoint, clearBlink, startBlink],
  )

  /** 定位到路径（直线取中点、贝塞尔取 t=0.5 点，聚焦点比名称标签更居中） */
  const focusEdge = useCallback(
    (edgeId: string, blink = true) => {
      const edge = edges.find((e) => e.id === edgeId)
      if (!edge) return

      let focusX: number
      let focusY: number
      if (edge.cx !== null && edge.cy !== null && edge.dx !== null && edge.dy !== null) {
        const bezierPoints: BezierPoints = [edge.sx, -edge.sy, edge.cx, -edge.cy, edge.dx, -edge.dy, edge.ex, -edge.ey]
        const point = computeBezierLabelPoint(bezierPoints, 0.5)
        focusX = point.x
        focusY = point.y
      } else {
        focusX = (edge.sx + edge.ex) / 2
        focusY = (-edge.sy - edge.ey) / 2
      }

      clearBlink()
      focusToPoint(focusX, focusY, 125, 1, blink
        ? () => {
            const target = stageRef.current?.findOne(`#${edgeId}`)
            if (target) startBlink(target)
          }
        : undefined)
    },
    [edges, focusToPoint, clearBlink, startBlink],
  )

  /** 清除定位与闪烁状态 */
  const clearFocus = useCallback(() => {
    clearBlink()
    setLocatorValue(undefined)
  }, [clearBlink])

  /* ---------------------------- 定位搜索下拉 ---------------------------- */

  const locatorOptions = useMemo(() => {
    if (nodes.length === 0 && edges.length === 0) return null
    // Select 数据结构交给 antd options prop：分组节点/路径，label 参与搜索过滤
    return [
      ...(nodes.length > 0
        ? [{ label: t('节点'), title: t('节点'), options: nodes.map((n) => ({ value: `node:${n.id}`, label: n.name })) }]
        : []),
      ...(edges.length > 0
        ? [{ label: t('路径'), title: t('路径'), options: edges.map((e) => ({ value: `edge:${e.id}`, label: e.name })) }]
        : []),
    ]
  }, [nodes, edges, t])

  const handleLocatorSelect = useCallback(
    (value: string | undefined) => {
      setLocatorValue(value)
      if (!value) {
        clearFocus()
        return
      }
      const [type, id] = value.split(':') as ['node' | 'edge', string]
      if (type === 'node') focusNode(id)
      else focusEdge(id)
    },
    [focusNode, focusEdge, clearFocus],
  )

  /* -------------------------- 数据就绪后的初始态 -------------------------- */

  // 初始视口：依赖引用以 loading/graph 就绪为准（夜间大图加载后自动适配）
  const dataReady = !loading && graph !== null
  const initialViewDoneRef = useRef('')
  useEffect(() => {
    if (!dataReady) return
    const key = `${effectiveMapId ?? 'ext'}:${nodes.length}:${edges.length}`
    if (initialViewDoneRef.current === key) return
    initialViewDoneRef.current = key
    applyInitialView(boundingBox)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在数据就绪时适配一次视口
  }, [dataReady])

  // 回显初始选中（失效 ID 由 setSelectedIdsExternal 静默忽略，上层标注原值）
  useEffect(() => {
    if (!dataReady || !initialSelectedIds || initialSelectedIds.length === 0) return
    setSelectedIdsExternal(initialSelectedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在数据就绪时回显一次
  }, [dataReady])

  // 默认聚焦（首次定位不闪烁；用户手动搜索定位才闪烁）
  useEffect(() => {
    if (!dataReady || !defaultFocus || mountNodes.length === 0) return
    const [type, id] = defaultFocus.split(':') as ['node' | 'edge', string]
    if (type === 'node') focusNode(id, false)
    else focusEdge(id, false)
    setLocatorValue(defaultFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在数据就绪时聚焦一次
  }, [dataReady])

  /* ------------------------------ 命令式 API ------------------------------ */

  useImperativeHandle(
    ref,
    () => ({
      fitView: () => fitView(boundingBox),
      zoomIn,
      zoomOut,
      resetView,
      getSelectedItems,
      getSelectedIds,
      clearSelection,
      setSelectedIds: setSelectedIdsExternal,
      focusNode,
      focusEdge,
      clearFocus,
      // 外部直供数据模式下 reload 无操作（数据生命周期归调用方）
      reload: () => reload(),
    }),
    [
      boundingBox, fitView, zoomIn, zoomOut, resetView,
      getSelectedItems, getSelectedIds, clearSelection, setSelectedIdsExternal,
      focusNode, focusEdge, clearFocus, reload,
    ],
  )

  const nodeSelectable = selectMode === 'node' || selectMode === 'all'
  const edgeSelectable = selectMode === 'edge' || selectMode === 'all'
  const hasData = nodes.length > 0 || edges.length > 0

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: propWidth ?? '100%', height: propHeight ?? '100%', position: 'relative', ...style }}
    >
      {/* 未提供任何数据来源：明确提示，不渲染空画布 */}
      {!mapId && !externalGraph ? (
        <div className="flex h-full w-full items-center justify-center text-[14px]" style={{ color: 'var(--app-text-secondary, #999)' }}>
          {t('请传入地图ID')}
        </div>
      ) : null}

      {/* 加载中：遮罩式 Spin */}
      {mapId && !externalGraph && loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spin size="large" tip={t('地图加载中...')} spinning>
            <div className="h-full w-full" />
          </Spin>
        </div>
      ) : null}

      {/* 真正失败：清空区域 + StateBlock offline + 显式重试（DoD 6） */}
      {mapId && !externalGraph && error ? (
        <div className="flex h-full w-full items-center justify-center">
          <StateBlock variant="offline" description={errorText} onRetry={reload} />
        </div>
      ) : null}

      {/* 数据就绪：空地图提示 或 渲染画布 */}
      {graph !== null && !loading && !error ? (
        hasData ? (
          <>
            {/* 左上角定位搜索：按名称快速找到节点/路径并高亮 */}
            {locatorOptions ? (
              <Select
                value={locatorValue}
                onChange={handleLocatorSelect}
                showSearch
                placeholder={t('搜索节点或路径...')}
                optionFilterProp="label"
                style={{ position: 'absolute', top: 12, left: 12, width: 240, zIndex: 10 }}
                popupMatchSelectWidth={240}
                allowClear
                options={locatorOptions}
              />
            ) : null}
            <Stage
              ref={stageRef}
              width={stageWidth}
              height={stageHeight}
              draggable
              onWheel={handleWheel}
              onClick={handleClick}
              onTap={handleStageTap}
              onContextMenu={handleContextMenu}
            >
              {/* 路径视觉层 → 路径命中层 → 节点层（层序决定遮挡关系） */}
              <MapEdgesLayer
                mountEdges={mountEdges}
                showLabels={showEdgeLabels}
                showArrows={showArrows}
                isSelected={isSelected}
                hoveredId={hoveredEdgeId}
              />
              <MapEdgeHitLayer
                mountEdges={mountEdges}
                selectable={edgeSelectable}
                onEdgeClick={toggleSelect}
                onEdgeHover={setHoveredEdgeId}
              />
              <MapNodesLayer
                mountNodes={mountNodes}
                showLabels={showNodeLabels}
                showArrows={showArrows}
                selectable={nodeSelectable}
                disabledNodeTypes={disabledNodeTypes}
                isSelected={isSelected}
                hoveredId={hoveredNodeId}
                onNodeClick={toggleSelect}
                onNodeHover={setHoveredNodeId}
              />
            </Stage>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[14px]" style={{ color: 'var(--app-text-secondary, #999)' }}>
            {t('地图数据为空')}
          </div>
        )
      ) : null}
    </div>
  )
})

/** 默认导出：供页面 React.lazy 按需加载（konva 随本组件进入异步 chunk） */
export default ReadOnlyMap
