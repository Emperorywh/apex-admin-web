/**
 * @description 选点逻辑 hook
 * 管理内部选中状态（Set<string>），提供单选/多选/清空/回显能力
 */
import { useCallback, useRef, useState } from "react";
import type {
  MapEdge,
  MapNode,
  SelectedItem,
  SelectMode,
} from "../KonvaMap.types";

interface UseSelectionOptions {
  multiple: boolean;
  selectMode: SelectMode;
  onChange?: (selectedItems: SelectedItem[]) => void;
}

/**
 * 选点逻辑 hook
 * 内部用 Set<string> 维护选中 ID，用 Map 查找完整对象
 */
export const useSelection = (options: UseSelectionOptions) => {
  const { multiple, selectMode, onChange } = options;

  // 选中 ID 集合（保持插入顺序）
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSetRef = useRef<Set<string>>(new Set());

  // 节点/路径的 ID → 完整对象 映射（由外部通过 setNodeMap/setEdgeMap 注入）
  const nodeMapRef = useRef<Map<string, MapNode>>(new Map());
  const edgeMapRef = useRef<Map<string, MapEdge>>(new Map());

  /** 注入节点映射 */
  const setNodeMap = useCallback((nodes: MapNode[]) => {
    nodeMapRef.current = new Map(nodes.map((n) => [n.id, n]));
  }, []);

  /** 注入路径映射 */
  const setEdgeMap = useCallback((edges: MapEdge[]) => {
    edgeMapRef.current = new Map(edges.map((e) => [e.id, e]));
  }, []);

  /** 通知外部选中变化 */
  const notifyChange = useCallback(
    (ids: string[]) => {
      if (!onChange) return;
      const items: SelectedItem[] = [];
      ids.forEach((id) => {
        const node = nodeMapRef.current.get(id);
        if (node) {
          items.push({ type: "node", data: node });
          return;
        }
        const edge = edgeMapRef.current.get(id);
        if (edge) {
          items.push({ type: "edge", data: edge });
        }
      });
      onChange(items);
    },
    [onChange],
  );

  /** 判断某个 ID 是否当前可选 */
  const isSelectable = useCallback(
    (id: string): boolean => {
      if (selectMode === "node") return nodeMapRef.current.has(id);
      if (selectMode === "edge") return edgeMapRef.current.has(id);
      // 'all' 模式下都可选
      return nodeMapRef.current.has(id) || edgeMapRef.current.has(id);
    },
    [selectMode],
  );

  /** 切换选中状态 */
  const toggleSelect = useCallback(
    (id: string) => {
      if (!isSelectable(id)) return;

      const set = new Set(selectedSetRef.current);

      if (multiple) {
        // 多选模式
        if (set.has(id)) {
          set.delete(id);
        } else {
          set.add(id);
        }
      } else {
        // 单选模式
        if (set.has(id)) {
          set.clear(); // 取消选中
        } else {
          set.clear();
          set.add(id);
        }
      }

      const newIds = Array.from(set);
      selectedSetRef.current = set;
      setSelectedIds(newIds);
      notifyChange(newIds);
    },
    [multiple, isSelectable, notifyChange],
  );

  /** 清空选中 */
  const clearSelection = useCallback(() => {
    selectedSetRef.current = new Set();
    setSelectedIds([]);
    notifyChange([]);
  }, [notifyChange]);

  /** 程序化设置选中项（回显场景，静默忽略不存在的 ID） */
  const setSelectedIdsExternal = useCallback(
    (ids: string[]) => {
      const set = new Set<string>();
      ids.forEach((id) => {
        // 只接受存在的 ID
        if (nodeMapRef.current.has(id) || edgeMapRef.current.has(id)) {
          set.add(id);
        }
      });
      selectedSetRef.current = set;
      const newIds = Array.from(set);
      setSelectedIds(newIds);
      notifyChange(newIds);
    },
    [notifyChange],
  );

  /** 获取完整选中对象列表 */
  const getSelectedItems = useCallback((): SelectedItem[] => {
    const items: SelectedItem[] = [];
    selectedSetRef.current.forEach((id) => {
      const node = nodeMapRef.current.get(id);
      if (node) {
        items.push({ type: "node", data: node });
        return;
      }
      const edge = edgeMapRef.current.get(id);
      if (edge) {
        items.push({ type: "edge", data: edge });
      }
    });
    return items;
  }, []);

  /** 获取选中 ID 列表 */
  const getSelectedIds = useCallback((): string[] => {
    return Array.from(selectedSetRef.current);
  }, []);

  /** 判断是否选中 */
  const isSelected = useCallback((id: string): boolean => {
    return selectedSetRef.current.has(id);
  }, []);

  return {
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
  };
};
