/**
 * @description 地图编辑撤销/恢复功能的历史记录管理（快照模式，最多保存10步）
 * @date 2026-3-31
 */
import Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { selectedState } from "@/plugins/konva/state/selected";
import { applyVisualScaleToAllShapes } from "@/plugins/konva/runtime/applyVisualScale";
import { MAP_NEST_STAGE_ATTR } from "@/plugins/konva/runtime/constants";

/**
 * 单个图形元素的序列化数据结构
 * 用于快照中存储每个 Konva.Shape 的属性及其所在图层索引，
 * 以便在撤销时能够精确地还原图形到正确的图层位置
 */
interface ShapeData {
    /** 图形的全部属性（包含 id、data、style 等） */
    attrs: Record<string, any>;
    /** 图形所在图层在 stage.getLayers() 中的索引位置 */
    layerIndex: number;
}

/**
 * 历史快照数据结构
 * 每次执行可撤销的操作前，会将画布上所有可编辑图形的状态、
 * 通行区域分组和互斥区域分组一起保存为一个完整快照
 */
interface Snapshot {
    /** 画布上所有可编辑图形的属性快照列表 */
    shapes: ShapeData[];
    /** 通行区域分组的深拷贝数据 */
    trafficGroups: NodeEdgeGroup[];
    /** 互斥区域分组的深拷贝数据 */
    exclusiveGroups: NodeEdgeGroup[];
}

/**
 * 历史记录最大保存步数
 * 超过此数量时会丢弃最早的快照（FIFO 策略）
 */
const MAX_HISTORY = 10;

/**
 * 历史快照栈
 * 存储所有已保存的快照，撤销时从末尾弹出
 */
let history: Snapshot[] = [];

/**
 * 恢复快照栈
 * 当执行撤销时，将撤销前的当前状态压入该栈；
 * 当执行恢复时，再从末尾弹出并应用，形成与撤销栈互不耦合的双栈模型。
 */
let redoHistory: Snapshot[] = [];

/**
 * Konva 舞台的引用
 * 由 initUndoStage 初始化，用于后续对画布图形的查找和操作
 */
let stageRef: Konva.Stage | null = null;

/**
 * 通行区域分组的最新引用
 * 由 updateGroupsRef 实时同步，saveSnapshot 时用于深拷贝保存
 */
let trafficGroupsRef: NodeEdgeGroup[] = [];

/**
 * 互斥区域分组的最新引用
 * 由 updateGroupsRef 实时同步，saveSnapshot 时用于深拷贝保存
 */
let exclusiveGroupsRef: NodeEdgeGroup[] = [];

/**
 * 通行区域分组的 setState 函数引用
 * 撤销时用于将通行区域分组回滚到快照中的状态
 */
let setTrafficGroupsFn: ((value: React.SetStateAction<NodeEdgeGroup[]>) => void) | null = null;

/**
 * 互斥区域分组的 setState 函数引用
 * 撤销时用于将互斥区域分组回滚到快照中的状态
 */
let setExclusiveGroupsFn: ((value: React.SetStateAction<NodeEdgeGroup[]>) => void) | null = null;

/**
 * 获取舞台上所有可编辑的图形元素
 * 通过 enableSelect 自定义属性筛选出节点（node）和边（edge），
 * 排除用于"新增节点"交互的临时占位图形（id 为 addNode）
 *
 * @param stage - Konva 舞台实例
 * @returns 所有可编辑的 Konva.Shape 数组
 */
const getModifiableShapes = (stage: Konva.Stage): Konva.Shape[] => {
    return stage.find((node: Konva.Node) => {
        const enableSelect = node.getAttr("enableSelect");
        return (enableSelect === "node" || enableSelect === "edge") && node.id() !== "addNode";
    }) as Konva.Shape[];
};

/**
 * 向指定历史栈压入快照，并统一维护最大历史长度。
 * 撤销栈和恢复栈都使用相同的容量策略，避免两个栈的边界规则分散在不同函数中。
 *
 * @param stack - 目标历史栈
 * @param snapshot - 需要保存的快照
 */
const pushSnapshot = (stack: Snapshot[], snapshot: Snapshot) => {
    if (stack.length >= MAX_HISTORY) {
        stack.shift();
    }
    stack.push(snapshot);
};

/**
 * 创建当前画布状态快照
 * 该方法只负责读取当前状态并生成快照，不修改撤销栈或恢复栈；
 * saveSnapshot、undo、redo 都通过它拿到一致的数据结构，避免复制快照生成逻辑。
 *
 * @returns 当前画布和区域分组的完整快照；无舞台引用时返回 null
 */
