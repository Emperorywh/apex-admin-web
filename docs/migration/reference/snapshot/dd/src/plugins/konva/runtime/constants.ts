/**
 * @description 画布运行时常量：集中管理 Stage attr key、Layer name、自定义事件名
 * @date 2026-5-27
 */

/**
 * Stage 自定义属性的 key 集合
 * 命令式消费者通过 stage.getAttr() / stage.setAttr() 读写
 */
export const MAP_NEST_STAGE_ATTR = {
    /** 自适应视觉倍率（number） */
    visualScale: "visualScale",
    /** 标签可见性（{ node: boolean, edge: boolean }） */
    labelVisible: "labelVisible",
    /** 是否暗黑主题（boolean）：sceneFunc 内据此切换设备图标配色 */
    isDark: "isDark",
    /**
     * 路径属性着色开关状态（EdgeColorVisible）：sceneFunc 内据此决定是否按属性着色。
     * 由 MapNestModify / Overlook 的 GraphStage 写入，edgeSceneFunc / EdgesLayer sceneFunc 运行时读取。
     */
    edgeColorVisible: "edgeColorVisible",
    /**
     * 框选同向路径的基准边快照（Konva.Shape | null，
     * SPEC_brush_same_direction_contextmenu v2 §6.4 / SPEC_brush_same_direction_split）：
     * 进入模式时由 ContextMenu 写入，BrushSelect mouseup 命令式读取，
     * 退出模式由 GraphStage 的清理 effect 统一置 null。
     * 拓扑（brushSelectSameDir）/ 方向（brushSelectSameAngle）两种模式共用此快照，
     * 模式本身由 manualKey 区分。
     */
    sameDirBaseEdge: "sameDirBaseEdge",
} as const;

/**
 * Layer name 常量
 * 用于 findOne(".xxxName") 按 name 查找指定图层
 */
export const MAP_NEST_LAYER_NAME = {
    /** 节点图层 */
    nodes: "nodesLayer",
    /** 路径图层 */
    edges: "edgesLayer",
    /** 三方设备图标图层（供 refreshDeviceIcons 按 name 定位） */
    devices: "devicesLayer",
    /** 动作角标图层（供 refreshActionBadges 按 name 定位） */
    actions: "actionsLayer",
} as const;

/**
 * 自定义事件名
 * 用于 stage.fire() / stage.on() 跨组件通信
 */
export const MAP_NEST_EVENT = {
    /** 夹角层刷新（对齐/平移等静默 setAttrs 后触发） */
    anglesRefresh: "angles:refresh",
} as const;
