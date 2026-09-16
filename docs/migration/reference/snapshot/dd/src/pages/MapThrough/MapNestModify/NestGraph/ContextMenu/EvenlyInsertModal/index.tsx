/**
 * @description "等距插入节点"弹窗
 *              选中恰好两个节点 → 空白区域右键 → 菜单 → 输入数量 N、选择类型 →
 *              沿 A→B 直线等距生成 N 个节点，并【自动连边】（覆盖原「只插孤立点」的旧行为）。
 *              布局采用「精密工程仪表」风格（与 CreateNodeByRobotModal 统一）：
 *              - 参数表 label（强调色竖条 + 图标 + 文字）
 *              - 插入数量：InputNumber + 快捷胶囊（2/3/4/5）
 *              - 预览面板：按将建方向镜像的线段示意图 + 新增边/删除旧边统计
 * @date 2026-6-15
 *
 * 关键决策（建点部分见 docs/SPEC_evenly_insert_nodes.md；自动连线部分见 docs/SPEC_evenly_insert_auto_connect.md）：
 * - 决策 2：始终按 A、B 两点欧氏直线均分 N+1 段、取中间 N 个分点（不含端点）。
 * - 决策 7/8：先算后判、整体中止；仅与已有节点按 x/y 严格一致判重，等距新点彼此永不完全相等无需互判。
 * - 决策 9：A=selectShapes[0]、B=selectShapes[1]（按选中顺序）。
 * - 决策 11：生成后清空原 A、B 选中，不选中新节点/新边。
 * - 决策 16：点击"生成"直接创建，无需二次确认。
 * - 决策 17：创建前 saveSnapshot 一次（批量快照，含 groups）。
 *
 * 自动连线决策（SPEC_evenly_insert_auto_connect.md，D1–D21 + B1–B19）：
 * - D1：无开关，默认就连线。
 * - D2（修订）：态一/态三只建正向链——无论旧边方向，新边一律正向（isBackEdge=false）；旧边全删（不分方向/类型）。
 * - D4：A↔B 所有直连边全删（不分方向/类型）。
 * - D5/D21：标量属性逐段复制（来源优先正向旧边、fallback 反向旧边）；actions/userDefinedProperties 仅锚点所在段继承。
 * - D13：预览按态显示示意线；统计新增边/删除旧边数。
 * - D14：完成提示按实际建成边数报告。
 * - D20：旧边 id 在区域 group 的 edgeIds 中原位替换为新链段 id。
 * - B4（三态自动判定）：有直连边→态一边细分；无直连边但有间接路径→态二链路等距化；都没有→态三默认建链。
 * - B5/B10（混合单链）：态二下新点与旧中间节点按 A→B 投影交错串联，旧点保留原位不删、投影并列时旧点优先。
 * - B6/B9（逐段镜像）：态二每段新边取「段中点最近原边」的 isBackEdge 与业务属性。
 * - B16：路径搜索/判重失败均在 saveSnapshot 前 return，无副作用。
 *
 * 坐标空间：节点坐标全程画布世界坐标（米），直接用节点 shape.x()/y()；
 *           边 data.sy/ey 存后端 y（= −画布 y），arrowPoints/label 用画布正 y（见 SPEC §2.3）。
 */
