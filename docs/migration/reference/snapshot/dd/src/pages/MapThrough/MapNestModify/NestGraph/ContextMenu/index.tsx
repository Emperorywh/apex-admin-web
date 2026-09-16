/**
 * @description 右键菜单组件
 * @date 2025-7-17
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Dropdown, message, Modal, Spin } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { ContextMenuType, NodeEdgeGroup } from "@/types/MapNestModify";
import type { LinePoint, BezierPoints } from "@/utils/typing";
import { nextNameByShapes, updateShapeStyle, deselectShape } from "@/utils/graph";
import { alignTwoPointsLine } from "@/utils/align";
import { computeLineArrowPoints, computeCubicArrowPoints, computeBezierLabelPoint, computeLinePoint } from "@/utils/math";
import { getRandomString } from "@/utils/public";
import { removeAreaHighlightFromShape } from "@/utils/areaHighlight";
import Konva from "konva";
import { menuItems } from "@/constants/mapThrough";
import { saveSnapshot } from "@/utils/undoHistory";
import { collectConnectedComponent, groupCandidatesByComponent } from "@/utils/nearbyElements";
import { defaultPathProperty } from "@/plugins/konva/path/defaultPathProperty";
import { refreshDeviceIcons } from "@/plugins/konva/devices";
import { refreshActionBadges } from "@/plugins/konva/actions";
import { forwardPath } from "@/plugins/konva/path/forwardPath";
import { reversePath } from "@/plugins/konva/path/reversePath";
import { edgeSceneFunc, edgeHitFunc } from "@/plugins/konva/path/edgeDrawFuncs";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";
import CreateNodeByRobotModal from "./CreateNodeByRobotModal";
import EvenlyInsertModal from "./EvenlyInsertModal";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
/**
 * 独占区/三方交管 4 个单向一级项的纯逻辑工具：
 * 解析操作范围（resolveOperateMembers）、生成区域子菜单（buildAreaChildren）。
 * 单向 apply 函数（applyAddToGroup/applyRemoveToGroup）由 handleAreaClick 在点击时调用。
 * message 反馈直接内联在 handleAreaClick，不再抽 notifyBatchResult。
 */
import { resolveOperateMembers, buildAreaChildren, applyAddToGroup, applyRemoveToGroup } from "./batchAreaMember";

const { confirm } = Modal;

