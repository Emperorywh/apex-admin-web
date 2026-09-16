import { forwardRef, memo, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ForwardedRef, ReactElement, RefAttributes } from 'react';
import type { Cell, Header, RowData, TableFeatures, TableState } from '@tanstack/react-table';
import { makeStateUpdater, useTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
/*
 * 请求入口复用数据入口的渲染与实例管理，类型分别约束各自的数据来源。
 * 对外签名仍统一使用数据模式联合类型，保持行类型自动推断。
 */
import type { ApexDensity, ApexDiagnostic, ApexRootDOM, ApexTableProps, ApexTableReactDataProps, ApexTableReactLocalProps, ApexTableReactRequestProps, ApexTableInstance, ApexTableRef } from '../types';
import { useRequestProps } from '../internal/request';
import { zhCN } from '../locale';
import { UIContext, useUI } from '../internal/context';
import { diagnostic, focusWithoutScroll, hasProtectedProps, isInteractive, mergeDOM } from '../internal/dom';
import { calculateLayout, trackStyle } from '../internal/layout';
import type { Track } from '../internal/layout';
import { columnLabel } from '../internal/runtime';
import { managedFeatures } from '../internal/features';
import type { RuntimeProps, RuntimeRow, RuntimeTable } from '../internal/runtime';
import { HeaderCheckbox, RowCheckbox, SelectionSummary } from '../components/selection';
import { ResizeHandle } from '../components/resize';
import { Pagination } from '../components/pagination';
import { ColumnSettings } from '../components/column-settings';
/*
 * 内置编辑器复用原有单元格边界，保留插槽对最终内容的控制权。
 * 数据入口单独提供编辑上下文，其他入口仍可显示只读控件。
 */
import { BuiltinCell, EditorTheme } from '../editors/cell';
import { EditingContext, useEditing } from '../internal/editing';
/*
 * 行详情独立管理展示状态，原生行模型继续只包含业务记录。
 * 展开后的详情与数据行共同参与虚拟窗口测量。
 */
import { useExpansion } from '../internal/expansion';
import type { BodyEntry } from '../internal/expansion';

/*
 * 渲染层接收原生实例，仅订阅影响模型和列布局的切片。
 * 行选择与拖动临时状态由局部控件订阅，避免刷新整个业务单元格区域。
 */
const emptySlots: NonNullable<RuntimeProps['slots']> = {};
const emptySlotProps: NonNullable<RuntimeProps['slotProps']> = {};
const densityHeights = { compact: 40, standard: 48, comfortable: 64 };
type ModelState = Pick<TableState<TableFeatures>, 'sorting' | 'columnFilters' | 'globalFilter' | 'pagination' | 'columnOrder' | 'columnVisibility' | 'columnSizing' | 'columnPinning'>;
const selectModelState = (state: TableState<TableFeatures>): ModelState => ({ sorting: state.sorting, columnFilters: state.columnFilters, globalFilter: state.globalFilter, pagination: state.pagination, columnOrder: state.columnOrder, columnVisibility: state.columnVisibility, columnSizing: state.columnSizing, columnPinning: state.columnPinning });

const CellContent = memo(function CellContent({ table, cell }: { table: RuntimeTable; cell: Cell<TableFeatures, RowData> }) {
  const { locale, slots, slotProps, root } = useUI();
  const node = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => () => {
    if (node.current?.contains(document.activeElement) && root.current?.isConnected) focusWithoutScroll(root.current);
  }, [root]);
  const rootProps = mergeDOM<ApexRootDOM>({ ref: node, className: 'apex-table-cell-content' }, slotProps.cellContent?.rootProps);
  /*
   * 插槽每次获得本次传入的原生 React 实例，不能保留旧外层对象。
   * 未变化的原生 cell 复用渲染元素，避免仅实例外层变化就执行业务渲染器。
   */
  const editor = cell.column.columnDef.meta?.apex?.editor;
  const children = useMemo(() => editor ? <BuiltinCell cell={cell} editor={editor} /> : <table.FlexRender cell={cell} />, [table.FlexRender, cell, editor]);
  return slots.cellContent ? <slots.cellContent {...{ table, cell, locale, rootProps, children }} /> : <div {...rootProps}>{children}</div>;
}, (previous, next) => previous.cell === next.cell && previous.table === next.table);

