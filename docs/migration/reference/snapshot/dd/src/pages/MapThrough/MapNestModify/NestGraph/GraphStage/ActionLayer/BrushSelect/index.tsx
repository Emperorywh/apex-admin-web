/**
 * @description 框选元素的行为
 * @date 2025-7-8
 */
import { memo, useEffect, useRef } from "react";
import { Rect } from "react-konva";
import Konva from "konva";
import { message } from "antd";
import { isPointsInRect, segmentIntersectsRect, bezierSamplePoints, updateShapeStyle, deselectShape, unSelectShapeEvent } from "@/utils/graph";
import type { ClientRect } from "@/utils/typing";
import { screenToWorld, worldToScreen } from "@/utils/bindStage";
import { selectSameDirectionEdges, selectSameAngleEdges } from "@/utils/sameDirectionEdges";
import { MAP_NEST_STAGE_ATTR } from "@/plugins/konva/runtime/constants";
import { useI18n } from "@/hooks/useI18n";

const rectFill = "rgba(48, 79, 254, .5)";

interface BrushSelectProps {
    stage: Konva.Stage | null;
    manualKey: string;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    /**
     * 框选同向路径一次性模式退出用（SPEC brush_same_direction_contextmenu v2 §6.7）：
     * 有效框选完成或基准失效时调 setManualKey("")，退出模式
     */
    setManualKey: (value: React.SetStateAction<string>) => void;
}

