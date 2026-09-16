import { createContext, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { Cell, RowData, TableFeatures } from '@tanstack/react-table';
import type { ApexTableReactLocalProps } from '../types';
import type { ApexCellContext } from '../editors/types';
import { readEditorField, updateCellData } from './editing-data';

/*
 * 编辑能力仅由本地数据入口提供，原生实例和请求入口默认只读。
 * 数据所有权保留在调用方，未提供变更回调时不会产生内部影子数据。
 */
type RuntimeCell = Cell<TableFeatures, RowData>;
export const EditingContext = createContext<{ enabled: boolean; commit(cell: RuntimeCell, value: unknown): void }>({ enabled: false, commit: () => undefined });
export function cellContext(cell: RuntimeCell): ApexCellContext<RowData> {
  const value = cell.column.accessorFn ? cell.getValue() : readEditorField(cell.row.original, cell.column.columnDef.meta?.apex?.editor?.field);
  return { row: cell.row.original, rowId: cell.row.id, rowIndex: cell.row.index, columnId: cell.column.id, value };
}
export function useEditing(props: ApexTableReactLocalProps<RowData>) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const enabled = !!props.editable && !!props.onDataChange;
  const commit = useCallback((cell: RuntimeCell, value: unknown) => {
    const current = latest.current;
    const editor = cell.column.columnDef.meta?.apex?.editor;
    if (!current.editable || !current.onDataChange || !editor) return;
    const rowIndex = current.getRowId ? current.data.findIndex((row, index) => current.getRowId!(row, index) === cell.row.id) : cell.row.index;
    if (rowIndex < 0 || rowIndex >= current.data.length) return;
    const row = current.data[rowIndex];
    const previousValue = cell.column.accessorFn ? cell.column.accessorFn(row, rowIndex) : readEditorField(row, editor.field);
    const context = { ...cellContext(cell), row, rowIndex, value: previousValue };
    if (editor.editable === false || (typeof editor.editable === 'function' && !editor.editable(context))) return;
    const column = cell.column.columnDef;
    const result = updateCellData(current.data, rowIndex, cell.row.id, cell.column.id, previousValue, value, editor, 'accessorKey' in column ? String(column.accessorKey) : undefined);
    if (!result) return;
    /*
     * 同一批次内的连续单元格事件基于刚提交的数据合并，避免互相覆盖。
     * 下一次 React 提交仍以父组件传入的受控数据为准。
     */
    latest.current = { ...current, data: result.data };
    current.onDataChange(result.data, result.change);
  }, []);
  return useMemo(() => ({ enabled, commit }), [enabled, commit]);
}
