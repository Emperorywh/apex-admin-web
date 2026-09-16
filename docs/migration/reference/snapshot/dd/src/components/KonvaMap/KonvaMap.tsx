/**
 * @description KonvaMap 地图选点组件
 * 基于 react-konva + konva 的纯地图渲染 + 选点组件
 * 通过 mapId 调用接口获取地图数据，渲染节点和路径，
 * 支持用户单选/多选节点或路径，选中结果通过受控回调返回给上层。
 *
 * 移植自 config 仓库 src/components/KonvaMap（裁剪复制，见 docs/SPEC_node_mapping_map_picker.md §2）：
 * 已剔除车辆监控层（RobotLayer/useFollowRobot/transformRobots/robotStyles）——
 * 车辆图形按 Konva 默认角度制书写，与 dd 全局弧度制（app.tsx Konva.angleDeg = false）冲突，
 * 且选点场景无车辆需求；节点/路径层全部是自定义 sceneFunc 几何绘制，不受弧度制影响。
 */
import { useI18n } from "@/hooks/useI18n";
import { Select, Spin } from "antd";
import type Konva from "konva";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Stage } from "react-konva/lib/ReactKonvaCore";
import type { KonvaMapProps, KonvaMapRef } from "./KonvaMap.types";
import { useBlink } from "./hooks/useBlink";
import { useMapData } from "./hooks/useMapData";
import { useSelection } from "./hooks/useSelection";
import { useStageInteraction } from "./hooks/useStageInteraction";
import EdgeHitLayer from "./layers/EdgeHitLayer";
import EdgesLayer from "./layers/EdgesLayer";
import NodesLayer from "./layers/NodesLayer";
import { computeBezierLabelPoint } from "./utils/math";
import { mountGraphEdges, mountGraphNodes } from "./utils/mountGraph";

