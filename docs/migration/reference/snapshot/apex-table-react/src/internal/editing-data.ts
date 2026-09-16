import type { ApexCellChange, ApexCellEditor } from '../editors/types';

/*
 * 字段路径逐层复制，保留未修改记录和兄弟字段的引用。
 * 拒绝原型字段及空路径，避免深层赋值意外改变对象原型。
 */
export function editorPath(field: string | readonly string[] | undefined): readonly string[] | undefined {
  const parts = typeof field === 'string' ? field.split('.') : field;
  return parts?.length && parts.every((key) => key && !['__proto__', 'prototype', 'constructor'].includes(key)) ? parts : undefined;
}
/*
 * 仅配置显式 field 的展示列也能读取当前值，无需额外重复 accessorFn。
 * 空对象或不存在的中间字段统一返回 undefined，与原生访问器保持一致。
 */
export function readEditorField(source: unknown, field: string | readonly string[] | undefined): unknown {
  const path = editorPath(field);
  if (!path) return undefined;
  let value = source;
  for (const key of path) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
function writePath(source: unknown, path: readonly string[], value: unknown): unknown {
  const [key, ...rest] = path;
  const record = source !== null && typeof source === 'object' ? source as Record<string, unknown> : undefined;
  const next = rest.length ? writePath(record?.[key], rest, value) : value;
  if (record && Object.is(record[key], next)) return source;
  const copy = Array.isArray(source) ? [...source] : { ...record };
  Object.defineProperty(copy, key, { value: next, enumerable: true, writable: true, configurable: true });
  return copy;
}

/*
 * 索引来自原始数据模型，不使用排序、筛选或分页后的显示位置。
 * 变更通知包含更新前后的记录，调用方可直接保存完整数组或单条记录。
 */
export function updateCellData<D>(data: D[], rowIndex: number, rowId: string, columnId: string, previousValue: unknown, value: unknown, editor: ApexCellEditor<D>, accessorKey?: string): { data: D[]; change: ApexCellChange<D> } | undefined {
  if (rowIndex < 0 || rowIndex >= data.length || Object.is(previousValue, value)) return undefined;
  const previousRow = data[rowIndex];
  const path = editorPath(editor.field ?? accessorKey);
  if (!editor.setValue && !path) return undefined;
  const row = editor.setValue ? editor.setValue(previousRow, value) : writePath(previousRow, path!, value) as D;
  if (Object.is(previousRow, row)) return undefined;
  const next = [...data];
  next[rowIndex] = row;
  return { data: next, change: { row, previousRow, rowId, rowIndex, columnId, previousValue, value } };
}
