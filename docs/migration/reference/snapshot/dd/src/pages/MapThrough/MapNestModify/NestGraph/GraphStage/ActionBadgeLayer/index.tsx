/**
 * @description 地图编辑-动作角标Layer（命令式创建）
 * @date 2026-6-28
 *
 * 在节点右上角、路径中点下方渲染动作角标（染色圆 + 内嵌数量）。
 * 仿 DeviceLayer 命令式 new Konva.Shape，几何/数量刷新由 refreshActionBadges 统一负责。
 * 角标 listening=true 仅供编辑模式下原生 hover（D9/D11），命中区域经 hitFunc 限定为圆形本体，
 * 点击角标无反应且不影响节点/路径正常选中（D12）。节点/路径选中时角标联动高亮（D19）。
 * hover 详情浮层统一走 DOM mousemove 监听（见下方 effect），不耦合 Stage.listening/enableModify，
 * 查看/编辑模式均生效——tooltip 是展示行为，不应被编辑开关掐断。
 *
 * 几何/数量刷新机制（D23）：
 *   - 初始加载 / 地图切换 / 主题切换 / 缩放：由 nodes/edges/isDark/visualScale 变化触发 refreshActionBadges 全量重建；
 *   - 运行时编辑（拖动节点/控制点、修改 actions）：由各编辑点直接调用 refreshActionBadges；
 *   - 选中联动：由 selectShapes 变化触发，更新 data.isSelected 并重绘。
 */