function HeaderCell({ table, track, header, index, tableId }: { table: RuntimeTable; track: Track; header?: Header<TableFeatures, RowData>; index: number; tableId: string }) {
  const { slots, slotProps, locale, root } = useUI();
  const element = useRef<HTMLTableCellElement>(null);
  useLayoutEffect(() => () => {
    if (element.current?.contains(document.activeElement) && root.current?.isConnected) focusWithoutScroll(root.current);
  }, [root]);
  const column = track.column!;
  const direction = column.getIsSorted?.() ?? false;
  const sortable = column.getCanSort?.() ?? false;
  const iconProps = mergeDOM({ 'aria-hidden': true as const, className: 'apex-table-sort-icon' }, slotProps.sortIcon?.rootProps);
  const icon = slots.sortIcon ? <slots.sortIcon direction={direction} rootProps={iconProps} /> : <span {...iconProps}>{direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}</span>;
  const rootProps = mergeDOM<ApexRootDOM>({ className: 'apex-table-header-content' }, slotProps.headerContent?.rootProps);
  /*
   * 使用原生排序事件处理器，尊重 enableMultiSort 和 isMultiSortEvent 配置。
   * 默认数据模式关闭多列排序，显式开启后可通过组合键追加排序列。
   */
  const sortButtonProps = mergeDOM({ type: 'button' as const, className: 'apex-table-sort-button', disabled: !sortable, 'aria-label': locale.sortColumn(columnLabel(column)), onClick: column.getToggleSortingHandler?.() }, slotProps.headerContent?.sortButtonProps);
  const children = <>{header ? <table.FlexRender header={header} /> : columnLabel(column)}{sortable && icon}</>;
  return <th ref={element} role="columnheader" scope="col" id={`${tableId}-col-${index}`} aria-colindex={index + 1} aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : sortable ? 'none' : undefined} className="apex-table-header-cell" data-column-id={column.id} data-pinned={track.sticky || undefined} data-align={column.columnDef.meta?.apex?.align} style={trackStyle(track)}>
    {slots.headerContent && header ? <slots.headerContent {...{ table, header, column, locale, rootProps, sortButtonProps, sortable, children }} /> : <div {...rootProps}>{sortable ? <button {...sortButtonProps} type="button">{children}</button> : children}</div>}
    <ResizeHandle table={table} column={column} renderedSize={track.size} />
  </th>;
}
/*
 * 展开按钮通过原生 button 支持回车和空格，交互控件不会触发行点击展开。
 * 展示索引包含详情行，业务序号仍使用分页内的数据索引。
 */
const DataRow = memo(function DataRow({ table, row, index, offset, tracks, tableId, onRowClick, bodyIndex, ariaIndex, canExpand, expanded, expandRowByClick, toggle, measure }: { table: RuntimeTable; row: RuntimeRow; index: number; offset: number; tracks: Track[]; tableId: string; onRowClick: RuntimeProps['onRowClick']; bodyIndex: number; ariaIndex: number; canExpand: boolean; expanded: boolean; expandRowByClick?: boolean; toggle(row: RuntimeRow): void; measure?: (node: HTMLTableRowElement | null) => void }) {
  const { root, locale } = useUI();
  const node = useRef<HTMLTableRowElement>(null);
  const rowRef = useCallback((element: HTMLTableRowElement | null) => { node.current = element; measure?.(element); }, [measure]);
  useLayoutEffect(() => () => {
    if (node.current?.contains(document.activeElement) && root.current?.isConnected) focusWithoutScroll(root.current);
  }, [root]);
  const nativeCells = row.getAllCells();
  const cells = useMemo(() => new Map(nativeCells.map((cell) => [cell.column.id, cell])), [nativeCells]);
  const children = tracks.map((track, colIndex) => <td role="cell" key={`${track.kind}:${track.key}`} headers={`${tableId}-col-${colIndex}`} aria-colindex={colIndex + 1} className="apex-table-cell" data-column-id={track.kind === 'column' ? track.key : undefined} data-apex-track={track.kind} data-pinned={track.sticky || undefined} data-align={track.column?.columnDef.meta?.apex?.align} style={trackStyle(track)}>
    {track.kind === 'expansion' ? canExpand && <button type="button" className="apex-table-expand-button" aria-label={expanded ? locale.collapseRow : locale.expandRow} aria-expanded={expanded} aria-controls={expanded ? `${tableId}-detail-${encodeURIComponent(row.id)}` : undefined} onClick={(event) => { event.stopPropagation(); toggle(row); }}><span aria-hidden="true">{expanded ? '−' : '+'}</span></button> : track.kind === 'selection' ? <RowCheckbox table={table} row={row} /> : track.kind === 'number' ? offset + index + 1 : cells.has(track.key) ? <CellContent table={table} cell={cells.get(track.key)!} /> : null}
  </td>);
  const render = (selected: boolean) => <tr ref={rowRef} role="row" aria-rowindex={ariaIndex} className="apex-table-row" data-row-id={row.id} data-index={bodyIndex} data-selected={selected || undefined} data-expanded={expanded || undefined} onClick={(event) => {
    if (event.defaultPrevented || isInteractive(event.target) || window.getSelection()?.toString()) return;
    onRowClick?.(row, event);
    if (!event.defaultPrevented && expandRowByClick && canExpand) toggle(row);
  }}>{children}</tr>;
  return table.atoms.rowSelection ? <table.Subscribe source={table.atoms.rowSelection} selector={(state) => !!state[row.id]}>{render}</table.Subscribe> : render(false);
});

/*
 * 详情使用单个跨列单元格，允许多行文字、嵌套组件及异步内容自然撑高。
 * ResizeObserver 由虚拟器维护；详情卸载时将内部焦点归还表格根节点。
 */