interface ContextMneuProps {
    useMapId: string;
    contextMenu: ContextMenuType;
    selectShapes: Konva.Shape[];
    trafficGroups: NodeEdgeGroup[];
    exclusiveGroups: NodeEdgeGroup[];
    setContextMenu: (value: React.SetStateAction<ContextMenuType>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    /**
     * 框选同向路径入口（SPEC brush_same_direction_contextmenu v2 §6.3）：
     * 点菜单项后切到 brushSelectSameDir 模式，由 NestGraph 传入（NestGraph 已持有该 setter）
     */
    setManualKey: (value: React.SetStateAction<string>) => void;
}

export default memo((props: ContextMneuProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    /*
     * 右键菜单编辑权限（SPEC §7.6 / G1）
     * 后端 map-edit 下仅有 map-edit:update 一个按钮码，右键菜单全部细粒度操作
     * （删除/添加反向路径/批量删除/创建节点/等距插入/对齐/独占组/交管组）无独立码。
     * 故有 map-edit:update → 右键菜单全功能可用；无 → 右键菜单整体不渲染。
     * 仅覆盖右键菜单，非编辑器全局只读（属性面板/工具栏/拖拽等写入口本批次不控权）。
     *
     * canEdit 必须在 useMemo 之外预先计算并加入依赖数组：useAccess 每次渲染返回新闭包，
     * 权限「下次登录生效」(B15) 会话期间稳定，故 canEdit 是稳定布尔值，入依赖无性能顾虑。
     */
    const { hasPerm } = useAccess();
    const canEdit = hasPerm(PERM_BUTTON.MAP_EDIT_UPDATE);

    const { useMapId, contextMenu: { open = false, left = -1000, top = -1000, event, nearbyCandidates = [] }, selectShapes, trafficGroups, exclusiveGroups, setContextMenu, setSelectShapes, setTrafficGroups, setExclusiveGroups, setManualKey } = props;

    const openRef = useRef<boolean>(open);

    // 根据车体创建节点 Modal 状态：open + 右键时记录的车体 agvKey + stage 引用（确认时由 Modal 实时重查车体）
    const [createNodeModal, setCreateNodeModal] = useState<{ open: boolean; agvKey?: string; stage: Konva.Stage | null }>({ open: false, stage: null });

    // 等距插入节点 Modal 状态：open + 右键时记录的 stage（A、B 由 selectShapes 实时读取）
    const [insertModal, setInsertModal] = useState<{ open: boolean; stage: Konva.Stage | null }>({ open: false, stage: null });

    // 批量删除进行中遮罩：flushSync 同步渲染，确保万级删除前 spinner 先 paint 到屏幕
    const [deleting, setDeleting] = useState<boolean>(false);

    // 区分展示哪种菜单
    const { items } = useMemo(() => {
        // 过滤出当前右键命中类型适用的菜单项（§4.5.1）。
        // 4 个区域一级项的"有区域"守卫（D9）：某类型无区域则对应两项隐藏，
        // 与 enable 基础过滤并列在同一个 filter 内。
        const filteredItems = menuItems.filter(item => {
            // 无编辑权限：右键菜单整体不渲染（§7.6 / G1）
            if (!canEdit) return false;
            if (event?.target.getStage() === event?.target) {
                if (!item.enable.includes("stage")) return false;
                // stage 命中时，4 个区域一级项仍需有区域才显示（与 node/edge 分支一致）
                if (item.key === "addToExclusiveGroup" || item.key === "removeFromExclusiveGroup") {
                    return !!exclusiveGroups?.length;
                }
                if (item.key === "addToTrafficGroup" || item.key === "removeFromTrafficGroup") {
                    return !!trafficGroups?.length;
                }
                return true;
            } else if (event?.target.attrs.enableSelect === "node" || event?.target.attrs.enableSelect === "edge") {
                if (item.key === "addToExclusiveGroup" || item.key === "removeFromExclusiveGroup") {
                    return !!exclusiveGroups?.length;
                }
                if (item.key === "addToTrafficGroup" || item.key === "removeFromTrafficGroup") {
                    return !!trafficGroups?.length;
                }
                return item.enable.includes(event?.target.attrs.enableSelect);
            } else if (event?.target.attrs.isRobot) {
                return item.enable.includes("robot");
            } else {
                return false;
            }
        });

        // 解析本次右键的操作范围（D4）：命中∈选中集或 stage 空白右键 → 整个 selectShapes，否则仅命中元素
        const operateMembers = resolveOperateMembers(event, selectShapes);

        /**
         * 构造「选择附近元素」子菜单项（SPEC §5.7.1）。
         * 每项仅展示路径名，保持候选列表简洁。
         * 候选为空 → 返回 []，使一级项被下方 every 置灰（与区域项无区域时同机制，§2.5）。
         * 最多显示 30 项，超出追加 disabled 提示项（§3.13）。
         *
         * 分组优化：候选按「所属连通分量」聚拢展示（用 antd Menu 的 type:"group"）。
         * 典型重叠场景（SPEC §1.2）下，半径内常含多个互不连通的子图，
         * 按分量聚拢后，组内即"点其中任意一条会一起被选中的那批"，
         * 用户无需逐项试错即可判断点哪条带出哪些。
         * 单组（所有候选同属一个分量，或候选 ≤ 1）时不分组，避免冗余标题。
         */
        const buildNearbyChildren = (): MenuProps["items"] => {
            const stage = event?.target?.getStage?.();
            const candidates = nearbyCandidates ?? [];
            if (!candidates.length || !stage) return [];  // 空 → 一级项置灰（§2.5）

            const MAX = 30;  // §3.13
            // 先按 SPEC §3.13 截断到 MAX 项，再对截断后的列表分组
            const limited = candidates.slice(0, MAX);
            // 并查集按连通分量聚拢；组内按 distance 升序，组间按"组内最小 distance"升序
            const groups = groupCandidatesByComponent(stage, limited);

            // 单项 / 单组：保持平铺，避免冗余的"组 1（N 条）"标题
            if (groups.length <= 1) {
                const flat = groups.length === 1 ? groups[0] : limited;
                const flatItems = flat.map(c => ({
                    key: c.shape.attrs?.id,           // 子菜单 key = edge id
                    label: c.shape.attrs?.data?.name ?? "",
                    danger: false,
                    disabled: false
                }));
                if (candidates.length > MAX) {
                    flatItems.push({
                        key: "__nearby_overflow__",
                        label: t("还有 {count} 项未显示", { count: candidates.length - MAX }),
                        danger: false,
                        disabled: true
                    });
                }
                return flatItems as MenuProps["items"];
            }

            // 多组：用 antd Menu type:"group" 把同分量的候选项聚拢；
            // group 项本身不可点击、不出现在 keyPath 里，点击子项时 keyPath 仍含 selectNearbyElements + edgeId
            const groupedItems: NonNullable<MenuProps["items"]> = groups.map((g, idx) => ({
                key: `__nearby_group_${idx}__`,
                type: "group" as const,
                label: t("组 {index}（{count} 条）", { index: idx + 1, count: g.length }),
                children: g.map(c => ({
                    key: c.shape.attrs?.id,
                    label: c.shape.attrs?.data?.name ?? "",
                    danger: false,
                    disabled: false
                }))
            }));
            // 超出截断提示（§3.13）——追加在最末，不归属任何组
            if (candidates.length > MAX) {
                groupedItems.push({
                    key: "__nearby_overflow__",
                    label: t("还有 {count} 项未显示", { count: candidates.length - MAX }),
                    danger: false,
                    disabled: true
                });
            }
            return groupedItems as MenuProps["items"];
        };

        // 给 4 个区域一级项挂上按操作范围生成的区域子菜单（§4.5.2 + §4.5.3）。
        // buildAreaChildren：members 为空（未框选 + stage 右键）→ 返回 []，使一级项在下方 every 中被置灰（D8）。
        // label 由 computeAddItem / computeRemoveItem 内部经 t() 翻译（t 透传给 buildAreaChildren）。
        const itemsWithChildren = filteredItems.map(item => {
            let children: { key: string; label: string; danger: boolean; disabled: boolean }[] | undefined = undefined;
            if (item.key === "addToExclusiveGroup") {
                children = buildAreaChildren(exclusiveGroups, operateMembers, "add", t);
            } else if (item.key === "removeFromExclusiveGroup") {
                children = buildAreaChildren(exclusiveGroups, operateMembers, "remove", t);
            } else if (item.key === "addToTrafficGroup") {
                children = buildAreaChildren(trafficGroups, operateMembers, "add", t);
            } else if (item.key === "removeFromTrafficGroup") {
                children = buildAreaChildren(trafficGroups, operateMembers, "remove", t);
            } else if (item.key === "selectNearbyElements") {
                // 新增：附近元素候选（来自右键时计算的 nearbyCandidates，SPEC §5.7.2）
                children = buildNearbyChildren() as any;
            }
            // D7 + D8：一级项 disabled ⟺ children 非空且全部 disabled
            // （children 为 undefined 表示非区域项，保持原 disabled；
            //  children 为 [] 表示未框选，every 空 = true → 一级项置灰不可展开）
            const itemDisabled = children ? children.every(c => c.disabled) : item.disabled;
            return { ...item, children: children as MenuProps["items"], disabled: itemDisabled };
        });

        // 仅"恰好选中两个节点"时"等距插入节点""两点对齐"可点（§4.5.4，沿用原逻辑）
        const twoNodesSelected =
            selectShapes.length === 2 &&
            selectShapes.every(s => s.attrs?.enableSelect === "node");
        // v2 §4.1：恰好左键选中 1 条路径时「框选拓扑/方向同向路径」才可点；
        // 选中 0 条 / 多条 / 含节点时置灰（与 twoNodesSelected 同机制）
        const exactlyOneEdge =
            selectShapes.length === 1 &&
            selectShapes[0].attrs?.enableSelect === "edge";
        const finalItems = itemsWithChildren.map(item => {
            const mapped = item.key === "evenlyInsertNodes" || item.key === "alignTwoPoints"
                ? { ...item, disabled: !twoNodesSelected }
                : item.key === "brushSelectSameDir" || item.key === "brushSelectSameAngle"
                    ? { ...item, disabled: !exactlyOneEdge }
                    : item;
            // 顶级菜单项的中文 label 翻译为当前语言（children 已翻译，保持不变）
            return {
                ...mapped,
                label: typeof mapped.label === "string" ? t(mapped.label) : mapped.label
            };
        });
        return { items: finalItems }
    }, [selectShapes, event?.target?.getType(), exclusiveGroups, trafficGroups, canEdit, nearbyCandidates])

    // 删除单个元素
    const destroyShape = (shape: Konva.Shape) => {
        const stage = shape.getStage();
        const { attrs } = shape;
        setSelectShapes(shapes => shapes.filter(shape => shape.attrs?.id !== attrs?.id));
        if (attrs?.enableSelect === "node") {
            const relativeEdges: Konva.Shape[] | undefined = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge" && (shape.attrs?.data?.snodeId === attrs?.id || shape.attrs?.data?.enodeId === attrs?.id));
            relativeEdges?.forEach(edge => {
                edge.destroy();
                setSelectShapes(shapes => shapes.filter(shape => shape.attrs?.id !== edge?.attrs?.id));
            })
        }
        shape.destroy();
        /**
         * 删除走的是命令式 shape.destroy()：既不触发 React 重渲染，也不会更新
         * GraphStage 的 nodes/edges props。若不主动通知，AnglesLayer 会一直停留在
         * 删除前的夹角。这里派发 angles:refresh，让夹角层立刻基于当前 stage 重新
         * 收集几何并重算（批量删除时多次 fire 会被 rAF 合流为一次 setState）。
         */
        stage?.fire("angles:refresh", {} as any);
        /**
         * 同理，设备图标/动作角标两个独立装饰图层也感知不到命令式删除：
         * 已删边上的图标/角标不重建就会残留为孤儿（与批量删除同一修复口径）。
         */
        if (stage) {
            refreshDeviceIcons(stage);
            refreshActionBadges(stage);
        }
    };

    /**
     * 批量删除的真正执行（同步、会阻塞主线程）。
     *
     * 旧实现复用 destroyShape 逐元素销毁，在万级选中集下会退化到接近 O(n²)：
     *   - 每个元素各触发一次 setSelectShapes（n 次 setState，每次又是 O(n) 的 filter）；
     *   - 每个节点各做一次 stage.find 找关联边（n × 全树）；
     *   - 每个元素各 fire 一次 angles:refresh。
     * 这里改为一次性收集 + 批量销毁：
     *   - 仅 1 次 stage.find 收集所有待删边；
     *   - 仅 1 次 setSelectShapes([]) 清空选中集；
     *   - 仅 1 次 angles:refresh 刷新夹角层。
     * 语义与逐元素销毁等价：选中节点删除时，以其为端点的边（孤儿边）一并删除。
     */
    const doBatchDelete = () => {
        const stage = selectShapes[0]?.getStage?.() ?? event?.target?.getStage?.();
        if (!stage) return;
        saveSnapshot();

        // 选中节点 id 集合：删除这些节点后，以其为端点的边会变成孤儿，需一并删除
        const selectedNodeIds = new Set<string>();
        // 选中边 id 集合：直接命中删除
        const selectedEdgeIds = new Set<string>();
        selectShapes.forEach(s => {
            const t = s.attrs?.enableSelect;
            const id = s.attrs?.id;
            if (typeof id !== "string") return;
            if (t === "node") selectedNodeIds.add(id);
            else if (t === "edge") selectedEdgeIds.add(id);
        });

        // 一次性遍历全部边，收集待删边：
        //   ① 被选中的边（selectedEdgeIds 命中）；
        //   ② 任一端点为选中节点的边（节点删除后的孤儿边）。
        // 等价于旧 destroyShape 里"删节点时 stage.find 关联边"的累积效果，
        // 但把 O(节点数 × 全树) 的重复全树扫描降到 O(边数) 的单次遍历。
        const allEdgeShapes = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge") as Konva.Shape[];
        const edgesToDestroy: Konva.Shape[] = [];
        allEdgeShapes.forEach(s => {
            const id = s.attrs?.id;
            if (typeof id === "string" && selectedEdgeIds.has(id)) {
                edgesToDestroy.push(s);
                return;
            }
            const data = s.attrs?.data;
            if (data && (selectedNodeIds.has(data.snodeId) || selectedNodeIds.has(data.enodeId))) {
                edgesToDestroy.push(s);
            }
        });

        // 统一销毁：边在前、节点在后（与单元素 destroyShape 的销毁顺序保持一致）
        edgesToDestroy.forEach(e => e.destroy());
        selectShapes.forEach(s => {
            if (s.attrs?.enableSelect === "node") s.destroy();
        });

        // 单次清空选中集：等价于旧逻辑逐元素 filter 后的最终空数组，
        // 但从 O(n²) 的 n 次 setState 降为 1 次，彻底消除级联重渲染。
        setSelectShapes([]);
        /**
         * 删除后重建三方设备图标与动作角标（与节点拖动/控制点拖动同一编辑点口径）：
         * 两个装饰图层都是独立 Layer 全量重建模式，shape.destroy() 只删路径/节点本身，
         * 已删边上的设备图标/角标 Shape 不刷新就会残留为孤儿。
         * 均从 stage 实时 attrs 读取 isDark/visualScale/onActionHover，无需传 options。
         */
        refreshDeviceIcons(stage);
        refreshActionBadges(stage);
        // 单次刷新夹角层：旧逻辑每元素 fire 一次（靠 AnglesLayer 内部 rAF 合流），
        // 这里显式只 fire 一次，语义一致且无多余事件派发。
        stage.fire("angles:refresh", {} as any);
    };

    // 批量删除
    const onBatchDeleteShape = () => {
        if (!selectShapes?.length) {
            message.warning(t("当前没有选中的元素"));
            return;
        }
        confirm({
            title: t("确定要删除选中的元素吗?"),
            icon: <ExclamationCircleFilled />,
            content: t("删除后不可恢复"),
            onOk: () => {
                /**
                 * loading 显示的难点：React 18 concurrent 调度下，message.loading / 按钮 loading
                 * 的 setState 会被延迟 commit，万级同步删除一旦阻塞主线程，loading 就来不及 paint
                 * （实测：删除完成后才闪一下）。这里改用受控遮罩 + flushSync + 双 rAF：
                 *   1) flushSync(setDeleting(true)) 同步把遮罩 commit 到 DOM，绕过调度延迟；
                 *   2) 双 requestAnimationFrame：第一帧让浏览器把遮罩 paint 到屏幕，
                 *      第二帧再执行会阻塞主线程的 doBatchDelete；
                 *   3) finally 兜底 setDeleting(false)，异常时也能收起遮罩。
                 * 遮罩的 spinner 是 CSS 动画，由合成线程驱动，主线程阻塞期间仍持续转动。
                 */
                flushSync(() => setDeleting(true));
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        try {
                            doBatchDelete();
                        } finally {
                            setDeleting(false);
                        }
                    });
                });
            },
            onCancel() {
                // .
            },
        });
    };

    // 删除节点或者删除边的shape
    const onDeleteShape = () => {
        if (!event?.target) return;
        saveSnapshot();
        const { target } = event;
        destroyShape(target as Konva.Shape);
    };

    // 选中反向路径
    const onSelectReverseEdge = () => {
        if (!event?.target) return;
        const { target } = event;
        const stage = target.getStage();
        const data = target.attrs?.data;
        if (!stage || !data) return;
        const { snodeId, enodeId } = data;
        const reverseEdges: Konva.Shape[] = stage.find(
            (shape: Konva.Shape) =>
                shape.attrs?.enableSelect === "edge" &&
                shape.attrs?.data?.snodeId === enodeId &&
                shape.attrs?.data?.enodeId === snodeId
        );
        if (reverseEdges.length) {
            const selectedShapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.state === "selected");
            // 复用 deselectShape 还原选中样式，消除与 unSelectShapeEvent 的重复逻辑（§6.2）
            selectedShapes.forEach(deselectShape);
            reverseEdges.forEach(edge => updateShapeStyle(edge));
            setSelectShapes(reverseEdges);
        } else {
            message.warning(t("未找到反向路径"));
        }
    };

    // 添加反向路径
    const onAddReverseEdge = () => {
        if (!event?.target) return;
        const { target } = event;
        const stage = target.getStage();
        const data = target.attrs?.data;
        if (!stage || !data) return;
        const { snodeId, enodeId, edgeType, sx, sy, ex, ey, cx, cy, dx, dy, isBackEdge, mapId, loadType, allowVehicleGroup, actions, userDefinedProperties, avoidMap, forward_avoid, reverse_avoid } = data;

        const existing: Konva.Shape[] = stage.find(
            (shape: Konva.Shape) =>
                shape.attrs?.enableSelect === "edge" &&
                shape.attrs?.data?.snodeId === enodeId &&
                shape.attrs?.data?.enodeId === snodeId &&
                shape.attrs?.data?.edgeType === edgeType
        );
        if (existing.length) {
            message.warning(t("反向路径已存在"));
            return;
        }

        saveSnapshot();
        const id = getRandomString();
        const newIsBackEdge = false;
        const isBezier = edgeType === "BEZIER";

        const newSx = ex;
        const newSy = ey;
        const newEx = sx;
        const newEy = sy;
        const newCx = isBezier ? dx : null;
        const newCy = isBezier ? dy : null;
        const newDx = isBezier ? cx : null;
        const newDy = isBezier ? cy : null;

        let arrowPoints;
        let labelPos;
        if (isBezier) {
            const bezierPoints: BezierPoints = [newSx, -newSy, newCx!, -newCy!, newDx!, -newDy!, newEx, -newEy];
            arrowPoints = computeCubicArrowPoints(bezierPoints);
            labelPos = computeBezierLabelPoint(bezierPoints);
        } else {
            const linePoints: LinePoint = [newSx, -newSy, newEx, -newEy];
            arrowPoints = computeLineArrowPoints(linePoints);
            labelPos = computeLinePoint(linePoints);
        }

        const edgeShapes: Konva.Shape[] = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge") || [];
        const nextName = nextNameByShapes(edgeShapes);

        const stroke = newIsBackEdge ? reversePath.stroke : forwardPath.stroke;
        const labelFill = newIsBackEdge ? reversePath.labelFill : forwardPath.labelFill;
        /**
         * 从 stage attr 读取 visualScale 计算 lineWidth
         */
        const visualScale = stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
        const lineWidth = (newIsBackEdge ? reversePath.lineWidth : forwardPath.lineWidth) * visualScale;

        const newData = {
            ...defaultPathProperty,
            id,
            name: nextName,
            mapId: mapId || useMapId,
            edgeType,
            sx: newSx,
            sy: newSy,
            cx: newCx,
            cy: newCy,
            dx: newDx,
            dy: newDy,
            ex: newEx,
            ey: newEy,
            isBackEdge: newIsBackEdge,
            snodeId: enodeId,
            enodeId: snodeId,
            loadType: loadType ?? 0,
            allowVehicleGroup: allowVehicleGroup ?? [],
            actions: actions ?? [],
            userDefinedProperties: userDefinedProperties ?? null,
            avoidMap: avoidMap ?? 0,
            forward_avoid,
            reverse_avoid,
            arrowPoints,
            labelX: labelPos.x,
            labelY: labelPos.y
        };

        const style = { labelFill, stroke, lineWidth };
        /**
         * 新路径必须挂到 edgesLayer
         */
        const edgesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.edges}`) as Konva.Layer | undefined;
        const layer = edgesLayer || (target as Konva.Shape).getLayer();
        if (layer) {
            const newShape = new Konva.Shape({
                id,
                shapeStyle: style,
                data: newData,
                state: "",
                enableSelect: "edge",
                hitStrokeWidth: Math.max(lineWidth * 5, 0.1),
                perfectDrawEnabled: false,
                shadowForStrokeEnabled: false,
                sceneFunc: edgeSceneFunc,
                hitFunc: edgeHitFunc
            });
            layer.add(newShape);
            message.success(t("反向路径已添加"));
        }
    };

    /**
     * 4 个区域一级项统一的点击处理（D3 + D14 + D15 + D18 + D19 + D20）。
     * 把 4 个分支的共同逻辑（解析范围 → 守卫 → 快照 → apply → 褪色 → setState → message）收敛为一处，
     * 仅以 type / mode 两个参数区分数据源与单向语义。
     * @param type 独占区 / 三方交管（决定数据源 groups 与 setter setGroups）
     * @param mode 添加 / 移除（决定 apply 函数、褪色与否、message 文案）
     * @param groupId 目标区域 id（菜单项 key）
     */
    const handleAreaClick = (
        type: "exclusive" | "traffic",
        mode: "add" | "remove",
        groupId: string
    ) => {
        const groups = type === "exclusive" ? exclusiveGroups : trafficGroups;
        const setGroups = type === "exclusive" ? setExclusiveGroups : setTrafficGroups;

        // 解析操作范围（D4）：stage 空白右键或命中∈选中集 → 整个 selectShapes，否则仅命中元素
        const operateMembers = resolveOperateMembers(event, selectShapes);
        // 守卫：操作范围为空（不应触发——未框选时一级项已置灰不可点；此处防御性 return）
        if (!operateMembers.length) return;

        const targetGroup = groups.find(g => g.id === groupId);
        // 守卫前置：targetGroup 找不到（区域被并发删除等）时直接 return，
        // 必须在 saveSnapshot 之前，否则会压入"无操作"的空快照，污染 undo 栈
        if (!targetGroup) return;

        saveSnapshot(); // 整个批量算 1 次快照（D19）

        // 单向 apply：添加只加不移、移除只移不加；幂等跳过越界成员（D3）
        const result = mode === "add"
            ? applyAddToGroup(targetGroup, operateMembers)
            : applyRemoveToGroup(targetGroup, operateMembers);

        // D18：仅移除分支需褪色（被移除成员 = 操作前已在区域内的）；添加分支幂等不褪色
        if (mode === "remove") {
            const removedIds = operateMembers
                .filter(m => (m.type === "node" ? targetGroup.nodeIds : targetGroup.edgeIds).includes(m.id))
                .map(m => m.id);
            const stage = event?.target?.getStage();
            if (stage) {
                // removeAreaHighlightFromShape 内部 findOne 容错：shape 不存在则跳过
                removedIds.forEach(id => removeAreaHighlightFromShape(stage, groupId, id));
                stage.batchDraw();
            }
        }

        setGroups(gs => gs.map(g =>
            g.id !== groupId ? g : { ...g, nodeIds: result.nodeIds, edgeIds: result.edgeIds }
        ));

        // D14 + D15：仅批量（length > 1）反馈，单元素静默；只报实际增减总数（changed），不提跳过数。
        // 防御性守卫 result.changed > 0：正常路径下区域项 disabled 已拦截"全已在/全不在"的点击，
        // 不会进入此分支；此处兜底防止异常穿透时弹出"已添加 0 个"的丑陋 message。
        if (operateMembers.length > 1 && result.changed > 0) {
            const name = targetGroup.name;
            if (mode === "add") {
                message.success(t("已添加 {count} 个元素到【{name}】", { count: result.changed, name }));
            } else {
                message.success(t("已移除 {count} 个元素出【{name}】", { count: result.changed, name }));
            }
        }
    };

    /**
     * 应用连通分量选中（SPEC §5.7.4）：
     * 1. deselectShape 还原旧选中样式（不调 unSelectShapeEvent：无需 evt 守卫，全量还原）
     * 2. 仅路径进 selectShapes + 加 selected 样式（§3.7）；updateShapeStyle 内部已对路径 moveToTop（§3.10）
     * 3. 节点在 NodesLayer 内 moveToTop（不加任何视觉标记，§3.11）
     * 4. 不 saveSnapshot（选中不改数据，§2.13）
     */
    const applyConnectedSelection = (
        stage: Konva.Stage,
        nodes: Konva.Shape[],
        edges: Konva.Shape[]
    ) => {
        // 还原旧选中（含旧选中路径与旧选中节点）
        const prevSelected = stage.find((s: Konva.Shape) => s.attrs?.state === "selected");
        prevSelected.forEach(deselectShape);

        // 仅路径进 selectShapes + 样式（updateShapeStyle 内部已对路径 moveToTop，路径置顶无需重复，§3.10）
        edges.forEach(e => updateShapeStyle(e));
        setSelectShapes(edges);

        // 节点在 NodesLayer 内置顶（§3.10）；moveToTop 在 Shape 所属 Layer 内生效，跨 Layer 无影响
        nodes.forEach(n => n.moveToTop());
        stage.batchDraw();

        // 提示选中数量（仅批量时，避免单选打扰，§6）
        if (edges.length > 1) {
            message.success(t("已选中 {count} 条路径（连通分量）", { count: edges.length }));
        }
    };

    /**
     * 选中附近元素：BFS 连通分量 + 超阈确认（SPEC §5.7.4）。
     * 第一阶段带 500 上限的 BFS 防万级阻塞；超阈弹 Modal.confirm，
     * 用户确认后第二阶段做完整 BFS（无上限）。
     */
    const onSelectNearbyElement = (edgeId: string) => {
        const stage = event?.target?.getStage?.() ?? null;
        if (!stage) return;
        const edgeShape = stage.findOne<Konva.Shape>("#" + edgeId);
        if (!edgeShape) return;

        // 第一阶段：带 500 上限的 BFS（防万级阻塞）
        const LIMIT = 500;
        const firstPass = collectConnectedComponent(edgeShape, stage, LIMIT);

        if (firstPass.truncated) {
            // 超阈弹确认框（§3.9）
            confirm({
                title: t("连通分量范围过大"),
                icon: <ExclamationCircleFilled />,
                content: t("该连通分量含超过 {limit} 个元素，选中后可能造成卡顿，是否继续？", { limit: LIMIT }),
                onOk: () => {
                    // 第二阶段：完整 BFS（无上限）
                    const full = collectConnectedComponent(edgeShape, stage, Infinity);
                    applyConnectedSelection(stage, full.nodes, full.edges);
                },
                onCancel() { /* 不选中，菜单已由 window click 关闭 */ }
            });
            return;
        }

        // 未超阈：直接选中
        applyConnectedSelection(stage, firstPass.nodes, firstPass.edges);
    };

    /**
     * 进入框选同向模式（拓扑 / 方向共用，SPEC_brush_same_direction_split）：
     * 防御性再校验基准 → 基准快照写入 stage attr → setManualKey 进入对应模式 → 一次性轻提示。
     * @param manualKey 模式 key：brushSelectSameDir（拓扑）/ brushSelectSameAngle（方向）
     * @param tipKey    进入提示的 i18n key（含 {name} 占位符）。两种模式文案不同
     *                  （拓扑同向 / 方向同向），整句 key 由调用方按模式传入，
     *                  保证各语言的语序可独立翻译
     */
    const enterSameDirBrushMode = (manualKey: string, tipKey: string) => {
        // v2 §4.1：防御性再校验（置灰已拦截，双保险）——基准 = 左键选中的唯一路径
        const base = selectShapes[0];
        if (!base || base.attrs?.enableSelect !== "edge") return;
        const stage = event?.target?.getStage?.() ?? null;
        // 右键目标已脱离 stage（菜单开着期间目标被删等极端情况）：
        // 无处写入基准快照，不进入模式
        if (!stage) return;
        // 基准快照写入 stage attr（v2 §6.4）：命令式瞬态数据，BrushSelect mouseup 直接读，
        // 不受 React 闭包陈旧影响，也不需要 NestGraph→GraphStage→ActionLayer 三层 props 链；
        // 两种模式共用同一快照 key，模式本身由 manualKey 区分
        stage.setAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge, base);
        setManualKey(manualKey);
        // v2 §4.11：一次性轻提示，报出基准路径名
        message.info(t(tipKey, { name: base.attrs?.data?.name ?? "" }));
    };

    const onContextMneuClick: MenuProps["onClick"] = ({ key, keyPath }) => {
        // key = 区域 id；keyPath 含一级项 key，据此分派到 handleAreaClick（§4.6）
        if (keyPath.indexOf("addToExclusiveGroup") !== -1) {
            handleAreaClick("exclusive", "add", key);
            return;
        }
        if (keyPath.indexOf("removeFromExclusiveGroup") !== -1) {
            handleAreaClick("exclusive", "remove", key);
            return;
        }
        if (keyPath.indexOf("addToTrafficGroup") !== -1) {
            handleAreaClick("traffic", "add", key);
            return;
        }
        if (keyPath.indexOf("removeFromTrafficGroup") !== -1) {
            handleAreaClick("traffic", "remove", key);
            return;
        }
        // 附近元素：key = 路径 id，keyPath 含 selectNearbyElements（SPEC §5.7.3）
        if (keyPath.indexOf("selectNearbyElements") !== -1) {
            onSelectNearbyElement(key);
            return;
        }
        switch (key) {
            case "selectReverseEdge":
                onSelectReverseEdge();
                break;
            case "addReverseEdge":
                onAddReverseEdge();
                break;
            case "brushSelectSameDir":
                // 框选拓扑同向路径（v2 语义原样保留）
                enterSameDirBrushMode("brushSelectSameDir", "请框选区域，将选中与【{name}】拓扑同向的路径");
                break;
            case "brushSelectSameAngle":
                // 框选方向同向路径（弦方向角度完全一致，SPEC_brush_same_direction_split）
                enterSameDirBrushMode("brushSelectSameAngle", "请框选区域，将选中与【{name}】方向同向的路径");
                break;
            case "delete":
                onDeleteShape();
                break;
            case "batchDelete":
                onBatchDeleteShape();
                break;
            case "createNodeByRobot": {
                // 记录车体 id 与 stage，由 Modal 在确认时实时重查车体（沿用原决策 6）
                const agvKey = event?.target.attrs?.id;
                const stage = event?.target?.getStage() ?? null;
                setCreateNodeModal({ open: true, agvKey, stage });
                break;
            }
            case "evenlyInsertNodes": {
                // A、B 已在 selectShapes 中；stage 从右键 target 取（Modal 打开期间稳定）
                const stage = event?.target?.getStage() ?? null;
                setInsertModal({ open: true, stage });
                break;
            }
            case "alignTwoPoints": {
                // 沿边连通性把 A、B 之间唯一路径上的中间节点投影到 A→B 直线并同步连边、拉直曲线
                alignTwoPointsLine(selectShapes);
                break;
            }
            default:
                break;
        }
    };

    useEffect(() => {
        openRef.current = open
    }, [open])

    const handleCloseContextMneu = () => {
        openRef.current && setContextMenu({ open: false });
    };

    useEffect(() => {
        window.addEventListener("click", handleCloseContextMneu);
        return () => {
            window.removeEventListener("click", handleCloseContextMneu)
        }
    }, [])

    return (
        <>
            <Dropdown
                open={open}
                autoAdjustOverflow
                menu={{
                    items: items as MenuProps["items"],
                    onClick: onContextMneuClick
                }}
                overlayStyle={{
                    position: "absolute",
                    left,
                    top,
                    height: "fit-content"
                }}
            />
            <CreateNodeByRobotModal
                open={createNodeModal.open}
                agvKey={createNodeModal.agvKey}
                stage={createNodeModal.stage}
                useMapId={useMapId}
                onClose={() => setCreateNodeModal(prev => ({ ...prev, open: false }))}
            />
            <EvenlyInsertModal
                open={insertModal.open}
                stage={insertModal.stage}
                useMapId={useMapId}
                selectShapes={selectShapes}
                setSelectShapes={setSelectShapes}
                /**
                 * 区域成员继承（SPEC D20）：等距插入自动连边时，旧直连边若属于
                 * 独占区/三方交管，其 edgeIds 需原位替换为同向新链段 id。
                 * 4 个 props 与 handleAreaClick 同源，无需新引入。
                 */
                trafficGroups={trafficGroups}
                exclusiveGroups={exclusiveGroups}
                setTrafficGroups={setTrafficGroups}
                setExclusiveGroups={setExclusiveGroups}
                onClose={() => setInsertModal(prev => ({ ...prev, open: false }))}
            />
            {/**
             * 批量删除遮罩：受控于 deleting，由 onOk 里的 flushSync 同步渲染。
             * fixed 覆盖全屏，遮住画布与右键菜单（此时菜单已关），避免删除阻塞期间误操作。
             */}
            {deleting && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 2000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0, 0, 0, 0.45)"
                }}>
                    <Spin size="large" />
                    <span style={{ color: "#fff", marginLeft: 12, fontSize: 14 }}>
                        {t("正在删除选中元素...")}
                    </span>
                </div>
            )}
        </>
    )
});