import { memo, useRef, useEffect } from "react";
import { Layer } from "react-konva/lib/ReactKonvaCore";
import Konva from "konva";
import type { MapNode, MapEdge } from "@/utils/typing";
import { refreshActionBadges, ACTION_BASE_RADIUS, stageToScreen } from "@/plugins/konva/actions";
import type { ActionHoverPayload } from "@/plugins/konva/actions";
import { MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";

interface ActionBadgeLayerProps {
    nodes: MapNode[];
    edges: MapEdge[];
    visible: boolean;
    /** 自适应视觉倍率（角标半径/偏移/节点右上角偏移据此自适应） */
    visualScale: number;
    /** 是否暗黑主题 */
    isDark: boolean;
    /** 当前选中的元素（角标联动高亮 D19） */
    selectShapes: Konva.Shape[];
    /** hover 角标回调（驱动 React hover 状态渲染 ActionTooltip） */
    onActionHover: (payload: ActionHoverPayload | null) => void;
}

export default memo((props: ActionBadgeLayerProps) => {

    const { nodes, edges, visible, visualScale, isDark, selectShapes, onActionHover } = props;
    const layerRef = useRef<Konva.Layer>(null);
    // 用 ref 持有最新 visualScale / onActionHover，避免它们进入重建 effect 依赖导致频繁重建
    const visualScaleRef = useRef(visualScale);
    visualScaleRef.current = visualScale;
    const onActionHoverRef = useRef(onActionHover);
    onActionHoverRef.current = onActionHover;

    /**
     * 初始加载 / 地图切换 / 主题切换：全量重建动作角标。
     * refreshActionBadges 从 node/edge Shape 的实时 data 读取坐标与 actions，
     * 与运行时编辑点共用同一套刷新逻辑。
     * 通过 options 显式传入 isDark/visualScale/onActionHover 最新值
     * （React effect 子先于父执行，子组件 effect 早于父组件 setAttr，需用 prop 覆盖值规避时序）。
     *
     * 【关键】refreshActionBadges 必须延迟一个宏任务执行。
     * 本图层在 JSX 中位于 NodesLayer 之前（D12 要求角标位于节点之下以让节点优先命中），
     * React 按树序同步执行同一批 commit 的兄弟 useEffect，因此本 effect 先于 NodesLayer 的
     * 命令式 Shape 创建 effect 执行。若立即调用 refreshActionBadges，
     * stage.find(enableSelect === "node") 会返回空数组，节点角标一个都创建不出来；
     * 又因为 nodes/edges 引用之后不再变化（仅 Konva attrs 被命令式更新），本 effect 不会重跑，
     * 角标将一直缺失，直到用户拖节点等编辑点再次触发 refreshActionBadges 才补上
     * （表现为：首次加载取消「隐藏动作角标」角标不显示，编辑地图后才出现）。
     * setTimeout(0) 把刷新推迟到所有兄弟 effect（NodesLayer/EdgesLayer 的 Shape 创建）完成之后，
     * 确保 stage 中节点/路径 Shape 已就绪。
     */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        // 把 onActionHover 存入 layer attr，供 ControlPoints/Actions 等编辑点调用 refreshActionBadges 时回退读取
        layer.setAttr("onActionHover", onActionHoverRef.current);
        const stage = layer.getStage();
        if (!stage) return;
        // 捕获闭包值，延迟到兄弟图层 Shape 创建完成后再刷新
        const dark = isDark;
        const scale = visualScaleRef.current;
        const hover = onActionHoverRef.current;
        const timer = window.setTimeout(() => {
            refreshActionBadges(stage, {
                isDark: dark,
                visualScale: scale,
                onActionHover: hover,
            });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [nodes, edges, isDark]);

    /** visualScale 变化：角标半径/偏移/节点右上角偏移均依赖 scale，故 scale 变化也全量重建 */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        layer.setAttr("onActionHover", onActionHoverRef.current);
        const stage = layer.getStage();
        if (!stage) return;
        refreshActionBadges(stage, {
            isDark,
            visualScale,
            onActionHover: onActionHoverRef.current,
        });
    }, [visualScale]);

    /** 选中联动（D19）：节点/路径选中时其角标联动高亮 */
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        const selectedIds = new Set(selectShapes.map(shape => shape.id()));
        (layer.find("Shape") as Konva.Shape[]).forEach(shape => {
            const data = shape.getAttrs()?.data;
            if (!data?.elementId) return;
            shape.setAttr("data", { ...data, isSelected: selectedIds.has(data.elementId) });
        });
        layer.batchDraw();
    }, [selectShapes]);

    /**
     * 角标 hover 详情浮层（D9-D11）—— DOM mousemove 监听，不依赖 Konva 命中事件。
     *
     * 为什么不走 Konva 的 mouseenter/mouseleave：
     * Stage.listening={enableModify} 在查看模式下会把整个 stage 的事件分发掐断
     * （Konva._isListening 递归校验祖先，Stage 不 listening 则任何子节点都收不到事件），
     * 于是出现「查看模式 hover 角标无 tooltip，必须进入编辑模式才行」。
     * 但 tooltip 纯属展示，不应耦合编辑开关。DOM 监听挂在 stage container 上，
     * 不受 Konva listening 影响，查看/编辑模式统一生效。
     *
     * 命中检测：遍历本图层角标 Shape，读 data.anchorX/anchorY/scale，
     * 半径 = ACTION_BASE_RADIUS × scale，鼠标 stage 内坐标落入圆内即命中；
     * 命中后用 data.elementId 反查 node/edge Shape 读其 data.actions，回传 React 渲染浮层。
     *
     * 注：refreshActionBadges 内角标 Shape 仍保留 Konva mouseenter/mouseleave（编辑模式原生路径），
     * 与此 DOM 监听并存——两者回传的 actions / 锚点屏幕坐标一致，
     * setActionHover 同值幂等，无副作用。
     *
     * 【可见性】本监听受 visible prop 控制：
     *   - visible=false（用户勾选「隐藏动作角标」）时不绑定监听，并立即清空已展示的浮层。
     *     原因：DOM 监听不感知 Konva Layer 的 visible 状态，layer.find("Shape") 仍会返回
     *     那些不可见的角标 Shape，圆形命中检测照常进行——而路径角标恰好锚定在「路径中点下方」，
     *     导致用户 hover 路径中点附近时会命中（已隐藏的）角标，触发残留的 tooltip。
     *   - visible=true 时绑定监听；切换回 true 时通过依赖重跑 effect 自动恢复。
     */
    useEffect(() => {
        const layer = layerRef.current;
        const stage = layer?.getStage();
        const container = stage?.container();
        if (!layer || !stage || !container) return;

        // 角标图层隐藏时（用户勾选「隐藏动作角标」）：不绑定 hover 监听，并立即清空已展示的浮层，
        // 避免 tooltip 残留在屏幕上
        if (!visible) {
            onActionHoverRef.current?.(null);
            return;
        }

        const onMove = (e: MouseEvent) => {
            // DOM client 坐标 → stage 内坐标（反算 stage 平移 + 缩放，与 stageToScreen 互逆）
            const rect = container.getBoundingClientRect();
            const px = (e.clientX - rect.left - stage.x()) / stage.scaleX();
            const py = (e.clientY - rect.top - stage.y()) / stage.scaleY();
            // 实时遍历当前角标（refresh 重建后 data 自动更新，无需重新挂监听）
            const badges = layer.find("Shape") as Konva.Shape[];
            for (const badge of badges) {
                const data = badge.getAttrs()?.data;
                if (!data || typeof data.anchorX !== "number") continue;
                const R = ACTION_BASE_RADIUS * data.scale;
                const dx = px - data.anchorX;
                const dy = py - data.anchorY;
                if (dx * dx + dy * dy <= R * R) {
                    // 命中：用 elementId 反查 node/edge Shape 读 actions（角标 data 未存 actions）
                    const target = stage.findOne<Konva.Shape>("#" + data.elementId);
                    const actions = target?.getAttrs()?.data?.actions ?? [];
                    const screen = stageToScreen(stage, data.anchorX, data.anchorY);
                    onActionHoverRef.current?.({ actions, screenX: screen.x, screenY: screen.y });
                    return;
                }
            }
            // 未命中任何角标：隐藏浮层
            onActionHoverRef.current?.(null);
        };
        const onLeave = () => onActionHoverRef.current?.(null);

        container.addEventListener("mousemove", onMove);
        container.addEventListener("mouseleave", onLeave);
        return () => {
            container.removeEventListener("mousemove", onMove);
            container.removeEventListener("mouseleave", onLeave);
        };
    }, [visible]);

    return <Layer ref={layerRef} name={MAP_NEST_LAYER_NAME.actions} visible={visible} />;
});