const createCurrentSnapshot = (): Snapshot | null => {
    if (!stageRef) return null;

    const shapes = getModifiableShapes(stageRef);
    const layers = stageRef.getLayers();

    return {
        shapes: shapes.map(shape => {
            const attrs = shape.getAttrs();
            const isSelected = attrs.state === "selected";
            const shapeStyle = attrs.shapeStyle ? JSON.parse(JSON.stringify(attrs.shapeStyle)) : attrs.shapeStyle;

            if (isSelected && shapeStyle) {
                const { enableSelect } = attrs;
                if (enableSelect === "node") {
                    if (shapeStyle.radius) shapeStyle.radius /= selectedState.radius;
                    if (shapeStyle.lineWidth) shapeStyle.lineWidth /= selectedState.lineWidth;
                } else if (enableSelect === "edge") {
                    if (shapeStyle.lineWidth) shapeStyle.lineWidth /= selectedState.lineWidth;
                }
            }

            return {
                attrs: {
                    ...attrs,
                    state: "",
                    data: attrs.data ? JSON.parse(JSON.stringify(attrs.data)) : attrs.data,
                    shapeStyle
                },
                layerIndex: layers.indexOf(shape.getLayer()!)
            };
        }),
        trafficGroups: JSON.parse(JSON.stringify(trafficGroupsRef)),
        exclusiveGroups: JSON.parse(JSON.stringify(exclusiveGroupsRef))
    };
};

/**
 * 将指定快照回放到当前舞台
 * 通过“删除多余图形、补回缺失图形、覆盖已有图形属性”的固定流程应用快照；
 * 同时同步区域分组 state 和模块内引用，确保连续撤销/恢复时读取到的分组状态始终最新。
 *
 * @param snapshot - 需要应用到画布和区域分组的目标快照
 */
const applySnapshot = (snapshot: Snapshot) => {
    if (!stageRef) return;

    const layers = stageRef.getLayers();

    /**
     * 快照图形映射表
     * 以图形 id 为 key，快速查找快照中是否存在某个图形
     */
    const snapshotMap = new Map<string, ShapeData>();
    snapshot.shapes.forEach(s => snapshotMap.set(s.attrs.id, s));

    /**
     * 当前画布图形映射表
     * 以图形 id 为 key，快速查找当前画布上是否存在某个图形
     */
    const currentShapes = getModifiableShapes(stageRef);
    const currentMap = new Map<string, Konva.Shape>();
    currentShapes.forEach(s => currentMap.set(s.id(), s));

    // 删除快照中不存在的 shape（操作后新增的）
    currentMap.forEach((shape, id) => {
        if (!snapshotMap.has(id)) {
            shape.destroy();
        }
    });

    // 恢复快照中存在但当前不存在的 shape（操作后删除的）
    snapshotMap.forEach((snapData, id) => {
        if (!currentMap.has(id)) {
            const layer = layers[snapData.layerIndex];
            if (layer) {
                const shape = new Konva.Shape(snapData.attrs);
                layer.add(shape);
            }
        }
    });

    // 恢复两边都存在的 shape 的属性
    snapshotMap.forEach((snapData, id) => {
        const shape = currentMap.get(id);
        if (shape) {
            shape.setAttrs(snapData.attrs);
        }
    });

    // 恢复区域分组状态
    if (setTrafficGroupsFn) {
        setTrafficGroupsFn(snapshot.trafficGroups);
    }
    if (setExclusiveGroupsFn) {
        setExclusiveGroupsFn(snapshot.exclusiveGroups);
    }

    trafficGroupsRef = snapshot.trafficGroups;
    exclusiveGroupsRef = snapshot.exclusiveGroups;

    /**
     * 恢复快照后，重新应用当前 visualScale 到所有 Shape 的视觉样式。
     * 快照中的 shapeStyle 可能是旧的缩放值，需要根据当前 stage attr 中的 visualScale 重算。
     */
    const visualScale = stageRef.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    applyVisualScaleToAllShapes(stageRef, visualScale);

    stageRef.batchDraw();

    /**
     * 撤销 / 重做同样是命令式 destroy / setAttrs / new Konva.Shape，
     * 不会触发 React 重渲染、也不会更新 GraphStage 的 nodes/edges props。
     * 若不通知，AnglesLayer 会停留在回放前的夹角（例如撤销删除后夹角不恢复、
     * 重做删除后夹角不清空）。这里在几何全部回放完之后派发一次 angles:refresh，
     * 让夹角层基于当前 stage 重新收集并重算。
     */
    stageRef.fire("angles:refresh", {} as any);
};