function ExpandedRow({ entry, bodyIndex, columns, tableId, render, measure }: { entry: BodyEntry; bodyIndex: number; columns: number; tableId: string; render: NonNullable<RuntimeProps['expandable']>['expandedRowRender']; measure?: (node: HTMLTableRowElement | null) => void }) {
  const { root } = useUI();
  const node = useRef<HTMLTableRowElement>(null);
  const rowRef = useCallback((element: HTMLTableRowElement | null) => { node.current = element; measure?.(element); }, [measure]);
  useLayoutEffect(() => () => {
    if (node.current?.contains(document.activeElement) && root.current?.isConnected) focusWithoutScroll(root.current);
  }, [root]);
  return <tr ref={rowRef} role="row" aria-rowindex={bodyIndex + 2} id={`${tableId}-detail-${encodeURIComponent(entry.row.id)}`} className="apex-table-expanded-row" data-index={bodyIndex}>
    <td role="cell" colSpan={columns} aria-colspan={columns} className="apex-table-expanded-cell">{render(entry.row.original, entry.index, 0, true)}</td>
  </tr>;
}

function BodyState({ props, error, filtered, rows, height }: { props: RuntimeProps; error?: ApexDiagnostic; filtered: boolean; rows: number; height: number }) {
  const { slots, slotProps, locale } = useUI();
  if (error || (!props.loading && (props.error !== null && props.error !== undefined) && props.error !== false && props.error !== '')) {
    const rootProps = mergeDOM<ApexRootDOM>({ className: 'apex-table-error', role: 'alert' }, slotProps.error?.rootProps);
    const retryButtonProps = !error && props.onRetry ? mergeDOM({ type: 'button' as const, onClick: props.onRetry }, slotProps.error?.retryButtonProps) : undefined;
    const children = <><strong>{error?.message ?? locale.error}</strong>{retryButtonProps && <button {...retryButtonProps} type="button">{locale.retry}</button>}</>;
    return slots.error ? <slots.error {...{ locale, error: error ?? props.error, diagnostic: error, rootProps, retryButtonProps, children }} /> : <div {...rootProps}>{children}</div>;
  }
  if (props.loading) {
    const rootProps = mergeDOM<ApexRootDOM>({ className: 'apex-table-skeleton', role: 'status', 'aria-label': locale.loading }, slotProps.loading?.rootProps);
    const children = <><span className="apex-table-visually-hidden">{locale.loading}</span>{Array.from({ length: Math.min(16, Math.max(3, Math.ceil(height / rows))) }).map((_, index) => <div key={index} className="apex-table-skeleton-row" aria-hidden="true"><span /><span /><span /><span /></div>)}</>;
    return slots.loading ? <slots.loading {...{ locale, rootProps, children }} /> : <div {...rootProps}>{children}</div>;
  }
  const rootProps = mergeDOM<ApexRootDOM>({ className: 'apex-table-empty', role: 'status' }, slotProps.empty?.rootProps);
  const children = props.table.getAllLeafColumns().every((column) => column.getIsVisible?.() === false) ? locale.noColumns : filtered ? locale.noMatches : locale.empty;
  return slots.empty ? <slots.empty {...{ locale, filtered, rootProps, children }} /> : <div {...rootProps}>{children}</div>;
}