import { memo, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Modal, InputNumber, Select, message } from "antd";
import {
    NodeIndexOutlined,
    FieldNumberOutlined,
    ApartmentOutlined,
    LineChartOutlined,
    InfoCircleOutlined
} from "@ant-design/icons";
import type Konva from "konva";
import type { NodeType } from "@/plugins/konva/nodes";
import { findDuplicateNodeName, unSelectedShape } from "@/utils/graph";
import { saveSnapshot } from "@/utils/undoHistory";
import { nodeTypeOptions } from "@/constants/mapThrough";
import type { MapEdge } from "@/utils/typing";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { refreshDeviceIcons } from "@/plugins/konva/devices";
import { refreshActionBadges } from "@/plugins/konva/actions";
import { forwardPath } from "@/plugins/konva/path/forwardPath";
import { MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";
import { createNodeShape } from "../createNodeShape";
import { useI18n } from "@/hooks/useI18n";
import { createStraightEdge, pickEdgeBusinessProps, findAnchorSegmentIndex, pointToSegmentDist } from "../createEdgeShape";
import { findSimplePaths } from "@/utils/align";

interface EvenlyInsertModalProps {
    /** 是否打开 */
    open: boolean;
    /** 当前地图 id */
    useMapId: string;
    /** 画布舞台，由 event.target.getStage() 传入 */
    stage: Konva.Stage | null;
    /** 当前选中图形（读取 A、B，按选中顺序） */
    selectShapes: Konva.Shape[];
    /** 创建后清空原选中（决策 11） */
    setSelectShapes: (v: React.SetStateAction<Konva.Shape[]>) => void;
    /**
     * 区域成员继承（SPEC D20）：旧直连边若属于三方交管/独占区，
     * 删除重建后其 edgeIds 需原位替换为同向新链段 id。4 个 props 与 ContextMenu handleAreaClick 同源。
     */
    trafficGroups: NodeEdgeGroup[];
    exclusiveGroups: NodeEdgeGroup[];
    setTrafficGroups: (v: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setExclusiveGroups: (v: React.SetStateAction<NodeEdgeGroup[]>) => void;
    /** 关闭回调 */
    onClose: () => void;
}

/** 数量默认/最小值：N ≥ 1，不设上限（决策 6） */
const COUNT_DEFAULT = 1;
const COUNT_MIN = 1;

/** 插入数量快捷预设（一键填入常用值） */
const QUICK_COUNTS = [2, 3, 4, 5];

/**
 * 配色（精密工程仪表：克制的工程蓝 + 中性灰，与 CreateNodeByRobotModal 保持一致）
 * - accent：交互主色；accentBg：选中态浅底；text/textSub/textFaint：主/次/弱文字
 * - border/panel/panelBorder：边框与面板背景
 */
const COLOR = {
    accent: "#1677ff",
    accentBg: "#e6f4ff",
    text: "#1f2329",
    textSub: "#6b7280",
    textFaint: "#9ca3af",
    border: "#e5e7eb",
    panel: "#f9fafb",
    panelBorder: "#eef0f3"
};

/* ---------- 样式常量（静态，定义于模块顶层以避免重渲染时重建） ---------- */

/** 参数表标签：强调色竖条 + 图标 + 文字，统一的「工程参数表」标签样式 */
const sectionLabelStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    color: COLOR.textSub,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.03em",
    userSelect: "none"
};
/** 标签前的强调色小竖条 */
const sectionBarStyle: CSSProperties = {
    width: 3,
    height: 12,
    borderRadius: 2,
    background: COLOR.accent
};
const fieldHintStyle: CSSProperties = { fontSize: 12, color: COLOR.textFaint };

/** 快捷胶囊：未选中态（浅灰底） */
const quickStyle: CSSProperties = {
    minWidth: 28,
    height: 28,
    padding: "0 8px",
    borderRadius: 8,
    border: `1px solid ${COLOR.border}`,
    background: "#fff",
    color: COLOR.textSub,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all .15s ease",
    userSelect: "none"
};
/** 快捷胶囊：选中态（强调色边框 + 浅强调底 + 强调色字） */
const quickActiveStyle: CSSProperties = {
    ...quickStyle,
    border: `1px solid ${COLOR.accent}`,
    background: COLOR.accentBg,
    color: COLOR.accent,
    fontWeight: 600
};

/** 预览面板：浅灰圆角容器 */
const previewPanelStyle: CSSProperties = {
    background: COLOR.panel,
    border: `1px solid ${COLOR.panelBorder}`,
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14
};

/** 线段示意图：端点 A ── 分点 ── 端点 B */
const diagramRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10
};
/** 端点列：圆点 + 下方节点名 */
const endpointColStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    width: 44
};
/** 端点圆（深色实心，内嵌 A/B 字母） */
const endpointDotStyle: CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: COLOR.text,
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
};
/** 端点下方节点名（截断） */
const endpointNameStyle: CSSProperties = {
    fontSize: 10,
    color: COLOR.textFaint,
    maxWidth: 56,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
};
/** 线段容器：相对定位，承载方向示意线与绝对定位的分点 */
const lineWrapStyle: CSSProperties = {
    flex: 1,
    position: "relative",
    height: 22,
    minHeight: 22
};
/** 分点：强调色实心小圆，沿示意线按比例均匀分布，线从其穿过 */
const midDotBaseStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    width: 11,
    height: 11,
    borderRadius: "50%",
    background: COLOR.accent,
    border: "2px solid #fff",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 1px rgba(22,119,255,.25)"
};

/** 数值统计行：平均间距 / 生成数量 */
const statLabelStyle: CSSProperties = { fontSize: 11, color: COLOR.textFaint, marginBottom: 2 };
const statValueStyle: CSSProperties = { fontSize: 16, fontWeight: 600, color: COLOR.text };
const statUnitStyle: CSSProperties = { fontSize: 12, fontWeight: 400, color: COLOR.textSub, marginLeft: 2 };

/** 未就绪提示行（选中不足两个节点） */
const notReadyStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    color: COLOR.textFaint,
    fontSize: 12
};

/**
 * @description 参数表字段标签（左侧强调色竖条 + 图标 + 文字）
 */
