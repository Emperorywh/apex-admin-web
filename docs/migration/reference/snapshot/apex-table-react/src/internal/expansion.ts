import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RuntimeProps, RuntimeRow } from './runtime';

/*
 * 详情是展示行，不参与排序、分页、选择或序号计算。
 * 独立键避免业务 ID 与详情 ID 碰撞，并允许虚拟窗口缓存实际高度。
 */
export interface BodyEntry {
  key: string;
  row: RuntimeRow;
  index: number;
  detail: boolean;
  canExpand: boolean;
  expanded: boolean;
}

/*
 * 展开状态按稳定 ID 保存，筛选和翻页不会清空暂时不可见的记录。
 * 默认值只在挂载时读取；受控模式始终以调用方传回的键集合为准。
 */
export function useExpansion(config: RuntimeProps['expandable'], coreRows: RuntimeRow[], rows: RuntimeRow[]) {
  const [internalKeys, setInternalKeys] = useState<string[]>(() => [...new Set(config?.defaultExpandedRowKeys ?? (config?.defaultExpandAllRows ? coreRows.filter((row) => !config.rowExpandable || config.rowExpandable(row.original)).map((row) => row.id) : []))]);
  const keys = config?.expandedRowKeys ?? internalKeys;
  const latestKeys = useRef(keys);
  useLayoutEffect(() => { latestKeys.current = keys; }, [keys]);
  const expanded = useMemo(() => new Set(keys), [keys]);
  const entries = useMemo(() => rows.flatMap((row, index): BodyEntry[] => {
    const canExpand = !!config?.expandedRowRender && (!config.rowExpandable || config.rowExpandable(row.original));
    const entry = { key: `row:${row.id}`, row, index, detail: false, canExpand, expanded: canExpand && expanded.has(row.id) };
    return entry.expanded ? [entry, { ...entry, key: `detail:${row.id}`, detail: true }] : [entry];
  }), [rows, config?.expandedRowRender, config?.rowExpandable, expanded]);
  const toggle = useCallback((row: RuntimeRow) => {
    if (!config?.expandedRowRender || (config.rowExpandable && !config.rowExpandable(row.original))) return;
    const next = new Set(latestKeys.current);
    const open = !next.has(row.id);
    if (open) next.add(row.id); else next.delete(row.id);
    const nextKeys = [...next];
    if (config.expandedRowKeys === undefined) {
      latestKeys.current = nextKeys;
      setInternalKeys(nextKeys);
    }
    /*
     * 业务回调只在用户操作时执行，不放入状态更新函数。
     * 避免严格模式重复调用回调，也不因默认值或受控回传再次通知。
     */
    config.onExpand?.(open, row.original);
    config.onExpandedRowsChange?.(nextKeys);
  }, [config]);
  return { entries, toggle };
}