function Surface({ props, model, imperativeRef }: { props: RuntimeProps; model: ModelState; imperativeRef: ForwardedRef<ApexTableRef> }) {
  const { table } = props;
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const tableId = useId();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, measured: false });
  const [internalDensity, setInternalDensity] = useState<ApexDensity>(props.defaultDensity ?? 'standard');
  const [settings, setSettings] = useState(false);
  const closeSettings = useCallback(() => setSettings(false), []);
  const density = props.density ?? internalDensity;
  const rowHeight = props.rowHeight ?? densityHeights[density];
  const validHeight = Number.isFinite(rowHeight) && rowHeight >= 32;
  const safeHeight = validHeight ? rowHeight : 48;
  const locale = useMemo(() => ({ ...zhCN, ...Object.fromEntries(Object.entries(props.locale ?? {}).filter(([, value]) => value !== undefined)) }), [props.locale]);
  const slots = props.slots ?? emptySlots;
  const slotProps = props.slotProps ?? emptySlotProps;
  const closeSignal = useMemo(() => ({}), [model.sorting, model.columnFilters, model.globalFilter, model.pagination?.pageIndex, model.pagination?.pageSize]);
  /*
   * 分页和选择按数据模式的实际配置显示，原生实例仍保留能力探测。
   * 同一标记传递到选择摘要与全选控件，避免基础列表受到已安装特性的影响。
   */
  const hasPagination = props.paginationEnabled ?? (typeof table.getPaginatedRowModel === 'function' && typeof table.getPageCount === 'function');
  const hasSelection = props.selectionEnabled ?? !!table.atoms.rowSelection;
  const ui = useMemo(() => ({ root, viewport, locale, slots, slotProps, closeSignal, getPopupContainer: props.getPopupContainer, paginationEnabled: hasPagination, selectionEnabled: hasSelection }), [locale, slots, slotProps, closeSignal, props.getPopupContainer, hasPagination, hasSelection]);
  const rowModel = table.getRowModel();
  const rows = rowModel.rows;
  const coreRows = table.getCoreRowModel().rows;
  const { entries, toggle } = useExpansion(props.expandable, coreRows, rows);
  const rawOverscan = typeof props.virtualization === 'object' ? props.virtualization.overscan ?? 8 : 8;
  const validOverscan = Number.isInteger(rawOverscan) && rawOverscan >= 0;
  const overscan = validOverscan ? rawOverscan : 8;
  const virtual = props.virtualization === undefined || props.virtualization === 'auto' ? !hasPagination || rows.length > 200 : props.virtualization !== false;
  /*
   * 启用列设置时默认展示序号列，让齿轮入口直接位于行号上方。
   * 显式关闭序号列或自定义其宽度、固定位置时，仍尊重调用方配置。
   */
  const showRowNumber = props.showRowNumber ?? !!props.columnSettingsEnabled;
  /*
   * 展开列复用辅助列布局，固定列偏移自动包含新增宽度。
   * 列配置只依赖几何字段，展开状态变化不重建普通单元格布局。
   */
  const showExpansion = !!props.expandable?.expandedRowRender && props.expandable.showExpandColumn !== false;
  const expansionWidth = props.expandable?.columnWidth;
  const expansionFixed = props.expandable?.fixed;
  const tracks = useMemo(() => calculateLayout(table, dimensions.width, props.showSelectionColumn ?? false, showRowNumber, showExpansion ? { size: expansionWidth, sticky: expansionFixed === 'right' ? 'end' : expansionFixed ? 'start' : false } : false), [table.store, table.options.columns, table.options.defaultColumn, model.columnOrder, model.columnVisibility, model.columnSizing, model.columnPinning, dimensions.width, props.showSelectionColumn, showRowNumber, showExpansion, expansionWidth, expansionFixed]);
  const width = tracks.reduce((sum, track) => sum + track.size, 0);
  const identityError = useMemo(() => {
    const ids = new Set<string>();
    if (coreRows.some((row) => !row.id || ids.size === ids.add(row.id).size)) return 'duplicateRowId';
    const columns = table.getAllFlatColumns();
    const columnIds = new Set<string>();
    if (columns.some((column) => !column.id || columnIds.size === columnIds.add(column.id).size)) return 'duplicateColumnId';
    return undefined;
  }, [coreRows, table.options.columns, table.store]);
  const headers = table.getHeaderGroups();
  const nestedRows = useMemo(() => coreRows.some((row) => row.subRows?.length), [coreRows]);
  const unsupported = headers.length > 1 || nestedRows || !!table.atoms.grouping?.get()?.length;
  const badPagination = hasPagination && model.pagination && (!Number.isInteger(model.pagination.pageIndex) || model.pagination.pageIndex < 0 || !Number.isInteger(model.pagination.pageSize) || model.pagination.pageSize < 1);
  const invalid = !validHeight || !validOverscan || tracks.some((track) => !Number.isFinite(track.size) || track.size <= 0) || (typeof props.height === 'number' && (!Number.isFinite(props.height) || props.height <= 0));
  const unmeasurable = dimensions.measured && dimensions.width > 0 && dimensions.height <= 44;
  /*
   * 分页与几何配置分别诊断，让调用方能定位实际无效的原生切片。
   * 只停止不可靠的界面操作，不通过 setter 改写传入的非法值。
   */
  const errorCode = identityError ?? (badPagination ? 'invalidPagination' : invalid ? 'invalidGeometry' : unsupported ? 'unsupportedLayout' : unmeasurable ? 'unmeasurable' : undefined);
  const configError = errorCode ? diagnostic(errorCode, locale[errorCode]) : undefined;
  const failed = (props.error !== null && props.error !== undefined) && props.error !== false && props.error !== '';
  const unavailable = !!configError || !!props.loading || failed;
  const hasColumns = tracks.some((track) => track.kind === 'column');
  const filtered = !!model.columnFilters?.length || ((model.globalFilter !== null && model.globalFilter !== undefined) && model.globalFilter !== '' && model.globalFilter !== false);
  const canRender = !unavailable && hasColumns && dimensions.width > 0 && dimensions.height > 0;
  /*
   * 每条展开详情作为独立虚拟项测量，分页条数仍只统计数据记录。
   * 表头高度同时用作滚动边距，定位行时避免目标被固定表头遮住。
   */
  const getItemKey = useCallback((index: number) => entries[index]?.key ?? index, [entries]);
  const virtualizer = useVirtualizer({ count: canRender && virtual ? entries.length : 0, getScrollElement: () => viewport.current, estimateSize: () => safeHeight, getItemKey, overscan, scrollMargin: 44, scrollPaddingStart: 44, enabled: canRender && virtual });
  const items = virtualizer.getVirtualItems();
  /*
   * 隐藏后恢复时，虚拟窗口可能晚于容器尺寸重新建立。
   * 等占位轨道已经挂载再恢复锚点，避免滚动目标被临时空表体钳制为零。
   */
  const anchorReady = canRender && (!virtual || items.length > 0);
  const range = virtual ? items.map((item) => item.index) : canRender ? entries.map((_, index) => index) : [];
  const top = items.length ? Math.max(0, items[0].start - 44) : 0;
  const bottom = items.length ? Math.max(0, virtualizer.getTotalSize() - (items[items.length - 1].end - 44)) : 0;
  const anchor = useRef<{ id?: string; rowId?: string; index: number; offset: number }>({ index: 0, offset: 0 });
  /*
   * 普通渲染读取真实行位置，虚拟渲染使用已测量的偏移。
   * 同一定位路径服务于锚点恢复和公开 scrollToRow，避免按固定行高猜测详情位置。
   */
  const getEntryOffset = useCallback((index: number) => {
    if (virtual) return virtualizer.getOffsetForIndex(index, 'start')?.[0] ?? 0;
    const element = viewport.current?.querySelector<HTMLTableRowElement>(`:scope > .apex-table-grid > .apex-table-body > tr[data-index="${index}"]`);
    return element && viewport.current ? element.getBoundingClientRect().top - viewport.current.getBoundingClientRect().top + viewport.current.scrollTop - 44 : 0;
  }, [virtual, virtualizer]);
  const previousQuery = useRef({ source: table.store, sorting: model.sorting, filters: model.columnFilters, global: model.globalFilter, page: model.pagination });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const next = { width: element.clientWidth, height: element.clientHeight, measured: true };
      setDimensions((old) => old.measured && old.width === next.width && old.height === next.height ? old : next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const previous = previousQuery.current;
    const changed = previous.source !== table.store || previous.sorting !== model.sorting || previous.filters !== model.columnFilters || previous.global !== model.globalFilter || previous.page?.pageIndex !== model.pagination?.pageIndex || previous.page?.pageSize !== model.pagination?.pageSize;
    previousQuery.current = { source: table.store, sorting: model.sorting, filters: model.columnFilters, global: model.globalFilter, page: model.pagination };
    if (!viewport.current) return;
    if (changed) { viewport.current.scrollTop = 0; anchor.current = { index: 0, offset: 0 }; }
    else if (anchorReady) {
      const match = anchor.current.id ? entries.findIndex((entry) => entry.key === anchor.current.id) : anchor.current.index;
      const fallback = entries.findIndex((entry) => !entry.detail && entry.row.id === anchor.current.rowId);
      const index = Math.max(0, Math.min(entries.length - 1, match < 0 ? fallback < 0 ? anchor.current.index : fallback : match));
      viewport.current.scrollTop = getEntryOffset(index) + (match >= 0 && entries[index]?.detail ? anchor.current.offset : Math.min(anchor.current.offset, safeHeight - 1));
    }
    viewport.current.scrollLeft = Math.min(viewport.current.scrollLeft, Math.max(0, width - viewport.current.clientWidth));
  }, [entries, safeHeight, model.sorting, model.columnFilters, model.globalFilter, model.pagination, table.store, canRender, anchorReady, width, getEntryOffset]);
  /*
   * 密度变化清空旧尺寸后立即补测已挂载项，保留详情的实际高度。
   * 查询限定当前表体，避免将详情里的嵌套表格错误注册到外层虚拟器。
   */
  useLayoutEffect(() => {
    virtualizer.measure();
    if (virtual) viewport.current?.querySelectorAll<HTMLTableRowElement>(':scope > .apex-table-grid > .apex-table-body > tr[data-index]').forEach((element) => virtualizer.measureElement(element));
  }, [safeHeight, virtual, virtualizer]);
  useEffect(() => { closeSettings(); }, [table.store, closeSettings]);
  useEffect(() => {
    const report = props.onDiagnostic ?? ((event: ApexDiagnostic) => console.warn(`ApexTableReact: ${event.message}`));
    if (errorCode) report(diagnostic(errorCode, locale[errorCode]));
    if (!virtual && rows.length > 1000) report(diagnostic('virtualizationDisabled', locale.virtualizationDisabled));
    if (hasProtectedProps(slotProps)) report(diagnostic('protectedProp', locale.protectedProp));
  }, [errorCode, virtual, rows.length, props.onDiagnostic, locale, slotProps]);
  /*
   * 刷新入口沿用组件引用，保留聚焦与滚动方法；本地和原生实例模式不发起请求。
   * 请求回调随当前入口更新，切换模式后不会调用已卸载请求组件的状态更新器。
   */
  useImperativeHandle(imperativeRef, () => ({ reload: (options) => props.requestReload?.(options), focus: () => focusWithoutScroll(root.current), scrollToRow: (rowId) => {
    if (!canRender) return false;
    const index = entries.findIndex((entry) => !entry.detail && entry.row.id === rowId);
    if (index < 0 || !viewport.current) return false;
    if (virtual) virtualizer.scrollToIndex(index, { align: 'start' });
    else viewport.current.scrollTop = getEntryOffset(index);
    return true;
  } }), [entries, virtual, virtualizer, getEntryOffset, canRender, props.requestReload]);
  const setDensity = (next: ApexDensity) => { if (props.density === undefined) setInternalDensity(next); props.onDensityChange?.(next); };
  const toolbarProps = mergeDOM<ApexRootDOM>({ className: 'apex-table-toolbar' }, slotProps.toolbar?.rootProps);
  /*
   * 序号表头以齿轮图标提供列设置入口，行内仍显示原来的序号。
   * 显式关闭序号列时保留工具栏入口，自定义工具栏继续获得原有控制能力。
   */
  const settingsTrigger = props.columnSettingsEnabled ? <button data-apex-settings-trigger type="button" className="apex-table-settings-trigger" aria-label={locale.columnSettings} title={locale.columnSettings} aria-haspopup="dialog" aria-expanded={settings} onClick={() => setSettings(!settings)}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m9 3-.5 2a8 8 0 0 0-1.7 1L4.8 5.4l-3 5.2 1.5 1.4a8 8 0 0 0 0 2l-1.5 1.4 3 5.2 2-.6a8 8 0 0 0 1.7 1l.5 2h6l.5-2a8 8 0 0 0 1.7-1l2 .6 3-5.2-1.5-1.4a8 8 0 0 0 0-2l1.5-1.4-3-5.2-2 .6a8 8 0 0 0-1.7-1L15 3Z" transform="translate(1.2 0) scale(.9)" /><circle cx="12" cy="12" r="3" /></svg>
  </button> : null;
  const toolbarChildren = <>{!showRowNumber && settingsTrigger}</>;
  /*
   * 选择统计与分页总数共享底栏；没有分页时也保留独立底栏。
   * 顶部只在存在自定义工具栏或备用设置入口时占用高度。
   */
  const showPagination = props.pagination !== false && hasPagination;
  const nativeOffset = hasPagination && model.pagination ? model.pagination.pageIndex * model.pagination.pageSize : 0;
  const totalRows = unavailable ? undefined : hasPagination ? table.getPageCount() < 0 ? undefined : table.getRowCount() : rows.length;
  const headerMap = new Map(headers.flatMap((group) => group.headers).map((header) => [header.column.id, header]));
  return <UIContext.Provider value={ui}>
    <div ref={root} className={['apex-table', props.className].filter(Boolean).join(' ')} style={{ ...props.style, height: props.height ?? '100%', '--apex-geometry-row-height': `${safeHeight}px` } as CSSProperties} tabIndex={-1} data-density={density} aria-busy={props.loading || undefined}>
      {(slots.toolbar || (!showRowNumber && props.columnSettingsEnabled)) && (slots.toolbar ? <slots.toolbar {...{ table, locale, density, setDensity, openColumnSettings: () => setSettings(true), rootProps: toolbarProps, children: toolbarChildren }} /> : <div {...toolbarProps}>{toolbarChildren}</div>)}
      {settings && <ColumnSettings table={table} width={dimensions.width} tracks={tracks} onClose={closeSettings} />}
      <div ref={viewport} className="apex-table-viewport" onScroll={(event) => {
        /*
         * display:none 可能先产生滚动归零事件，再通知尺寸观察器。
         * 读取实时可见尺寸，并忽略虚拟轨道尚未恢复时的临时滚动事件。
         */
        if (!anchorReady || !event.currentTarget.clientWidth || event.currentTarget.clientHeight <= 44) return;
        /*
         * 锚点可落在详情内部，记录实际高度偏移而非固定行高的余数。
         * 非虚拟列表从已挂载的行寻找位置，避免展开后滚动定位逐行漂移。
         */
        const scrollTop = event.currentTarget.scrollTop;
        const item = virtual ? virtualizer.getVirtualItemForOffset(scrollTop + 44) : undefined;
        const bodyRows = virtual ? [] : Array.from(event.currentTarget.querySelectorAll<HTMLTableRowElement>(':scope > .apex-table-grid > .apex-table-body > tr[data-index]'));
        const visible = bodyRows.find((element) => element.getBoundingClientRect().bottom > event.currentTarget.getBoundingClientRect().top + 44);
        const index = item?.index ?? (visible ? Number(visible.dataset.index) : 0);
        anchor.current = { id: entries[index]?.key, rowId: entries[index]?.row.id, index, offset: Math.max(0, scrollTop - (item ? item.start - 44 : getEntryOffset(index))) };
      }}>
        <table role="table" aria-label={props.name ?? locale.tableName} aria-rowcount={props.expandable ? entries.length + 1 : totalRows === undefined ? -1 : totalRows + 1} aria-colcount={tracks.length} className="apex-table-grid" style={{ width: Math.max(width, dimensions.width) }}>
          <thead role="rowgroup" className="apex-table-header"><tr role="row" aria-rowindex={1}>
            {tracks.map((track, index) => track.kind === 'column' ? <HeaderCell key={`column:${track.key}`} table={table} track={track} index={index} tableId={tableId} header={headerMap.get(track.key)} /> : <th role="columnheader" scope="col" key={track.key} id={`${tableId}-col-${index}`} aria-colindex={index + 1} aria-label={track.kind === 'number' ? locale.rowNumber : track.kind === 'expansion' ? locale.expansion : undefined} className="apex-table-header-cell" data-pinned={track.sticky || undefined} style={trackStyle(track)}>{track.kind === 'expansion' ? props.expandable?.columnTitle : track.kind === 'selection' ? <HeaderCheckbox table={table} unavailable={unavailable} /> : settingsTrigger ?? locale.rowNumber}</th>)}
          </tr></thead>
          <tbody role="rowgroup" className="apex-table-body">
            {canRender && rows.length > 0 && <>
              {top > 0 && <tr aria-hidden="true" role="presentation" className="apex-table-spacer" style={{ height: top }}><td /></tr>}
              {range.map((index) => {
                const entry = entries[index];
                return entry.detail ? <ExpandedRow key={entry.key} entry={entry} bodyIndex={index} columns={tracks.length} tableId={tableId} render={props.expandable!.expandedRowRender} measure={virtual ? virtualizer.measureElement : undefined} /> : <DataRow key={entry.key} table={table} row={entry.row} index={entry.index} offset={nativeOffset} tracks={tracks} tableId={tableId} onRowClick={props.onRowClick} bodyIndex={index} ariaIndex={(props.expandable ? index : nativeOffset + entry.index) + 2} canExpand={entry.canExpand} expanded={entry.expanded} expandRowByClick={props.expandable?.expandRowByClick} toggle={toggle} measure={virtual ? virtualizer.measureElement : undefined} />;
              })}
              {bottom > 0 && <tr aria-hidden="true" role="presentation" className="apex-table-spacer" style={{ height: bottom }}><td /></tr>}
            </>}
          </tbody>
        </table>
        {(unavailable || !rows.length || !hasColumns) && <BodyState props={props} error={configError} filtered={filtered} rows={safeHeight} height={dimensions.height} />}
      </div>
      {showPagination ? <Pagination table={table} unavailable={unavailable} pageSizeOptions={typeof props.pagination === 'object' ? props.pagination.pageSizeOptions : undefined} /> : hasSelection && <div className="apex-table-pagination"><SelectionSummary table={table} /></div>}
    </div>
  </UIContext.Provider>;
}
/*
 * 两种接入方式共用原生状态订阅和界面渲染，避免重复实现布局逻辑。
 * 引用继续传递到实际表格，保留聚焦与滚动定位能力。
 */
