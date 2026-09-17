/**
 * 地图选中状态逻辑（T00.7，迁移自旧 KonvaMap/hooks/useSelection，行为一致）。
 *
 * 内部以 Set<string> 维护选中 ID（保持插入顺序），以 Map 维护
 * ID → 完整 DTO 的映射；对外回调携带完整节点/路径对象，
 * 上层回填坐标/名称时无需二次查询。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MapEdgeDto, MapNodeDto } from '@/services/map/map.service.types'
import type { MapSelectedItem, MapSelectMode } from '@/components/ReadOnlyMap/ReadOnlyMap.types'

interface UseMapSelectionOptions {
  multiple: boolean
  selectMode: MapSelectMode
  onChange?: (selectedItems: MapSelectedItem[]) => void
}

/** 构建选中项对象：优先按节点匹配，其次路径 */
function buildItems(ids: string[], nodeMap: Map<string, MapNodeDto>, edgeMap: Map<string, MapEdgeDto>): MapSelectedItem[] {
  const items: MapSelectedItem[] = []
  for (const id of ids) {
    const node = nodeMap.get(id)
    if (node) {
      items.push({ type: 'node', data: node })
      continue
    }
    const edge = edgeMap.get(id)
    if (edge) {
      items.push({ type: 'edge', data: edge })
    }
  }
  return items
}

export function useMapSelection(options: UseMapSelectionOptions) {
  const { multiple, selectMode, onChange } = options

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedSetRef = useRef<Set<string>>(new Set())
  const nodeMapRef = useRef<Map<string, MapNodeDto>>(new Map())
  const edgeMapRef = useRef<Map<string, MapEdgeDto>>(new Map())

  // onChange 经 ref 消费：调用方内联回调不引发选中逻辑重建
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  /** 数据集更新时重建 ID → DTO 映射（渲染与选中共享同一份 DTO） */
  const setNodeMap = useCallback((nodes: MapNodeDto[]) => {
    nodeMapRef.current = new Map(nodes.map((n) => [n.id, n]))
  }, [])

  const setEdgeMap = useCallback((edges: MapEdgeDto[]) => {
    edgeMapRef.current = new Map(edges.map((e) => [e.id, e]))
  }, [])

  /** 统一出口：同步 React 状态并向上层回调完整对象 */
  const applyIds = useCallback((ids: string[]) => {
    setSelectedIds(ids)
    onChangeRef.current?.(buildItems(ids, nodeMapRef.current, edgeMapRef.current))
  }, [])

  /** 判定某 ID 在当前模式下是否可选 */
  const isSelectable = useCallback(
    (id: string): boolean => {
      if (selectMode === 'node') return nodeMapRef.current.has(id)
      if (selectMode === 'edge') return edgeMapRef.current.has(id)
      return nodeMapRef.current.has(id) || edgeMapRef.current.has(id)
    },
    [selectMode],
  )

  /** 点击切换选中：单选重复点击同一项 = 取消选中 */
  const toggleSelect = useCallback(
    (id: string) => {
      if (!isSelectable(id)) return
      const next = new Set(selectedSetRef.current)
      if (multiple) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      } else if (next.has(id)) {
        next.clear()
      } else {
        next.clear()
        next.add(id)
      }
      selectedSetRef.current = next
      applyIds([...next])
    },
    [multiple, isSelectable, applyIds],
  )

  /** 清空选中（画布空白点击 / mapId 切换） */
  const clearSelection = useCallback(() => {
    selectedSetRef.current = new Set()
    applyIds([])
  }, [applyIds])

  /**
   * 程序化回显（initialSelectedIds / 独立窗口恢复）：
   * 静默忽略当前数据中不存在的 ID——失效关联的"保留原值 + 不可用说明"
   * 由上层以原始值自行呈现，地图不假装选中不存在的图形。
   */
  const setSelectedIdsExternal = useCallback(
    (ids: string[]) => {
      const next = new Set<string>()
      for (const id of ids) {
        if (nodeMapRef.current.has(id) || edgeMapRef.current.has(id)) next.add(id)
      }
      selectedSetRef.current = next
      applyIds([...next])
    },
    [applyIds],
  )

  const getSelectedItems = useCallback(
    (): MapSelectedItem[] => buildItems([...selectedSetRef.current], nodeMapRef.current, edgeMapRef.current),
    [],
  )

  const getSelectedIds = useCallback((): string[] => [...selectedSetRef.current], [])

  const isSelected = useCallback((id: string): boolean => selectedSetRef.current.has(id), [])

  // selectMode 变化时清理与新模式不匹配的选中项（如 node → edge 模式残留节点选中）
  const prevModeRef = useRef(selectMode)
  useEffect(() => {
    if (prevModeRef.current === selectMode) return
    prevModeRef.current = selectMode
    const hasInvalid = selectedSetRef.current.size > 0 && ![...selectedSetRef.current].every((id) => isSelectable(id))
    if (hasInvalid) clearSelection()
  }, [selectMode, isSelectable, clearSelection])

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
  }
}