const KonvaMap = forwardRef<KonvaMapRef, KonvaMapProps>((props, ref) => {
  const {
    mapId,
    selectMode = "node",
    multiple = false,
    onChange,
    width: propWidth,
    height: propHeight,
    showNodeLabels = true,
    showEdgeLabels = false,
    showArrows = true,
    initialSelectedIds,
    defaultFocus,
    className,
    style,
    disabledNodeTypes,
    onBlankClick,
    onLoadError,
  } = props;

  const { t } = useI18n();

  // ===== 容器尺寸 =====
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });

  useEffect(() => {
    if (propWidth && propHeight) {
      setContainerSize({ width: propWidth, height: propHeight });
      return;
    }
    // 自适应父容器
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          setContainerSize({ width: Math.floor(w), height: Math.floor(h) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [propWidth, propHeight]);

  const stageWidth = propWidth ?? containerSize.width;
  const stageHeight = propHeight ?? containerSize.height;

  // ===== 数据加载 =====
  const {
    nodes,
    edges,
    loading,
    error: loadError,
    reload,
  } = useMapData(mapId || undefined);

  // 加载失败上报（上层据此渲染错误态 + 重试）
  useEffect(() => {
    if (loadError) onLoadError?.();
  }, [loadError, onLoadError]);

  // ===== 选点状态 =====
  const {
    selectedIds,
    setNodeMap,
    setEdgeMap,
    toggleSelect,
    clearSelection,
    setSelectedIds: setSelectedIdsExternal,
    getSelectedItems,
    getSelectedIds,
    isSelected,
    isSelectable,
  } = useSelection({
    multiple,
    selectMode,
    onChange,
  });

  // 数据变化时更新映射
  useEffect(() => {
    setNodeMap(nodes);
  }, [nodes, setNodeMap]);

  useEffect(() => {
    setEdgeMap(edges);
  }, [edges, setEdgeMap]);

  // mapId 变化时清空选中
  useEffect(() => {
    clearSelection();
  }, [mapId]); // eslint-disable-line react-hooks/exhaustive-deps

  // selectMode 变化时，若当前选中项类型不匹配则清空
  const prevSelectModeRef = useRef(selectMode);
  useEffect(() => {
    if (prevSelectModeRef.current !== selectMode) {
      prevSelectModeRef.current = selectMode;
      // 检查是否有不匹配的选中项
      const hasInvalid = selectedIds.some((id) => !isSelectable(id));
      if (hasInvalid) {
        clearSelection();
      }
    }
  }, [selectMode, selectedIds, isSelectable, clearSelection]);

  // ===== 数据转换 =====
  const mountNodes = useMemo(() => mountGraphNodes(nodes), [nodes]);
  const mountEdges = useMemo(() => mountGraphEdges(edges), [edges]);

  // ===== 计算包围盒 =====
  const boundingBox = useMemo(() => {
    // 收集所有节点和路径端点（已转换后的画布坐标）
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    mountNodes.forEach(({ x, y }) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    // 路径端点也参与包围盒计算
    edges.forEach((edge) => {
      const points = [
        [edge.sx, -edge.sy],
        [edge.ex, -edge.ey],
      ];
      if (edge.cx !== null && edge.cy !== null) {
        points.push([edge.cx, -edge.cy]);
      }
      if (edge.dx !== null && edge.dy !== null) {
        points.push([edge.dx, -edge.dy]);
      }
      points.forEach(([px, py]) => {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      });
    });

    if (minX === Infinity) return undefined;
    return { minX, minY, maxX, maxY };
  }, [mountNodes, edges]);

  // ===== Stage 引用 =====
  const stageRef = useRef<Konva.Stage>(null);

  // ===== Hover 状态 =====
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // ===== 画布交互 =====
  /** 点击空白：清空选中 + 上报 */
  const handleStageBlankClick = useCallback(() => {
    clearSelection();
    onBlankClick?.();
  }, [clearSelection, onBlankClick]);

  const {
    handleWheel,
    handleClick,
    handleContextMenu,
    fitView,
    applyInitialView,
    zoomIn,
    zoomOut,
    resetView,
    focusToPoint,
  } = useStageInteraction({
    stageRef,
    onStageClick: handleStageBlankClick,
    width: stageWidth,
    height: stageHeight,
  });

  // ===== 闪烁高亮（定位后） =====
  const { startBlink, clearBlink } = useBlink();

  // ===== 定位功能 =====
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedType, setFocusedType] = useState<"node" | "edge" | null>(null);
  const [locatorValue, setLocatorValue] = useState<string | undefined>(
    undefined,
  );

  /**
   * 定位到指定节点
   * @param nodeId 节点 ID
   * @param blink 是否在定位动画结束后闪烁高亮，默认 true。
   *              首次加载的默认聚焦应传 false，仅用户手动搜索定位时才闪烁。
   */
  const focusNode = useCallback(
    (nodeId: string, blink = true) => {
      const mountNode = mountNodes.find((n) => n.id === nodeId);
      if (!mountNode) return;
      // 中断可能正在进行的闪烁，定位动画结束后再启动新闪烁
      clearBlink();
      setFocusedId(nodeId);
      setFocusedType("node");
      focusToPoint(
        mountNode.x,
        mountNode.y,
        125,
        1,
        blink
          ? () => {
              const target = stageRef.current?.findOne("#" + nodeId);
              if (target) startBlink(target);
            }
          : undefined,
      );
    },
    [mountNodes, focusToPoint, clearBlink, startBlink],
  );

  /**
   * 定位到指定路径
   * @param edgeId 路径 ID
   * @param blink 是否在定位动画结束后闪烁高亮，默认 true。
   *              首次加载的默认聚焦应传 false，仅用户手动搜索定位时才闪烁。
   */
  const focusEdge = useCallback(
    (edgeId: string, blink = true) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const isBezier =
        edge.cx !== null &&
        edge.cy !== null &&
        edge.dx !== null &&
        edge.dy !== null;

      let focusX: number;
      let focusY: number;

      if (isBezier) {
        // 贝塞尔曲线：传入的 points 数组需先做 Y 取反
        const bezierPoints: [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ] = [
          edge.sx,
          -edge.sy,
          edge.cx!,
          -edge.cy!,
          edge.dx!,
          -edge.dy!,
          edge.ex,
          -edge.ey,
        ];
        const point = computeBezierLabelPoint(bezierPoints, 0.5);
        focusX = point.x;
        focusY = point.y;
      } else {
        // 直线：两个端点的几何中点（Y 取反）
        focusX = (edge.sx + edge.ex) / 2;
        focusY = (-edge.sy - edge.ey) / 2;
      }

      // 中断可能正在进行的闪烁，定位动画结束后再启动新闪烁
      clearBlink();
      setFocusedId(edgeId);
      setFocusedType("edge");
      focusToPoint(
        focusX,
        focusY,
        125,
        1,
        blink
          ? () => {
              const target = stageRef.current?.findOne("#" + edgeId);
              if (target) startBlink(target);
            }
          : undefined,
      );
    },
    [edges, focusToPoint, clearBlink, startBlink],
  );

  /** 清除定位状态 */
  const clearFocus = useCallback(() => {
    clearBlink();
    setFocusedId(null);
    setFocusedType(null);
    setLocatorValue(undefined);
  }, [clearBlink]);

  // mapId 变化时清空定位状态
  useEffect(() => {
    clearFocus();
  }, [mapId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== 定位 Select 数据源 =====
  const locatorOptions = useMemo(() => {
    if (nodes.length === 0 && edges.length === 0) return null;

    return (
      <>
        {nodes.length > 0 && (
          <Select.OptGroup label={t("节点")}>
            {nodes.map((node) => (
              <Select.Option
                key={`node:${node.id}`}
                value={`node:${node.id}`}
                label={node.name}
              >
                {node.name}
              </Select.Option>
            ))}
          </Select.OptGroup>
        )}
        {edges.length > 0 && (
          <Select.OptGroup label={t("路径")}>
            {edges.map((edge) => (
              <Select.Option
                key={`edge:${edge.id}`}
                value={`edge:${edge.id}`}
                label={edge.name}
              >
                {edge.name}
              </Select.Option>
            ))}
          </Select.OptGroup>
        )}
      </>
    );
  }, [nodes, edges]);

  /** 定位 Select 选中回调（allowClear 清空时 value 为 undefined） */
  const handleLocatorSelect = useCallback(
    (value: string | undefined) => {
      setLocatorValue(value);
      if (!value) {
        clearFocus();
        return;
      }
      const [type, id] = value.split(":") as ["node" | "edge", string];
      if (type === "node") {
        focusNode(id);
      } else {
        focusEdge(id);
      }
    },
    [focusNode, focusEdge, clearFocus],
  );

  // 数据加载完成后自动适配视口
  useEffect(() => {
    if (!loading && (mountNodes.length > 0 || mountEdges.length > 0)) {
      applyInitialView(boundingBox);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // 数据加载完成后应用初始选中
  useEffect(() => {
    if (!loading && initialSelectedIds && initialSelectedIds.length > 0) {
      setSelectedIdsExternal(initialSelectedIds);
    }
  }, [loading, initialSelectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // 数据加载完成后应用默认聚焦（首次加载，不闪烁；仅用户手动搜索定位时才闪烁）
  useEffect(() => {
    if (!loading && defaultFocus && mountNodes.length > 0) {
      const [type, id] = defaultFocus.split(":") as ["node" | "edge", string];
      if (type === "node") {
        focusNode(id, false);
      } else {
        focusEdge(id, false);
      }
      setLocatorValue(defaultFocus);
    }
  }, [loading, defaultFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== 命令式 API =====
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
      reload,
    }),
    [
      boundingBox,
      fitView,
      zoomIn,
      zoomOut,
      resetView,
      getSelectedItems,
      getSelectedIds,
      clearSelection,
      setSelectedIdsExternal,
      focusNode,
      focusEdge,
      clearFocus,
      reload,
    ],
  );

  // ===== 渲染参数 =====
  const nodeSelectable = selectMode === "node" || selectMode === "all";
  const edgeSelectable = selectMode === "edge" || selectMode === "all";

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: propWidth ?? "100%",
        height: propHeight ?? "100%",
        position: "relative",
        ...style,
      }}
    >
      {/* 无 mapId 时显示提示 */}
      {!mapId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            color: "#999",
            fontSize: 14,
          }}
        >
          {t("请传入地图ID")}
        </div>
      )}

      {/* 加载中 */}
      {mapId && loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Spin size="large" tip={t("地图加载中...")} spinning>
            <div style={{ width: "100%", height: "100%" }} />
          </Spin>
        </div>
      )}

      {/* 画布 */}
      {mapId && !loading && (
        <>
          {/* 定位下拉框 */}
          {locatorOptions && (
            <Select
              value={locatorValue}
              onChange={handleLocatorSelect}
              showSearch
              placeholder={t("搜索节点或路径...")}
              optionFilterProp="label"
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                width: 240,
                zIndex: 10,
              }}
              popupMatchSelectWidth={240}
              allowClear
              onClear={() => {
                clearFocus();
              }}
            >
              {locatorOptions}
            </Select>
          )}
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            draggable
            onWheel={handleWheel}
            onClick={handleClick}
            onTap={handleClick}
            onContextMenu={handleContextMenu}
          >
            {/* 路径视觉层 */}
            <EdgesLayer
              mountEdges={mountEdges}
              showLabels={showEdgeLabels}
              showArrows={showArrows}
              isSelected={isSelected}
              hoveredId={hoveredEdgeId}
              focusedId={focusedType === "edge" ? focusedId : null}
            />
            {/* 路径点击命中层 */}
            <EdgeHitLayer
              mountEdges={mountEdges}
              selectable={edgeSelectable}
              onEdgeClick={toggleSelect}
              onEdgeHover={setHoveredEdgeId}
            />
            {/* 节点层 */}
            <NodesLayer
              mountNodes={mountNodes}
              showLabels={showNodeLabels}
              showArrows={showArrows}
              selectable={nodeSelectable}
              disabledNodeTypes={disabledNodeTypes}
              isSelected={isSelected}
              hoveredId={hoveredNodeId}
              onNodeClick={toggleSelect}
              onNodeHover={setHoveredNodeId}
              focusedId={focusedType === "node" ? focusedId : null}
            />
          </Stage>
        </>
      )}
    </div>
  );
});

KonvaMap.displayName = "KonvaMap";

export default KonvaMap;