export default memo((props: BrushSelectProps) => {

    const { stage, manualKey, setSelectShapes, setManualKey } = props;

    /* 国际化翻译方法（语言切换会整页刷新，事件闭包内使用无陈旧问题） */ const { t } = useI18n();

    // 当前是不是选中状态
    const isSelect = useRef<boolean>(false);
    // 当前的模式Ref
    const manualKeyRef = useRef<string>("");
    // mousedown 时记录的屏幕坐标，作为选区在屏幕坐标系下的起点
    // 命中检测也基于这个屏幕坐标，保证用户看到的方框 == 实际命中区域
    const startScreenRef = useRef<{ x: number; y: number } | null>(null);

    // 找到在矩形内的点
    // 注意：rectShape / 节点坐标 / 路径端点坐标 全部在"屏幕坐标系"下比较，
    // 这样无论 stage 是否旋转，方框的视觉范围都和命中范围严格一致。
    // 已隐藏的元素不参与框选命中检测
    const findShapesInRect = (shapes: Konva.Shape[], rectShape: ClientRect, st: Konva.Stage) => {
        if (!shapes?.length) return [];
        const inRectShapes: Konva.Shape[] = [];
        shapes.forEach(shape => {
            // 跳过已隐藏的元素
            if (!shape.isVisible()) return;
            const { enableSelect, x = 0, y = 0, data: { sx = 0, sy = 0, ex = 0, ey = 0 } } = shape.attrs;
            if (enableSelect === "node") {
                // 节点世界坐标 → 屏幕坐标 后再做 AABB 测试
                const p = worldToScreen(x, y, st);
                const isNodeInRect = isPointsInRect([[p.x, p.y]], rectShape);
                if (isNodeInRect) {
                    inRectShapes.push(shape);
                }
            }
            if (enableSelect === "edge") {
                const { cx = null, cy = null, dx = null, dy = null } = shape.attrs.data;
                if (cx === null || cy === null || dx === null || dy === null) {
                    // 直线：两端点构成一条线段，与选框做相交检测（精确）
                    // 与原实现保持一致：edge 端点的 y 在数据里是反向的，先翻转再转屏幕坐标
                    const p1 = worldToScreen(sx, -sy, st);
                    const p2 = worldToScreen(ex, -ey, st);
                    const isEdgeInRect = segmentIntersectsRect([[p1.x, p1.y], [p2.x, p2.y]], rectShape);
                    if (isEdgeInRect) {
                        inRectShapes.push(shape);
                    }
                } else {
                    // 曲线：采样 32 个世界点（已含 y 取反）→ 逐个转屏幕坐标 → 相邻两点逐段相交检测
                    const worldPts = bezierSamplePoints(sx, sy, cx, cy, dx, dy, ex, ey, 32);
                    const screenPts = worldPts.map(p => worldToScreen(p.x, p.y, st));
                    for (let i = 0; i < screenPts.length - 1; i++) {
                        const a = screenPts[i];
                        const b = screenPts[i + 1];
                        // 任一采样点在框内 → 命中短路
                        if (isPointsInRect([[a.x, a.y]], rectShape)) {
                            inRectShapes.push(shape);
                            break;
                        }
                        // 相邻采样点构成的小线段与框相交 → 命中
                        if (segmentIntersectsRect([[a.x, a.y], [b.x, b.y]], rectShape)) {
                            inRectShapes.push(shape);
                            break;
                        }
                    }
                }
            }
        });
        return inRectShapes
    };

    // 鼠标按下的事件
    // 让 #selectRect 在视觉上始终"屏幕轴对齐"：
    // 1) rotation = -stage.rotation()，抵消 stage 自身的旋转；
    // 2) x/y 设为起点屏幕坐标对应的世界点，渲染后 Rect 的屏幕原点 == 鼠标按下处；
    // 3) width/height 在 mousemove 里用 屏幕像素差 / stage.scale 换算成 Rect 的 local 尺寸。
    const onStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!["brushSelect", "brushSelectNode", "brushSelectEdge", "brushSelectSameDir", "brushSelectSameAngle"].includes(manualKeyRef.current)) return;
        if (event.target !== event.target.getStage() || event.evt.button === 2 || !stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        startScreenRef.current = { x: pointer.x, y: pointer.y };
        const worldPos = screenToWorld(pointer.x, pointer.y, stage);
        const selectRect = stage.findOne("#selectRect");
        selectRect?.setAttrs({
            visible: true,
            x: worldPos.x,
            y: worldPos.y,
            rotation: -stage.rotation(),
            width: 0,
            height: 0
        });
        isSelect.current = true;
    };

    const onStaheMouseMove = () => {
        if (!isSelect.current || !stage || !startScreenRef.current) return;
        const selectRect = stage.findOne("#selectRect");
        if (!selectRect || !selectRect.attrs.visible) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const start = startScreenRef.current;
        // 屏幕像素差 / scale 才是 Rect 在 local 空间下应有的尺寸
        const screenDx = pointer.x - start.x;
        const screenDy = pointer.y - start.y;
        selectRect?.setAttrs({
            rotation: -stage.rotation(),
            width: screenDx / stage.scaleX(),
            height: screenDy / stage.scaleY()
        })
    };

    const onStageMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isSelect.current || !stage) return;
        // 更新状态
        isSelect.current = false;
        const selectRect = stage.findOne("#selectRect");
        if (!selectRect) return;
        selectRect.setAttrs({
            visible: false
        });
        const start = startScreenRef.current;
        const pointer = stage.getPointerPosition();
        startScreenRef.current = null;
        if (!start || !pointer) return;
        // 屏幕坐标系下的轴对齐选区，width/height 允许为负，isPointsInRect 内部用 min/max 处理
        const screenRect: ClientRect = {
            x: start.x,
            y: start.y,
            width: pointer.x - start.x,
            height: pointer.y - start.y
        };
        // 退化矩形（点击/极小拖拽）视为无效框选，避免误触
        const MIN_BRUSH_PX = 2;
        if (Math.abs(screenRect.width) < MIN_BRUSH_PX || Math.abs(screenRect.height) < MIN_BRUSH_PX) {
            // v2 §4.3：同向模式（拓扑/方向）一次性流程里无效框选不算完成——保持模式与选中，可直接重框
            // （v1 的「非 Ctrl 清空选中」在显式基准下会连基准高亮一起清掉，不再适用）
            if (manualKeyRef.current === "brushSelectSameDir" || manualKeyRef.current === "brushSelectSameAngle") return;
            // 非 ctrl 清空选中；ctrl 无新元素可追加，保持原选中集合不变
            if (!event.evt.ctrlKey) {
                setSelectShapes([]);
            }
            return;
        }
        // 根据manualKey确定筛选节点还是路径或者全部
        // 两种同向模式（brushSelectSameDir/brushSelectSameAngle）与 brushSelectEdge 一样只筛边，再做同向筛选
        const brushSelect =
            manualKeyRef.current === "brushSelectNode" ? ["node"] :
            (manualKeyRef.current === "brushSelectEdge" || manualKeyRef.current === "brushSelectSameDir" || manualKeyRef.current === "brushSelectSameAngle") ? ["edge"] :
            ["node", "edge"];
        // 收集候选元素时排除已隐藏的元素，避免无效计算
        const enableSelectShapes: Konva.Shape[] = stage.find((node: Konva.Shape) => brushSelect.includes(node.getAttrs()?.enableSelect) && node.isVisible());
        // 在矩形内的点
        const hitEdges = findShapesInRect(enableSelectShapes, screenRect, stage);

        // 框选同向模式（拓扑 brushSelectSameDir / 方向 brushSelectSameAngle，
        // SPEC_brush_same_direction_split）：共用显式基准流程，仅筛选算法与提示文案不同
        const isSameDirMode =
            manualKeyRef.current === "brushSelectSameDir" || manualKeyRef.current === "brushSelectSameAngle";
        if (isSameDirMode) {
            // 1. 基准来自进入模式时的快照（stage attr，v2 §6.4），与实时选中态解耦；
            //    两种模式共用同一快照 key，模式由 manualKey 区分
            const baseEdge = stage.getAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge) as Konva.Shape | null;
            // 2. 失效校验（v2 §4.9）：模式期间 Ctrl+Z 删边/地图重载后 shape 悬空（脱离 stage）
            if (!baseEdge || !baseEdge.getStage()) {
                message.warning(t("基准路径已失效"));
                setManualKey("");   // 退出模式，选中集保持原样
                return;
            }
            // 基准之外的命中是否存在（v2 §4.10）：仅框住基准自身时不提示（基准与自身同向）。
            // 不能沿用 v1 的 hitCount > 1——基准可能不在框内，须按 id 显式排除基准判空
            const hasHitBeyondBase = hitEdges.some(e => e.id() !== baseEdge.id());
            // 3. 按模式分派筛选算法（基准放首位）：
            //    - 拓扑模式：双向 BFS + 折返守卫（v2 §4.5），需相邻候选特判；
            //    - 方向模式：弦方向角度完全一致（split §3），不做连通性要求，
            //      A↔B 反向边角度差 180° 天然排除，无需成对结构特判
            let result: Konva.Shape[];
            if (manualKeyRef.current === "brushSelectSameAngle") {
                result = selectSameAngleEdges(baseEdge, hitEdges);
            } else {
                // 相邻候选（成对结构特判，v2 §4.10）：命中里存在基准的下游或上游直接邻边
                // （含被折返守卫排除的反向边）说明基准处于成对/交汇结构，只选基准属正常
                const baseData = baseEdge.attrs?.data ?? {};
                const hasNeighborCandidate = hitEdges.some(e => {
                    const d = e.attrs?.data ?? {};
                    return d.snodeId === baseData.enodeId || d.enodeId === baseData.snodeId;
                });
                result = selectSameDirectionEdges(baseEdge, hitEdges);
                // 无同向提示（v2 §4.10）：基准之外有命中、结果仅剩基准、且无相邻候选
                if (hasHitBeyondBase && result.length === 1 && !hasNeighborCandidate) {
                    message.warning(t("未找到拓扑同向路径"));
                }
            }
            // 方向模式的无同向提示：基准之外有命中、但没有一条角度完全一致
            if (manualKeyRef.current === "brushSelectSameAngle" && hasHitBeyondBase && result.length === 1) {
                message.warning(t("未找到方向同向路径"));
            }
            // 4. 产出结果 + 自动退出模式（v2 §4.2/§4.4/§4.6：Ctrl 不特殊处理，统一覆盖式）。
            //    unSelectShapeEvent 内部有 ctrlKey 守卫，按住 Ctrl 时为 no-op——
            //    由于有效框选发生时旧选中恒 ⊆ 结果（§4.6 论证），两种情况视觉与数组最终一致。
            //    cursor/基准快照清理由 GraphStage 的 manualKey effect 兜底（v2 §6.6）
            unSelectShapeEvent(event);
            setSelectShapes(result);
            // lambda 形式规避 forEach 直传 updateShapeStyle 的签名不兼容（其第二参数 state 与 index 冲突）
            result.forEach(edge => updateShapeStyle(edge));
            setManualKey("");   // 一次性模式：有效框选后自动退出
            return;
        }

        // ============ 其余框选模式：沿用现有逻辑（Ctrl XOR 等）不变 ============
        // console.log("框选中的图形", hitEdges)
        if (event.evt.ctrlKey) {
            // D5：XOR —— 命中的全部翻转（已选→取消，未选→加入）
            const hitIds = new Set(hitEdges.map(s => s.attrs?.id));
            setSelectShapes(selected => {
                // 未被命中的旧选中原样保留；命中的旧选中被移除（翻转）
                const kept = selected.filter(s => !hitIds.has(s.attrs?.id));
                // 命中里未选中的，追加（翻转）
                const toAdd = hitEdges.filter(s => s.attrs?.state !== "selected");
                return [...kept, ...toAdd];
            });
            // 样式分流（与数组同步，§2.5）：命中的已选→还原，命中的未选→设选中
            hitEdges.forEach(shape => {
                if (shape.attrs?.state === "selected") {
                    deselectShape(shape);
                } else {
                    updateShapeStyle(shape);
                }
            });
        } else {
            // 非 Ctrl：覆盖。补 unSelectShapeEvent 还原旧选中样式（顺手修复 §2.6 既有遗漏）
            unSelectShapeEvent(event);
            setSelectShapes(hitEdges);
            hitEdges.forEach(updateShapeStyle);
        }
    };

    const onStageMouseLeave = () => {
        if (!isSelect.current) return;
        // 更新状态
        isSelect.current = false;
        startScreenRef.current = null;
        const selectRect = stage?.findOne("#selectRect");
        if (!selectRect) return;
        selectRect.setAttrs({
            visible: false
        });
    };

    useEffect(() => {
        manualKeyRef.current = manualKey;
    }, [manualKey])

    useEffect(() => {
        if (!stage) return;
        stage.on("mousedown", onStageMouseDown);
        stage.on("mousemove", onStaheMouseMove);
        stage.on("mouseup", onStageMouseUp);
        stage.on("mouseleave", onStageMouseLeave);
        return () => {
            stage.off("mousedown");
            stage.off("mousemove");
            stage.off("mouseup");
            stage.off("mouseleave");
        };
    }, [])

    return (
        <Rect
            id="selectRect"
            visible={isSelect.current}
            x={0}
            y={0}
            width={0}
            height={0}
            fill={rectFill}
        />
    )
});