function NativeTable({ props, imperativeRef }: { props: RuntimeProps; imperativeRef: ForwardedRef<ApexTableRef> }) {
  return <EditorTheme config={props.editorConfig} getPopupContainer={props.getPopupContainer}><props.table.Subscribe selector={selectModelState}>{(model) => <Surface props={props} model={model} imperativeRef={imperativeRef} />}</props.table.Subscribe></EditorTheme>;
}

/*
 * 数据模式内置本地行模型与常用特性，所有原生选项直接由 props 提交。
 * 未配置分页时保留连续列表，服务端模式使用原生 manual 选项跳过本地计算。
 * 回调未提供时使用原生状态更新器，移除受控配置后也能恢复内部状态管理。
 */
const managedOptionDefaults = {
  state: undefined, initialState: undefined, defaultColumn: undefined, getRowId: undefined, getSubRows: undefined,
  meta: undefined, renderFallbackValue: null, autoResetAll: undefined, autoResetPageIndex: undefined, autoResetSorting: false,
  enableColumnFilters: true, enableFilters: true, filterFromLeafRows: false, maxLeafRowFilterDepth: 100,
  enableColumnPinning: true, enableHiding: true, enableGlobalFilter: true, globalFilterFn: 'auto',
  columnResizeMode: 'onEnd', columnResizeDirection: 'ltr', pageCount: undefined, rowCount: undefined,
  enableRowRangeSelection: true, enableMultiRowSelection: true, enableSubRowSelection: true,
  enableMultiRemove: true, enableSortingRemoval: true, maxMultiSortColCount: undefined, sortDescFirst: undefined,
} satisfies Partial<ApexTableReactDataProps<RowData>>;