const SectionLabel = ({ icon, children }: { icon?: ReactNode; children: ReactNode }) => (
    <div style={sectionLabelStyle}>
        <span style={sectionBarStyle} />
        {icon}
        <span>{children}</span>
    </div>
);

/**
 * @description 计算等距插值点并做整体判重（决策 2/3/7/8）
 *              把线段 AB 均分为 count+1 段，取中间 count 个分点（不含端点 A、B）
 * @returns { points } 全部通过；或 { conflict } 首个冲突（x/y 与已有节点严格一致）
 */
const computeEvenlyPoints = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    count: number,
    stage: Konva.Stage
): { points: { x: number; y: number }[] } | { conflict: { index: number; name: string; point: { x: number; y: number } } } => {
    const points: { x: number; y: number }[] = [];
    for (let i = 1; i <= count; i++) {
        const x = ax + (i / (count + 1)) * (bx - ax);
        const y = ay + (i / (count + 1)) * (by - ay);
        // 仅与已有节点判重：x/y 严格一致才算重叠（findDuplicateNodeName 内部 DUPLICATE_EPSILON = 0）
        const dupName = findDuplicateNodeName(stage, x, y);
        if (dupName !== null) {
            return { conflict: { index: i, name: dupName, point: { x, y } } };
        }
        points.push({ x, y });
    }
    return { points };
};

