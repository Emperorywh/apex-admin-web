/**
 * @description 撤销/恢复功能的生命周期管理 Hook（init/sync/cleanup/undo/redo/快捷键）
 * @date 2026-3-31
 */
import { useEffect, useCallback } from "react";
import Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { initUndoStage, updateGroupsRef, undo, redo, clearHistory } from "@/utils/undoHistory";

/**
 * useUndoHistory Hook 的入参配置
 * 包含舞台实例、区域分组数据及其 setter、选中图形的 setter、
 * 以及当前是否允许编辑的开关，用于控制撤销/恢复功能的完整生命周期
 */
interface UseUndoHistoryOptions {
    /** Konva 舞台实例，可能为 null（舞台尚未初始化时） */
    stage: Konva.Stage | null;
    /** 通行区域分组数据 */
    trafficGroups: NodeEdgeGroup[];
    /** 互斥区域分组数据 */
    exclusiveGroups: NodeEdgeGroup[];
    /** 通行区域分组的 setState 函数 */
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    /** 互斥区域分组的 setState 函数 */
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    /** 当前选中图形列表的 setState 函数 */
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    /** 是否启用编辑模式，仅在编辑模式下才响应撤销/恢复快捷键 */
    enableModify: boolean;
}

/**
 * 撤销/恢复功能的生命周期管理 Hook
 * 负责以下职责：
 * 1. 初始化撤销模块的舞台引用（stage 变化时同步）
 * 2. 实时同步区域分组数据到撤销模块（trafficGroups/exclusiveGroups 变化时）
 * 3. 组件首次挂载时清空历史记录（防止残留旧数据）
 * 4. 提供 handleUndo / handleRedo 方法供外部调用（如顶部菜单按钮）
 * 5. 监听 Ctrl+Z / Cmd+Z 触发撤销，监听 Ctrl+Y / Cmd+Y 触发恢复
 *
 * @param options - Hook 配置项
 * @returns 包含 handleUndo / handleRedo 方法的对象，供外部手动触发撤销和恢复
 */
export const useUndoHistory = (options: UseUndoHistoryOptions) => {
    const { stage, trafficGroups, exclusiveGroups, setTrafficGroups, setExclusiveGroups, setSelectShapes, enableModify } = options;

    /**
     * 当 stage 实例变化时，将最新的舞台引用同步到撤销工具模块
     * 确保 saveSnapshot / undo / redo 等操作始终能访问到正确的舞台
     */
    useEffect(() => {
        initUndoStage(stage);
    }, [stage]);

    /**
     * 当通行/互斥区域分组数据变化时，将最新数据和 setter 同步到撤销工具模块
     * 确保 saveSnapshot 能保存最新的分组状态，undo/redo 能正确回滚或恢复分组
     */
    useEffect(() => {
        updateGroupsRef(trafficGroups, exclusiveGroups, setTrafficGroups, setExclusiveGroups);
    }, [trafficGroups, exclusiveGroups]);

    /**
     * 组件首次挂载时清空历史记录
     * 防止页面切换或重新进入编辑器时，残留上一次编辑的历史快照
     */
    useEffect(() => {
        clearHistory();
    }, []);

    /**
     * 执行撤销操作的回调函数
     * 调用 undo 工具方法回滚画布状态，若撤销成功则清空当前选中的图形，
     * 避免选中状态指向已被回滚/销毁的图形导致异常
     */
    const handleUndo = useCallback(() => {
        const success = undo();
        if (success) {
            setSelectShapes([]);
        }
    }, [setSelectShapes]);

    /**
     * 执行恢复操作的回调函数
     * 调用 redo 工具方法恢复画布状态，若恢复成功则清空当前选中的图形，
     * 避免选中状态指向被恢复流程重建或销毁的图形实例
     */
    const handleRedo = useCallback(() => {
        const success = redo();
        if (success) {
            setSelectShapes([]);
        }
    }, [setSelectShapes]);

    /**
     * 监听键盘快捷键 Ctrl+Z / Cmd+Z 和 Ctrl+Y / Cmd+Y
     * 仅在 enableModify 为 true（编辑模式）时响应；
     * 这里统一转小写处理，避免不同浏览器或输入法环境下按键大小写差异影响快捷键判断。
     * 当前需求只支持 Ctrl+Z 和 Ctrl+Y，因此带 Shift 的组合键会直接跳过，避免隐式扩展快捷键语义。
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!enableModify || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;

            const key = e.key.toLowerCase();
            if (key === "z") {
                e.preventDefault();
                handleUndo();
                return;
            }
            if (key === "y") {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [enableModify, handleUndo, handleRedo]);

    return { handleUndo, handleRedo };
};