/*
 * 请求结果进入此组件前已转换为普通数据 props，原生实例无需感知异步请求。
 * 本地与外部手动分页仍直接使用原来的选项管理路径。
 */
function ManagedTable({ props, imperativeRef, requestReload }: { props: ApexTableReactLocalProps<RowData>; imperativeRef: ForwardedRef<ApexTableRef>; requestReload?: ApexTableRef['reload'] }) {
  const { tableRef, editable, onDataChange, ...options } = props;
  const editing = useEditing({ ...props, editable, onDataChange });
  const paginationEnabled = !!props.pagination || !!props.manualPagination || !!props.state?.pagination || !!props.initialState?.pagination;
  const selectionEnabled = !!props.showSelectionColumn || !!props.enableRowSelection;
  const table: ApexTableInstance<RowData> = useTable({
    ...managedOptionDefaults,
    ...options,
    features: managedFeatures,
    /*
     * 原生 Hook 合并历史选项；每次补齐默认值，移除 props 后不保留旧权限或总数。
     * 原生默认判定延迟到交互时读取实例，保持全局过滤和组合键行为一致。
     */
    getColumnCanGlobalFilter: props.getColumnCanGlobalFilter ?? ((column) => managedFeatures.globalFilteringFeature.getDefaultTableOptions!(table)!.getColumnCanGlobalFilter!(column)),
    isMultiSortEvent: props.isMultiSortEvent ?? ((event) => managedFeatures.rowSortingFeature.getDefaultTableOptions!(table)!.isMultiSortEvent!(event)),
    isRowRangeSelectionEvent: props.isRowRangeSelectionEvent ?? ((event) => managedFeatures.rowSelectionFeature.getDefaultTableOptions!(table)!.isRowRangeSelectionEvent!(event)),
    onSortingChange: props.onSortingChange ?? ((updater) => makeStateUpdater('sorting', table)(updater)),
    onColumnFiltersChange: props.onColumnFiltersChange ?? ((updater) => makeStateUpdater('columnFilters', table)(updater)),
    onGlobalFilterChange: props.onGlobalFilterChange ?? ((updater) => makeStateUpdater('globalFilter', table)(updater)),
    onPaginationChange: props.onPaginationChange ?? ((updater) => makeStateUpdater('pagination', table)(updater)),
    onRowSelectionChange: props.onRowSelectionChange ?? ((updater) => makeStateUpdater('rowSelection', table)(updater)),
    onColumnOrderChange: props.onColumnOrderChange ?? ((updater) => makeStateUpdater('columnOrder', table)(updater)),
    onColumnVisibilityChange: props.onColumnVisibilityChange ?? ((updater) => makeStateUpdater('columnVisibility', table)(updater)),
    onColumnSizingChange: props.onColumnSizingChange ?? ((updater) => makeStateUpdater('columnSizing', table)(updater)),
    onColumnPinningChange: props.onColumnPinningChange ?? ((updater) => makeStateUpdater('columnPinning', table)(updater)),
    onColumnResizingChange: props.onColumnResizingChange ?? ((updater) => makeStateUpdater('columnResizing', table)(updater)),
    enableSorting: props.enableSorting ?? false,
    enableMultiSort: props.enableMultiSort ?? false,
    enableRowSelection: props.enableRowSelection ?? !!props.showSelectionColumn,
    enableColumnResizing: props.enableColumnResizing ?? !!props.columnSettingsEnabled,
    manualPagination: props.manualPagination ?? !paginationEnabled,
    manualSorting: props.manualSorting ?? false,
    manualFiltering: props.manualFiltering ?? false,
    /*
     * 编辑时数据变化不自动跳回第一页，用户显式配置仍优先。
     * 排序和筛选继续由原生行模型计算，写入位置使用原始行身份。
     */
    autoResetPageIndex: props.autoResetPageIndex ?? (editable ? false : undefined),
  }, () => null);
  /*
   * 实例引用只在提交后公开，由 React 自动处理引用变更与卸载清理。
   * 页面通过原生 setter 控制表格，原有 ref 仍专门负责聚焦和滚动。
   */
  useImperativeHandle(tableRef, () => table, [table]);
  return <EditingContext.Provider value={editing}><NativeTable props={{ ...props, table, paginationEnabled, selectionEnabled, requestReload } as unknown as RuntimeProps} imperativeRef={imperativeRef} /></EditingContext.Provider>;
}

