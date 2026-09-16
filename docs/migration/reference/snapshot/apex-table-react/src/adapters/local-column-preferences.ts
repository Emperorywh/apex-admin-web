import type { Column, ColumnOrderState, ColumnPinningState, ColumnSizingState, ColumnVisibilityState, RowData, TableFeatures } from '@tanstack/react-table';

/*
 * 持久化载荷直接使用原生四个布局切片，绝不保存数据、查询或选择。
 * 工厂创建和模块导入均不访问存储；显式 load/save 才启动对应操作。
 */
export interface ColumnPreferenceSlices {
  columnOrder?: ColumnOrderState;
  columnVisibility?: ColumnVisibilityState;
  columnSizing?: ColumnSizingState;
  columnPinning?: ColumnPinningState;
}
export interface ColumnPreferencesOptions {
  namespace: string;
  userId: string;
  tenantId: string;
  tableId: string;
  schemaVersion: string | number;
  debounceMs?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | (() => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>);
  migrate?(state: unknown, previousVersion: string | number): unknown;
  onDiagnostic?(event: { code: 'read' | 'write' | 'format' | 'version' | 'migration'; error?: unknown }): void;
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function safeKey(key: string) { return key !== '__proto__' && key !== 'constructor' && key !== 'prototype'; }
function cloneSlices(value: ColumnPreferenceSlices): ColumnPreferenceSlices {
  return {
    ...(value.columnOrder ? { columnOrder: [...value.columnOrder] } : {}),
    ...(value.columnVisibility ? { columnVisibility: { ...value.columnVisibility } } : {}),
    ...(value.columnSizing ? { columnSizing: { ...value.columnSizing } } : {}),
    ...(value.columnPinning ? { columnPinning: { start: [...(value.columnPinning.start ?? [])], end: [...(value.columnPinning.end ?? [])] } } : {}),
  };
}
export function createLocalColumnPreferences(options: ColumnPreferencesOptions) {
  const identity = [options.namespace, options.userId, options.tenantId, options.tableId];
  if (identity.some((value) => typeof value !== 'string' || !value.trim()) || !['number', 'string'].includes(typeof options.schemaVersion)) throw new Error('列偏好需要完整的应用、用户、租户、表格与结构版本标识');
  const key = `apex-table:columns:${JSON.stringify(identity)}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: ColumnPreferenceSlices | undefined;
  let disposed = false;
  let last = '';
  const storage = () => typeof options.storage === 'function' ? options.storage() : options.storage ?? window.localStorage;
  const report = (code: 'read' | 'write' | 'format' | 'version' | 'migration', error?: unknown) => { try { options.onDiagnostic?.({ code, error }); } catch { /*
    * 诊断回调属于观察路径，其异常不能阻断表格浏览。
    * 存储失败也只回退到当前内存布局。
    */ } };
  const cancel = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; pending = undefined; };
  const flush = () => {
    if (disposed || !pending) return;
    const value = JSON.stringify({ formatVersion: 1, schemaVersion: options.schemaVersion, state: pending });
    cancel();
    if (value === last) return;
    try { storage().setItem(key, value); last = value; } catch (error) { report('write', error); }
  };
  return {
    key,
    load<F extends TableFeatures, D extends RowData>({ columns, initialState = {} }: { columns: Column<F, D>[]; initialState?: ColumnPreferenceSlices }): ColumnPreferenceSlices {
      cancel();
      const defaults = cloneSlices(initialState);
      if (disposed) return defaults;
      /*
       * 重新读取后，其他页面可能已删除或替换存储记录。
       * 先丢弃旧的成功写入缓存，避免回退后再次保存同一布局被错误跳过。
       */
      last = '';
      let candidate: unknown;
      try {
        const raw = storage().getItem(key);
        if (!raw) return defaults;
        const envelope: unknown = JSON.parse(raw);
        if (!record(envelope) || envelope.formatVersion !== 1 || !record(envelope.state)) { report('format'); return defaults; }
        candidate = envelope.state;
        if (envelope.schemaVersion !== options.schemaVersion) {
          if (!options.migrate || (typeof envelope.schemaVersion !== 'string' && typeof envelope.schemaVersion !== 'number')) { report('version'); return defaults; }
          try { candidate = options.migrate(candidate, envelope.schemaVersion); } catch (error) { report('migration', error); return defaults; }
        }
        if (!record(candidate)) { report('format'); return defaults; }
      } catch (error) { report('read', error); return defaults; }
      const source = candidate as Record<string, unknown>;
      const permitted = new Map(columns.filter((column) => safeKey(column.id)).map((column) => [column.id, column]));
      const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && permitted.has(id)))] : undefined;
      const result: ColumnPreferenceSlices = {};
      const order = ids(source.columnOrder) ?? ids(defaults.columnOrder);
      if (order) {
        const locked = columns.filter((column) => (column as unknown as Column<TableFeatures, RowData>).columnDef.meta?.apex?.canReorder === false);
        if (!locked.length) result.columnOrder = order;
        else {
          const baseline = [...(ids(defaults.columnOrder) ?? []), ...columns.map((column) => column.id)].filter((id, index, all) => all.indexOf(id) === index);
          const arranged = [...order, ...baseline.filter((id) => !order.includes(id))];
          locked.forEach((column) => { const position = arranged.indexOf(column.id); if (position >= 0) arranged.splice(position, 1); arranged.splice(baseline.indexOf(column.id), 0, column.id); });
          result.columnOrder = arranged;
        }
      }
      const visibility: ColumnVisibilityState = {};
      const sizing: ColumnSizingState = {};
      const sourceVisibility = { ...defaults.columnVisibility, ...(record(source.columnVisibility) ? source.columnVisibility : {}) };
      const sourceSizing = { ...defaults.columnSizing, ...(record(source.columnSizing) ? source.columnSizing : {}) };
      permitted.forEach((column, id) => {
        const runtime = column as unknown as Column<TableFeatures, RowData>;
        const hidden = sourceVisibility[id];
        if (typeof hidden === 'boolean') visibility[id] = runtime.getCanHide?.() === false ? defaults.columnVisibility?.[id] ?? true : hidden;
        const size = runtime.getCanResize?.() === false ? defaults.columnSizing?.[id] : sourceSizing[id];
        if (typeof size === 'number' && Number.isFinite(size)) sizing[id] = Math.min(runtime.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER, Math.max(runtime.columnDef.minSize ?? 20, size));
      });
      result.columnVisibility = visibility;
      result.columnSizing = sizing;
      const pins = record(source.columnPinning) ? source.columnPinning : defaults.columnPinning;
      if (pins) {
        const pinIds = (region: 'start' | 'end') => (ids(pins[region]) ?? []).filter((id) => (permitted.get(id) as unknown as Column<TableFeatures, RowData>).getCanPin?.() !== false || defaults.columnPinning?.[region]?.includes(id));
        const start = pinIds('start');
        const end = pinIds('end').filter((id) => !start.includes(id));
        permitted.forEach((column, id) => {
          if ((column as unknown as Column<TableFeatures, RowData>).getCanPin?.() === false) {
            if (defaults.columnPinning?.start?.includes(id) && !start.includes(id)) start.push(id);
            if (defaults.columnPinning?.end?.includes(id) && !end.includes(id) && !start.includes(id)) end.push(id);
          }
        });
        result.columnPinning = { start, end };
      }
      last = JSON.stringify({ formatVersion: 1, schemaVersion: options.schemaVersion, state: result });
      return result;
    },
    save(state: ColumnPreferenceSlices) {
      if (disposed) return;
      cancel();
      pending = cloneSlices(state);
      timer = setTimeout(flush, Math.max(0, options.debounceMs ?? 300));
    },
    flush,
    cancel,
    clear() { cancel(); last = ''; if (!disposed) { try { storage().removeItem(key); } catch (error) { report('write', error); } } },
    dispose() { cancel(); disposed = true; },
  };
}