const EvenlyInsertModal = memo((props: EvenlyInsertModalProps) => {
    const { open, useMapId, stage, selectShapes, setSelectShapes, trafficGroups, exclusiveGroups, setTrafficGroups, setExclusiveGroups, onClose } = props;
    /* 国际化翻译方法，用于节点类型等文案的多语言转换 */
    const { t } = useI18n();
    const [count, setCount] = useState<number>(COUNT_DEFAULT);
    const [nodeType, setNodeType] = useState<NodeType>("work");

    // 每次打开重置为默认（N=1、类型=work），避免上次选择残留（决策 15）
    useEffect(() => {
        if (open) {
            setCount(COUNT_DEFAULT);
            setNodeType("work");
        }
    }, [open]);

    // 当前类型的中文标签（数值预览用）
    const typeLabel = t(nodeTypeOptions.find(opt => opt.value === nodeType)?.label ?? "");

    // 预览：A、B 与 count 算平均间距（决策 12）；selectShapes 不足两个节点时降级提示
    // 显式标注可空：selectShapes 长度不足时 [0]/[1] 运行时为 undefined
    const aShape: Konva.Shape | undefined = selectShapes[0];
    const bShape: Konva.Shape | undefined = selectShapes[1];
    const twoNodesReady =
        !!aShape &&
        !!bShape &&
        aShape.attrs?.enableSelect === "node" &&
        bShape.attrs?.enableSelect === "node";
    // 平均间距（米）：仅两点就绪时计算，用于预览数值（handleOk 内会独立重算，互不依赖）
    let spacing: number | null = null;
    if (twoNodesReady) {
        const d =
            Math.sqrt((bShape!.x() - aShape!.x()) ** 2 + (bShape!.y() - aShape!.y()) ** 2) /
            (count + 1);
        spacing = d;
    }
    /**
     * 预览：三态只读探测（SPEC §4.9 / §4.11-c / B4 / B19），与 handleOk 第 3.5 步同口径。
     * Modal 带遮罩，打开期间画布不可编辑，渲染期读取 stage 是稳定的；count 变化触发重渲染时同步刷新。
     * 纯只读统计（不删边），用于预览示意与提示数字：
     *   - previewMode："edge" 态一边细分 / "chain" 态二链路等距化 / "new" 态三默认建链
     *   - oldEdgeCount：A↔B 直连边数（态一删除数）；pathEdgeCount：路径边数（态二删除数）
     *   - chainDots：态二混合链示意点序列（按 A→B 投影 t 排序，实心=新点、空心=旧点）
     */
    type PreviewMode = "edge" | "chain" | "new";
    type Dot = { t: number; isOld: boolean };
    let previewMode: PreviewMode = "new";
    let oldEdgeCount = 0;
    let pathEdgeCount = 0;
    let middleCount = 0;
    let chainDots: Dot[] = [];
    if (twoNodesReady && stage) {
        const aid = aShape!.attrs?.id;
        const bid = bShape!.attrs?.id;
        const allPreviewEdges = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge");
        allPreviewEdges.forEach(s => {
            const d = s.attrs?.data;
            if (!d) return;
            if ((d.snodeId === aid && d.enodeId === bid) || (d.snodeId === bid && d.enodeId === aid)) oldEdgeCount++;
        });
        if (oldEdgeCount > 0) {
            previewMode = "edge";
        } else {
            const paths = findSimplePaths(stage, aid!, bid!);
            if (paths.length === 1) {
                previewMode = "chain";
                const nodeIds = paths[0];
                const middleIds = nodeIds.slice(1, -1);
                middleCount = middleIds.length;
                // 路径边数（态二删除数）：snodeId/enodeId 恰为路径相邻对
                const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
                const pathPairs = new Set(nodeIds.slice(0, -1).map((id, i) => pairKey(id, nodeIds[i + 1])));
                allPreviewEdges.forEach(s => {
                    const d = s.attrs?.data;
                    if (d && pathPairs.has(pairKey(d.snodeId, d.enodeId))) pathEdgeCount++;
                });
                // 混合链示意点：新点(等距 t) + 旧点(实际投影 t)，按 t 排序、并列旧点优先（B10）
                const abx = bShape!.x() - aShape!.x();
                const aby = bShape!.y() - aShape!.y();
                const abLen2 = abx * abx + aby * aby;
                const projT = (x: number, y: number) =>
                    abLen2 < 1e-12 ? 0 : ((x - aShape!.x()) * abx + (y - aShape!.y()) * aby) / abLen2;
                const dots: Dot[] = [];
                for (let i = 1; i <= count; i++) dots.push({ t: i / (count + 1), isOld: false });
                middleIds.forEach(id => {
                    const s = stage.findOne(
                        (x: Konva.Shape) => x.attrs?.enableSelect === "node" && x.attrs?.id === id
                    ) as Konva.Shape | undefined;
                    if (s) dots.push({ t: projT(s.x(), s.y()), isOld: true });
                });
                dots.sort((p, q) => (Math.abs(p.t - q.t) < 1e-9 ? (p.isOld ? -1 : 1) : p.t - q.t));
                chainDots = dots;
            }
        }
    }
    // 新增边数：态一/三 = N+1（正向链）；态二 = N + middleCount + 1（混合链段数，B7）
    const newEdgeTotal = previewMode === "chain" ? count + middleCount + 1 : count + 1;
    // A、B 的节点名（示意图端点下方展示）
    const nameA = (aShape?.attrs?.data?.name as string | undefined) ?? "A";
    const nameB = (bShape?.attrs?.data?.name as string | undefined) ?? "B";

    /**
     * 确认生成（决策 16：无二次确认）：
     * 1. 数量校验 2. 防御性校验选中态 3. 等距计算+整体判重 4. 快照 5. 批量建点 6. 清空选中 7. 提示+关闭
     * 校验/判重失败均 message.warning 并 return（不关闭），便于用户调整后重试。
     */
    const handleOk = () => {
        // 1. 数量校验（N ≥ 1 的整数）
        if (typeof count !== "number" || isNaN(count) || count < COUNT_MIN) {
            message.warning(t("插入数量需为不小于 1 的整数"));
            return;
        }
        // 2. 防御性校验选中态（Modal 打开期间选中可能被改动）
        if (
            !stage ||
            !aShape ||
            !bShape ||
            aShape.attrs?.enableSelect !== "node" ||
            bShape.attrs?.enableSelect !== "node"
        ) {
            message.warning(t("请先选中两个节点"));
            return;
        }
        const ax = aShape.x();
        const ay = aShape.y();
        const bx = bShape.x();
        const by = bShape.y();
        // 3. 等距计算 + 整体判重（决策 7：任一冲突则中止，一个都不创建）
        const result = computeEvenlyPoints(ax, ay, bx, by, count, stage);
        if ("conflict" in result) {
            const { index, name } = result.conflict;
            message.warning(t("第 {index} 个插入点与已有节点【{name}】重合，已中止", { index, name }));
            return; // 不关闭，便于调整后重试
        }
        const aId = aShape.attrs.id;
        const bId = bShape.attrs.id;
        const allEdges = stage.find((s: Konva.Shape) => s.attrs?.enableSelect === "edge") as Konva.Shape[];
        /**
         * 3.5 三态自动判定（SPEC §4.1 / B4 / B11）：只读探测 A↔B 拓扑，必须在 saveSnapshot 之前完成。
         *     - 有直连边（snodeId/enodeId 恰为 {aId,bId}）         → 态一·边细分（pathNodeIds=null）
         *     - 无直连边、findSimplePaths 命中唯一简单路径          → 态二·链路等距化（pathNodeIds=该路径）
         *     - 无直连边、findSimplePaths 返回 0 条                 → 态三·默认建链（pathNodeIds=null）
         *     多条路径 → warning + return（此时未 saveSnapshot，无副作用，B16）。
         *     态一优先：有直连边即走态一，即便同时存在间接路径也不进态二（B11）。
         */
        const hasDirectEdge = allEdges.some(e => {
            const d = e.attrs?.data;
            return !!d && ((d.snodeId === aId && d.enodeId === bId) || (d.snodeId === bId && d.enodeId === aId));
        });
        let pathNodeIds: string[] | null = null; // 非 null ⇔ 态二·链路等距化
        if (!hasDirectEdge) {
            const paths = findSimplePaths(stage, aId, bId); // 复用 utils/align.ts（无向邻接 + DFS，命中2条剪枝）
            if (paths.length >= 2) {
                message.warning(t("两点间存在多条路径，无法确定唯一等距目标"));
                return; // 无副作用（B16）
            }
            if (paths.length === 1) pathNodeIds = paths[0];
        }
        // 4. 保存撤销快照（一次，决策 17 / SPEC D10/B17：操作前全量快照，含 groups，undo 一次全恢复）
        saveSnapshot();
        // 三态统一收口：建成边数、被删旧边数、旧边→新边映射（区域成员继承用）
        let edgeTotal = 0;
        let deletedCount = 0;
        const regionReplacement = new Map<string, string[]>();
        if (pathNodeIds) {
            /**
             * 态二·链路等距化（SPEC §4.11 / B1–B19）：
             * 删原路径旧边 → 新点与旧中间节点按 A→B 投影交错成混合单链 → 逐段按「段中点最近原边」建边（方向+属性镜像）。
             * 旧中间节点保留原位、不删除、不孤立（B3）；路径外分支边保留不动（B12）。
             */
            const nodeIds = pathNodeIds;
            const middleIds = nodeIds.slice(1, -1);
            // 旧中间节点 shape（按原路径拓扑顺序）
            const middleShapes: Konva.Shape[] = [];
            middleIds.forEach(id => {
                const found = stage.findOne(
                    (s: Konva.Shape) => s.attrs?.enableSelect === "node" && s.attrs?.id === id
                );
                if (found) middleShapes.push(found as Konva.Shape);
            });
            // (b) 收集路径旧边：snodeId/enodeId 恰为路径相邻对（双向匹配，不分 isBackEdge/edgeType）
            const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
            const pathPairs = new Set(nodeIds.slice(0, -1).map((id, i) => pairKey(id, nodeIds[i + 1])));
            const pathEdges = allEdges.filter(e => {
                const d = e.attrs?.data;
                return !!d && pathPairs.has(pairKey(d.snodeId, d.enodeId));
            });
            // 节点 id → shape（取画布坐标，B14：不读 sy/ey 后端坐标）
            const nodeIdToShape = new Map<string, Konva.Shape>();
            [aShape, bShape, ...middleShapes].forEach(s => nodeIdToShape.set(s.attrs.id, s));
            // 先从每条路径边提取业务属性 + 锚点 + 端点画布坐标，再 destroy
            const pathEdgeMeta = pathEdges.map(e => {
                const d = e.attrs!.data;
                const fromS = nodeIdToShape.get(d.snodeId)!;
                const toS = nodeIdToShape.get(d.enodeId)!;
                return {
                    id: e.id(),
                    isBackEdge: !!d.isBackEdge,
                    labelX: d.labelX,
                    labelY: d.labelY,
                    props: pickEdgeBusinessProps(d),
                    actions: d.actions?.length ? d.actions : undefined,
                    udp: d.userDefinedProperties ?? undefined,
                    ax: fromS.x(),
                    ay: fromS.y(),
                    bx: toS.x(),
                    by: toS.y(),
                    anchorSeg: 0 // chain 组装后回填
                };
            });
            pathEdges.forEach(e => e.destroy());
            const edgesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.edges}`) as Konva.Layer | undefined;
            edgesLayer?.batchDraw();
            // 6. 建 N 个新点（与态一/态三同函数、同顺序）
            const newNodeShapes = result.points
                .map(p => createNodeShape(stage, useMapId, p.x, p.y, nodeType))
                .filter((s): s is Konva.Shape => !!s);
            // (c) 组装混合单链（B5/B10）：按 A→B 投影参数 t 升序；t 并列旧点优先于新点
            const abx = bShape.x() - aShape.x();
            const aby = bShape.y() - aShape.y();
            const abLen2 = abx * abx + aby * aby;
            const projT = (x: number, y: number) =>
                abLen2 < 1e-12 ? 0 : ((x - aShape.x()) * abx + (y - aShape.y()) * aby) / abLen2;
            type Cand = { shape: Konva.Shape; t: number; isOld: boolean; topo: number };
            const candidates: Cand[] = [
                { shape: aShape, t: 0, isOld: true, topo: -1 },
                ...newNodeShapes.map((s, i) => ({ shape: s, t: (i + 1) / (count + 1), isOld: false, topo: i })),
                ...middleShapes.map((s, i) => ({ shape: s, t: projT(s.x(), s.y()), isOld: true, topo: i })),
                { shape: bShape, t: 1, isOld: true, topo: middleShapes.length }
            ];
            candidates.sort((p, q) =>
                Math.abs(p.t - q.t) < 1e-9
                    ? p.isOld === q.isOld
                        ? p.topo - q.topo
                        : p.isOld
                          ? -1
                          : 1
                    : p.t - q.t
            );
            const chain = candidates.map(c => c.shape);
            // 预算每条原边的锚点段（D21），建边时据此定位 actions/userDefinedProperties 附加段
            pathEdgeMeta.forEach(m => {
                m.anchorSeg = findAnchorSegmentIndex(m.labelX, m.labelY, chain);
            });
            // (d) 逐段建边（B6/B9/B14）：段中点欧氏最近原边决定方向 + 属性
            for (let i = 0; i < chain.length - 1; i++) {
                const mx = (chain[i].x() + chain[i + 1].x()) / 2;
                const my = (chain[i].y() + chain[i + 1].y()) / 2;
                let best = pathEdgeMeta[0];
                let bestD = Infinity;
                pathEdgeMeta.forEach(m => {
                    const d = pointToSegmentDist(mx, my, m.ax, m.ay, m.bx, m.by);
                    if (d < bestD) {
                        bestD = d;
                        best = m;
                    } // 严格 <：并列保留靠 A 侧
                });
                const props: Partial<MapEdge> = { ...best.props };
                if (i === best.anchorSeg) {
                    if (best.actions) props.actions = best.actions;
                    if (best.udp) props.userDefinedProperties = best.udp;
                }
                const edge = createStraightEdge(stage, useMapId, chain[i], chain[i + 1], best.isBackEdge, props);
                if (edge) {
                    edgeTotal++;
                    regionReplacement.set(best.id, [...(regionReplacement.get(best.id) ?? []), edge.id()]);
                }
            }
            deletedCount = pathEdges.length;
        } else {
            /**
             * 态一·边细分 / 态三·默认建链（SPEC §4.2–§4.10，原逻辑保留）：
             * 收集 A↔B 直连边并删除 → 建 N 点 → 沿 A→B 建正向链。
             * 态三（K=0）天然落到「无旧边可删、全默认属性建链」。
             */
            const forwardEdges: Konva.Shape[] = [];
            const reverseEdges: Konva.Shape[] = [];
            allEdges.forEach(e => {
                const d = e.attrs?.data;
                if (!d) return;
                if (d.snodeId === aId && d.enodeId === bId) forwardEdges.push(e);
                else if (d.snodeId === bId && d.enodeId === aId) reverseEdges.push(e);
            });
            const toDestroy = [...forwardEdges, ...reverseEdges];
            const K = toDestroy.length;
            // 属性来源优先正向旧边、fallback 反向旧边（D2 修订：只建正向，业务属性可从任意旧边继承）
            const sourceEdge = forwardEdges[0] ?? reverseEdges[0];
            const baseProps = sourceEdge ? pickEdgeBusinessProps(sourceEdge.attrs.data) : undefined;
            toDestroy.forEach(e => e.destroy());
            if (K > 0) {
                const edgesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.edges}`) as Konva.Layer | undefined;
                edgesLayer?.batchDraw();
            }
            const newNodeShapes = result.points
                .map(p => createNodeShape(stage, useMapId, p.x, p.y, nodeType))
                .filter((s): s is Konva.Shape => !!s);
            const chain = [aShape, ...newNodeShapes, bShape];
            // 只建正向链（D2 修订）：逐段 createStraightEdge(..., false, props)；锚点段附加实例字段（D21）
            const instProps: Partial<MapEdge> = {};
            const sd = sourceEdge?.attrs?.data;
            if (sd?.actions?.length) instProps.actions = sd.actions;
            if (sd?.userDefinedProperties) instProps.userDefinedProperties = sd.userDefinedProperties;
            const anchorIdx =
                sourceEdge && Object.keys(instProps).length > 0
                    ? findAnchorSegmentIndex(sd.labelX, sd.labelY, chain)
                    : -1;
            const forwardIds: string[] = [];
            for (let i = 0; i < chain.length - 1; i++) {
                const props = i === anchorIdx ? { ...baseProps, ...instProps } : baseProps;
                const edge = createStraightEdge(stage, useMapId, chain[i], chain[i + 1], false, props);
                if (edge) forwardIds.push(edge.id());
            }
            edgeTotal = forwardIds.length;
            deletedCount = K;
            toDestroy.forEach(e => regionReplacement.set(e.id(), forwardIds));
        }
        /**
         * 9/10. 区域成员继承（SPEC §4.7 / §4.11-e / D20 / B9）：旧边 id → 新链段 id 原位替换。
         *       原位替换并保持顺序；Set 去重。函数式更新；无命中的 group 原样返回（引用不变）。
         *       快照已在第 4 步捕获旧 groups，undo 整体回滚。
         */
        if (regionReplacement.size > 0) {
            const migrate = (groups: NodeEdgeGroup[]): NodeEdgeGroup[] =>
                groups.map(g =>
                    g.edgeIds.some(id => regionReplacement.has(id))
                        ? { ...g, edgeIds: [...new Set(g.edgeIds.flatMap(id => regionReplacement.get(id) ?? [id]))] }
                        : g
                );
            setTrafficGroups(prev => migrate(prev));
            setExclusiveGroups(prev => migrate(prev));
        }
        /**
         * 11. 命令式图层刷新（SPEC D12/B18）：建点/建边/删边均为命令式 shape.add/destroy，
         *     不触发 React 重渲染，三个独立装饰图层感知不到变化。与 doBatchDelete 完全同口径：
         *     refreshDeviceIcons → refreshActionBadges → angles:refresh。
         */
        refreshDeviceIcons(stage);
        refreshActionBadges(stage);
        stage.fire("angles:refresh", {} as any);
        // 12. 清空原选中（决策 11）：
        //    setSelectShapes([]) 仅清空 React 维护的选中数组，画布上节点的视觉选中态（state=selected、被放大的 radius/lineWidth）并不会随之还原。
        //    因此需先调用 unSelectedShape(stage) 把所有处于 selected 状态的 shape 视觉还原（state 置空、radius/lineWidth 除回原值），再清空选中数组，否则节点仍显示选中高亮。
        unSelectedShape(stage);
        setSelectShapes([]);
        // 13. 提示 + 关闭（SPEC D14/B19：按实际建成边数报告，无旧边删除时略去「删除」分句）
        //     K 占位符沿用 locale 既有 key，值传 deletedCount——态一/态二统一收口的实际删除边数（含路径旧边）
        if (deletedCount > 0) {
            message.success(t("已生成 {count} 个【{type}】节点、连接 {edgeTotal} 条边，删除 {K} 条旧边", { count, type: typeLabel, edgeTotal, K: deletedCount }));
        } else {
            message.success(t("已生成 {count} 个【{type}】节点、连接 {edgeTotal} 条边", { count, type: typeLabel, edgeTotal }));
        }
        onClose();
    };

    return (
        <Modal
            title={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <NodeIndexOutlined style={{ color: COLOR.accent }} />
                    <span>{t("等距插入节点")}</span>
                </div>
            }
            open={open}
            okText={t("生成")}
            cancelText={t("取消")}
            onOk={handleOk}
            onCancel={onClose}
            centered
            width={460}
            bodyStyle={{ paddingTop: 18 }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 插入数量：InputNumber + 快捷胶囊 */}
                <div>
                    <SectionLabel icon={<FieldNumberOutlined />}>{t("插入数量")}</SectionLabel>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <InputNumber
                            min={COUNT_MIN}
                            step={1}
                            value={count}
                            onChange={v =>
                                setCount(
                                    typeof v === "number" && v >= COUNT_MIN
                                        ? Math.floor(v)
                                        : COUNT_DEFAULT
                                )
                            }
                            style={{ width: 120 }}
                        />
                        <span style={fieldHintStyle}>{t("快捷")}</span>
                        {QUICK_COUNTS.map(n => (
                            <div
                                key={n}
                                style={count === n ? quickActiveStyle : quickStyle}
                                onClick={() => setCount(n)}
                            >
                                {n}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 节点类型 */}
                <div>
                    <SectionLabel icon={<ApartmentOutlined />}>{t("节点类型")}</SectionLabel>
                    <Select
                        options={nodeTypeOptions?.map(o => ({ ...o, label: t(o.label) }))}
                        value={nodeType}
                        onChange={value => setNodeType(value as NodeType)}
                        style={{ width: "100%" }}
                    />
                </div>

                {/* 预览面板（决策 12：数值预览）—— 线段示意图 + 统计 */}
                <div style={previewPanelStyle}>
                    <SectionLabel icon={<LineChartOutlined />}>{t("预览")}</SectionLabel>

                    {twoNodesReady ? (
                        <>
                            {previewMode === "chain" && (
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: COLOR.accent,
                                        background: COLOR.accentBg,
                                        border: `1px solid ${COLOR.accent}`,
                                        borderRadius: 6,
                                        padding: "2px 8px",
                                        alignSelf: "flex-start"
                                    }}
                                >
                                    {t("链路等距化 · 保留 {middleCount} 个旧节点", { middleCount })}
                                </div>
                            )}
                            {/* 线段示意图：A ●── 分点 ── B；态二下实心=新点、空心=旧点交错 */}
                            <div style={diagramRowStyle}>
                                <div style={endpointColStyle}>
                                    <div style={endpointDotStyle}>A</div>
                                    <div style={endpointNameStyle}>{nameA}</div>
                                </div>
                                <div style={lineWrapStyle}>
                                    {/**
                                     * 示意图只渲染正向（D2 修订）：灰线 + 右端 ▶（A→B）。
                                     * 分点（强调色实心圆）居中，线从其穿过，表示插入位置不变。
                                     */}
                                    <div style={{ position: "absolute", left: 10, right: 10, top: "50%", height: 2, background: forwardPath.stroke, transform: "translateY(-50%)", borderRadius: 1 }} />
                                    <span style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", color: forwardPath.stroke, fontSize: 11, lineHeight: 1 }}>▶</span>
                                    {/**
                                     * 分点（SPEC §4.9-c / B5 / B19）：
                                     * 态一/态三：强调色实心小圆，按 i/(count+1) 均匀分布。
                                     * 态二（链路等距化）：实心圆=新建等距点、空心圆=保留的旧中间节点，
                                     *   按 A→B 投影 t 交错（chainDots 预计算），线从其穿过。
                                     */}
                                    {previewMode === "chain"
                                        ? chainDots.map((dot, idx) => {
                                              // 投影 t 钳到 [2,98]，防止极端折线时点溢出示意图
                                              const ratio = Math.max(2, Math.min(98, dot.t * 100));
                                              return (
                                                  <div
                                                      key={idx}
                                                      title={dot.isOld ? t("保留的旧节点") : t("新建等距节点")}
                                                      style={
                                                          dot.isOld
                                                              ? {
                                                                    ...midDotBaseStyle,
                                                                    left: `${ratio}%`,
                                                                    background: "#fff",
                                                                    border: `2px solid ${COLOR.accent}`
                                                                }
                                                              : { ...midDotBaseStyle, left: `${ratio}%` }
                                                      }
                                                  />
                                              );
                                          })
                                        : Array.from({ length: count }, (_, idx) => {
                                              const i = idx + 1;
                                              const ratio = (i / (count + 1)) * 100;
                                              return (
                                                  <div
                                                      key={i}
                                                      style={{ ...midDotBaseStyle, left: `${ratio}%` }}
                                                  />
                                              );
                                          })}
                                </div>
                                <div style={endpointColStyle}>
                                    <div style={endpointDotStyle}>B</div>
                                    <div style={endpointNameStyle}>{nameB}</div>
                                </div>
                            </div>

                            {/* 数值统计：平均间距 / 生成数量 / 节点类型 / 新增边 / 删除旧边（SPEC §4.9-b） */}
                            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                                <div>
                                    <div style={statLabelStyle}>{t("平均间距")}</div>
                                    <div style={statValueStyle}>
                                        {spacing !== null ? spacing.toFixed(2) : "—"}
                                        <span style={statUnitStyle}>m</span>
                                    </div>
                                </div>
                                <div>
                                    <div style={statLabelStyle}>{t("生成数量")}</div>
                                    <div style={statValueStyle}>
                                        {count}
                                        <span style={statUnitStyle}>{t("个")}</span>
                                    </div>
                                </div>
                                <div>
                                    <div style={statLabelStyle}>{t("节点类型")}</div>
                                    <div style={{ ...statValueStyle, fontSize: 14 }}>{typeLabel}</div>
                                </div>
                                <div>
                                    <div style={statLabelStyle}>{t("新增边")}</div>
                                    <div style={statValueStyle}>
                                        {newEdgeTotal}
                                        <span style={statUnitStyle}>{t("条")}</span>
                                    </div>
                                </div>
                                <div>
                                    <div style={statLabelStyle}>{t("删除旧边")}</div>
                                    <div style={statValueStyle}>
                                        {previewMode === "chain" ? pathEdgeCount : oldEdgeCount}
                                        <span style={statUnitStyle}>{t("条")}</span>
                                    </div>
                                </div>
                                <div>
                                    <div style={statLabelStyle}>{t("保留旧节点")}</div>
                                    <div style={statValueStyle}>
                                        {previewMode === "chain" ? middleCount : "—"}
                                        {previewMode === "chain" && <span style={statUnitStyle}>{t("个")}</span>}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={notReadyStyle}>
                            <InfoCircleOutlined />
                            <span>{t("请先在画布上选中两个节点")}</span>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
});

export default EvenlyInsertModal;