/*
 * 请求状态先转换为普通数据 props，所有实例和界面行为沿用同一组件。
 * 独立边界确保卸载或切回本地数据时清理在途请求。
 */
function RequestTable({ props, imperativeRef }: { props: ApexTableReactRequestProps<RowData>; imperativeRef: ForwardedRef<ApexTableRef> }) {
  const { dataProps, reload } = useRequestProps(props);
  /*
   * 自动请求结果没有业务侧数据回写通道，运行时同样禁止编辑。
   * 需要远程保存时由业务使用 data 模式管理加载和提交。
   */
  return <ManagedTable props={{ ...dataProps, editable: false, onDataChange: undefined }} imperativeRef={imperativeRef} requestReload={reload} />;
}

/*
 * 实例、本地数据和请求通过独立子组件隔离，切换方式时不改变 Hook 调用顺序。
 * 请求模式负责异步状态，兼容入口继续使用调用方的实例。
 */
function ApexTableReactImpl(props: RuntimeProps | ApexTableReactDataProps<RowData>, ref: ForwardedRef<ApexTableRef>) {
  if (props.table) return <NativeTable props={props} imperativeRef={ref} />;
  const dataProps = props as ApexTableReactDataProps<RowData>;
  return dataProps.request ? <RequestTable props={dataProps} imperativeRef={ref} /> : <ManagedTable props={dataProps as ApexTableReactLocalProps<RowData>} imperativeRef={ref} />;
}
const ForwardedApexTableReact = forwardRef(ApexTableReactImpl);
ForwardedApexTableReact.displayName = 'ApexTableReact';

/*
 * 基础签名从数据或请求推断行类型，实例签名保留原生特性与所选状态的推断。
 * 两种签名均转发同一组公开引用方法，并禁止混用数据来源。
 */
export const ApexTableReact = ForwardedApexTableReact as {
  <D extends RowData>(props: ApexTableReactDataProps<D> & RefAttributes<ApexTableRef>): ReactElement;
  <F extends TableFeatures, D extends RowData, S = TableState<F>>(props: ApexTableProps<F, D, S> & { columns?: never; data?: never; request?: never; tableRef?: never } & RefAttributes<ApexTableRef>): ReactElement;
};