/**
 * 初始化舞台引用
 * 在组件挂载或 stage 实例变化时调用，
 * 将最新的 stage 引用保存到模块级变量中供后续操作使用
 *
 * @param stage - Konva 舞台实例，可能为 null（舞台尚未创建时）
 */
export const initUndoStage = (stage: Konva.Stage | null) => {
    stageRef = stage;
};

/**
 * 同步更新区域分组的引用和 setter 函数
 * 每当 trafficGroups 或 exclusiveGroups 发生变化时调用，
 * 确保模块内部始终持有最新的分组数据和对应的 setState 方法
 *
 * @param trafficGroups - 最新的通行区域分组数据
 * @param exclusiveGroups - 最新的互斥区域分组数据
 * @param setTrafficGroups - 通行区域分组的 setState 函数
 * @param setExclusiveGroups - 互斥区域分组的 setState 函数
 */
export const updateGroupsRef = (
    trafficGroups: NodeEdgeGroup[],
    exclusiveGroups: NodeEdgeGroup[],
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void,
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void
) => {
    trafficGroupsRef = trafficGroups;
    exclusiveGroupsRef = exclusiveGroups;
    setTrafficGroupsFn = setTrafficGroups;
    setExclusiveGroupsFn = setExclusiveGroups;
};

/**
 * 保存当前画布状态的快照
 * 在执行任何可撤销操作（如添加/删除节点、添加/删除边、移动图形等）之前调用，
 * 将当前所有可编辑图形的属性、通行分组和互斥分组进行深拷贝后压入历史栈。
 * 当历史栈已满（达到 MAX_HISTORY）时，自动丢弃最早的一条记录
 */
export const saveSnapshot = () => {
    const snapshot = createCurrentSnapshot();
    if (!snapshot) return;

    /**
     * 新的用户编辑会产生新的历史分支。
     * 此时旧的恢复路径已经不再代表当前编辑轨迹，必须清空恢复栈以保持撤销/恢复语义一致。
     */
    redoHistory = [];
    pushSnapshot(history, snapshot);
};

/**
 * 执行撤销操作
 * 从历史栈中弹出最近一次快照，通过三步对比恢复画布状态：
 * 1. 删除快照中不存在但当前存在的图形（即操作后新增的图形）
 * 2. 恢复快照中存在但当前不存在的图形（即操作后被删除的图形）
 * 3. 将两边都存在的图形属性回滚到快照中记录的值
 * 最后恢复通行/互斥区域分组状态并刷新画布
 *
 * @returns 撤销是否成功：无舞台引用或历史栈为空时返回 false
 */
export const undo = (): boolean => {
    if (!stageRef || !history.length) return false;

    const currentSnapshot = createCurrentSnapshot();
    if (currentSnapshot) {
        pushSnapshot(redoHistory, currentSnapshot);
    }

    const snapshot = history.pop()!;
    applySnapshot(snapshot);
    return true;
};

/**
 * 执行恢复操作
 * 从恢复栈中弹出最近一次撤销前保存的状态，先把当前状态压回撤销栈，
 * 再应用恢复快照，从而支持撤销后按原路径逐步向前恢复。
 *
 * @returns 恢复是否成功：无舞台引用或恢复栈为空时返回 false
 */
export const redo = (): boolean => {
    if (!stageRef || !redoHistory.length) return false;

    const currentSnapshot = createCurrentSnapshot();
    if (currentSnapshot) {
        pushSnapshot(history, currentSnapshot);
    }

    const snapshot = redoHistory.pop()!;
    applySnapshot(snapshot);
    return true;
};

/**
 * 判断当前是否可以执行撤销操作
 *
 * @returns 历史栈中存在快照时返回 true，否则返回 false
 */
export const canUndo = (): boolean => history.length > 0;

/**
 * 判断当前是否可以执行恢复操作
 *
 * @returns 恢复栈中存在快照时返回 true，否则返回 false
 */
export const canRedo = (): boolean => redoHistory.length > 0;

/**
 * 清空全部历史记录
 * 通常在组件首次挂载或切换地图时调用，防止旧数据干扰新场景
 */
export const clearHistory = () => {
    history = [];
    redoHistory = [];
};
