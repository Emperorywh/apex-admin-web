import type { Cell, CellData, Column, ColumnDef, Header, PaginationState, ReactTable, Row, RowData, RowSelectionState, TableFeatures, TableOptions, TableState } from '@tanstack/react-table';
import type { managedFeatures } from './internal/features';
/*
 * 选择插槽直接使用 antd 复选框的公开属性与引用类型。
 * 业务可完整转发控制属性，半选状态由 Checkbox 自行同步。
 */
import type { Checkbox } from 'antd';
/*
 * 编辑器类型独立声明，统一从包入口导出，业务无需访问内部实现。
 * 列元数据沿用原生行泛型，编辑权限和属性工厂能够推断业务记录。
 */
import type { ApexCellChange, ApexCellEditor, ApexEditorConfig } from './editors/types';
export type { ApexCellChange, ApexCellContext, ApexCellEditor, ApexEditorConfig, ApexEditorPropsMap, ApexEditorType, ApexSelectValue } from './editors/types';
import type { AriaAttributes, ButtonHTMLAttributes, ComponentPropsWithRef, ComponentType, CSSProperties, HTMLAttributes, InputHTMLAttributes, MouseEvent, ReactNode, Ref, SelectHTMLAttributes } from 'react';

/*
 * 元数据提供界面和内置编辑器配置；业务可通过原生 columnMeta 槽交叉合并。
 * 全局声明合并保留已有业务字段，不重复定义原生尺寸或权限字段。
 */
export interface ApexColumnMeta<D = RowData> {
  align?: 'start' | 'center' | 'end';
  flex?: number;
  pinPriority?: number;
  canReorder?: boolean;
  label?: string;
  editor?: ApexCellEditor<D>;
}
declare module '@tanstack/react-table' {
  /*
   * 原生声明合并必须保留全部泛型形参，即使扩展不消费这些形参。
   * 仅对这一条声明关闭未使用形参检查，其他公开类型继续严格检查。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TFeatures extends TableFeatures, TData extends RowData, TValue extends CellData> {
    apex?: ApexColumnMeta<TData>;
  }
}
export type ApexDensity = 'compact' | 'standard' | 'comfortable';
/*
 * 根节点允许直接传入公开主题变量，品牌示例无需加载额外样式文件。
 * 普通样式仍沿用 React 的属性类型，几何输出变量不属于公开输入。
 */
export type ApexTableStyle = CSSProperties & { [K in `--apex-table-${string}`]?: string | number };
export type ApexTrack = boolean | { size?: number; sticky?: false | 'start' | 'end' };
/*
 * 行详情使用原始记录，展开身份统一采用 getRowId 生成的字符串 ID。
 * 受控与默认展开相互独立，不占用原生树形数据的 expanded 状态。
 */
export interface ApexExpandable<D> {
  expandedRowRender(record: D, index: number, indent: number, expanded: boolean): ReactNode;
  rowExpandable?(record: D): boolean;
  expandedRowKeys?: readonly string[];
  defaultExpandedRowKeys?: readonly string[];
  defaultExpandAllRows?: boolean;
  onExpand?(expanded: boolean, record: D): void;
  onExpandedRowsChange?(expandedKeys: string[]): void;
  expandRowByClick?: boolean;
  showExpandColumn?: boolean;
  columnWidth?: number;
  columnTitle?: ReactNode;
  fixed?: boolean | 'left' | 'right';
}
/*
 * 主动刷新默认保留当前页、排序和筛选，可显式要求从第一页重新查询。
 * 此选项只作用于 request 模式，其他数据入口的刷新由调用方管理。
 */
export interface ApexTableReloadOptions { resetPageIndex?: boolean }
export interface ApexTableRef {
  focus(): void;
  scrollToRow(rowId: string): boolean;
  reload(options?: ApexTableReloadOptions): void;
}
export type ApexDiagnosticCode = 'invalidGeometry' | 'invalidPagination' | 'duplicateRowId' | 'duplicateColumnId' | 'unmeasurable' | 'unsupportedLayout' | 'virtualizationDisabled' | 'protectedProp';
export interface ApexDiagnostic { code: ApexDiagnosticCode; message: string }
export interface ApexLocale {
  tableName: string;
  loading: string;
  empty: string;
  noMatches: string;
  noColumns: string;
  error: string;
  retry: string;
  columnSettings: string;
  /*
   * 配置弹窗文案统一开放，键盘拖动提示也可由业务本地化。
   * 固定位置下拉框统一表达不固定、左侧固定与右侧固定。
   */
  fieldName: string;
  pinPosition: string;
  displayStatus: string;
  settingsHint: string;
  cancel: string;
  confirm: string;
  invalidColumnWidth: string;
  reorderBlocked: string;
  dragColumn: string;
  dragInstructions: string;
  close: string;
  resetLayout: string;
  clearSelection: string;
  selectPage: string;
  selectResults: string;
  rowNumber: string;
  /*
   * 展开入口的可访问名称支持业务本地化。
   * 表头与按钮分别命名，读屏可区分展开和收起动作。
   */
  expansion: string;
  expandRow: string;
  collapseRow: string;
  previousPage: string;
  nextPage: string;
  pageSize: string;
  jumpToPage: string;
  pageUnit: string;
  pinStart: string;
  pinEnd: string;
  unpin: string;
  moveUp: string;
  moveDown: string;
  width: string;
  showColumn: string;
  minOneColumn: string;
  pinSpace: string;
  unknownTotal: string;
  unsupportedLayout: string;
  invalidGeometry: string;
  invalidPagination: string;
  duplicateRowId: string;
  duplicateColumnId: string;
  unmeasurable: string;
  virtualizationDisabled: string;
  protectedProp: string;
  compact: string;
  standard: string;
  comfortable: string;
  density: string;
  selectRow(id: string): string;
  sortColumn(label: string): string;
  resizeColumn(label: string): string;
  page(index: number): string;
  total(count: number): string;
  selected(count: number): string;
  perPage(count: number): string;
}

/*
 * 插槽补充属性在类型层排除状态、语义、身份和几何。
 * 完整 props 包仍包含必要属性，替换控件必须转发到对应真实元素。
 * 业务菜单使用 antd Dropdown 自身的属性，不再提供内置菜单插槽。
 */
type Geometry = 'position' | 'display' | 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight' | 'top' | 'bottom' | 'left' | 'right' | 'inset' | 'transform' | 'overflow' | 'overflowX' | 'overflowY' | 'flex' | 'flexBasis' | 'gridTemplateColumns' | 'boxSizing' | 'zIndex';
type Protected = 'id' | 'role' | 'tabIndex' | 'children' | 'style' | 'dangerouslySetInnerHTML' | 'checked' | 'defaultChecked' | 'disabled' | 'type' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'aria-label' | 'aria-labelledby' | 'aria-checked' | 'aria-sort' | 'aria-rowindex' | 'aria-colindex' | 'aria-rowcount' | 'aria-colcount' | 'aria-busy' | 'aria-expanded' | 'aria-controls' | 'aria-haspopup' | 'aria-hidden' | 'aria-current' | 'aria-orientation' | 'aria-valuenow' | 'aria-valuemin' | 'aria-valuemax' | 'aria-live' | 'aria-modal';
export type ApexDOMExtension<T> = Omit<T, Protected> & { style?: Omit<CSSProperties, Geometry> };
export type ApexRootDOM = HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
export type ApexButtonDOM = ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> };
export type ApexInputDOM = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };
export type ApexSelectDOM = SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> };
export type ApexCheckboxDOM = ComponentPropsWithRef<typeof Checkbox> & AriaAttributes & { indeterminate: boolean };
export interface ApexSlotProps {
  toolbar?: { rootProps?: ApexDOMExtension<ApexRootDOM> };
  headerContent?: { rootProps?: ApexDOMExtension<ApexRootDOM>; sortButtonProps?: ApexDOMExtension<ApexButtonDOM> };
  sortIcon?: { rootProps?: ApexDOMExtension<ComponentPropsWithRef<'span'>> };
  cellContent?: { rootProps?: ApexDOMExtension<ApexRootDOM> };
  checkbox?: { controlProps?: Omit<ApexDOMExtension<ApexCheckboxDOM>, 'indeterminate' | 'skipGroup'> };
  resizeHandle?: { handleProps?: ApexDOMExtension<ApexRootDOM>; widthInputProps?: ApexDOMExtension<ApexInputDOM> };
  pagination?: { rootProps?: ApexDOMExtension<ComponentPropsWithRef<'nav'>>; pageButtonProps?: ApexDOMExtension<ApexButtonDOM>; pageSizeProps?: ApexDOMExtension<ApexSelectDOM>; jumpInputProps?: ApexDOMExtension<ApexInputDOM> };
  columnSettings?: { rootProps?: ApexDOMExtension<ApexRootDOM> };
  tooltip?: { triggerProps?: ApexDOMExtension<ComponentPropsWithRef<'span'>>; contentProps?: ApexDOMExtension<ApexRootDOM> };
  loading?: { rootProps?: ApexDOMExtension<ApexRootDOM> };
  empty?: { rootProps?: ApexDOMExtension<ApexRootDOM> };
  error?: { rootProps?: ApexDOMExtension<ApexRootDOM>; retryButtonProps?: ApexDOMExtension<ApexButtonDOM> };
  selectionSummary?: { rootProps?: ApexDOMExtension<ApexRootDOM> };
}
export interface ApexTooltipSlot {
  open: boolean;
  content: ReactNode;
  triggerProps: ComponentPropsWithRef<'span'>;
  contentProps: ApexRootDOM;
  children: ReactNode;
}
/*
 * 插槽按真实 React 组件渲染，允许组件自己的 Hook、memo 和 forwardRef。
 * 不将组件对象当普通函数调用，也不让插槽 Hook 混入表格本身的调用顺序。
 * 上下文容器属性只读，原生实例及其方法仍保留原始类型和调用能力。
 */
type Slot<P> = ComponentType<Readonly<P>>;
type Native<F extends TableFeatures, D extends RowData, S> = { readonly table: ReactTable<F, D, S>; locale: ApexLocale };
export interface ApexSlots<F extends TableFeatures, D extends RowData, S = TableState<F>> {
  toolbar: Slot<Native<F, D, S> & { density: ApexDensity; setDensity(value: ApexDensity): void; openColumnSettings(): void; rootProps: ApexRootDOM; children: ReactNode }>;
  headerContent: Slot<Native<F, D, S> & { header: Header<F, D>; column: Column<F, D>; rootProps: ApexRootDOM; sortButtonProps: ApexButtonDOM; children: ReactNode; sortable: boolean }>;
  sortIcon: Slot<{ direction: false | 'asc' | 'desc'; rootProps: ComponentPropsWithRef<'span'> }>;
  cellContent: Slot<Native<F, D, S> & { cell: Cell<F, D>; rootProps: ApexRootDOM; children: ReactNode }>;
  checkbox: Slot<Native<F, D, S> & { row?: Row<F, D>; scope: 'row' | 'page' | 'results'; controlProps: ApexCheckboxDOM }>;
  resizeHandle: Slot<Native<F, D, S> & { column: Column<F, D>; resizing: boolean; handleProps: ApexRootDOM; widthInputProps: ApexInputDOM }>;
  pagination: Slot<Native<F, D, S> & { pagination: PaginationState; total: number | undefined; pageCount: number; unavailable: boolean; rootProps: ComponentPropsWithRef<'nav'>; getPageButtonProps(index: number): ApexButtonDOM; pageSizeProps: ApexSelectDOM; jumpInputProps: ApexInputDOM; children: ReactNode }>;
  columnSettings: Slot<Native<F, D, S> & { columns: Column<F, D>[]; onClose(): void; rootProps: ApexRootDOM; children: ReactNode }>;
  tooltip: Slot<ApexTooltipSlot>;
  loading: Slot<{ locale: ApexLocale; rootProps: ApexRootDOM; children: ReactNode }>;
  empty: Slot<{ locale: ApexLocale; filtered: boolean; rootProps: ApexRootDOM; children: ReactNode }>;
  error: Slot<{ locale: ApexLocale; error: unknown; diagnostic?: ApexDiagnostic; rootProps: ApexRootDOM; retryButtonProps?: ApexButtonDOM; children: ReactNode }>;
  selectionSummary: Slot<Native<F, D, S> & { rowSelection: RowSelectionState; count: number; rootProps: ApexRootDOM; children: ReactNode }>;
}
export interface ApexTableProps<F extends TableFeatures, D extends RowData, S = TableState<F>> {
  /*
   * 直接的 state 推断位置补足组合 Hook 的交叉类型推断。
   * 原生 Readonly 状态结构不变，也不要求所选状态包含任何特性切片。
   */
  table: ReactTable<F, D, S> & { readonly state: S };
  height?: number | string;
  rowHeight?: number;
  density?: ApexDensity;
  defaultDensity?: ApexDensity;
  onDensityChange?(value: ApexDensity): void;
  virtualization?: 'auto' | boolean | { overscan?: number };
  showSelectionColumn?: ApexTrack;
  /*
   * 所有数据入口共用行详情配置，回调参数保留业务记录类型。
   * 详情高度独立测量，不改变普通数据行的固定行高。
   */
  expandable?: ApexExpandable<D>;
  /*
   * 启用列设置时默认展示序号列，并在表头显示齿轮入口。
   * 传 false 可关闭序号列，传对象可配置列宽和固定位置。
   */
  showRowNumber?: ApexTrack;
  columnSettingsEnabled?: boolean;
  pagination?: boolean | { pageSizeOptions?: number[] };
  loading?: boolean;
  error?: unknown;
  onRetry?(): void;
  onRowClick?(row: Row<F, D>, event: MouseEvent<HTMLTableRowElement>): void;
  slots?: Partial<ApexSlots<F, D, S>>;
  slotProps?: ApexSlotProps;
  locale?: Partial<ApexLocale>;
  name?: string;
  className?: string;
  style?: ApexTableStyle;
  onDiagnostic?(diagnostic: ApexDiagnostic): void;
  getPopupContainer?(): HTMLElement;
  /*
   * 内置单元格使用独立的 antd 配置，默认采用中文和紧凑控件尺寸。
   * 可按表格覆盖主题和语言，不修改消费项目的全局配置。
   */
  editorConfig?: ApexEditorConfig;
}

/*
 * 数据模式复用实际注册的原生特性类型，列回调和状态回调保留完整推断。
 * 对外直接提供原生命名的选项，实例构建与第三方状态容器留在组件内部。
 */
export type ApexTableFeatures = typeof managedFeatures;
export type ApexColumnDef<D extends RowData, V extends CellData = CellData> = ColumnDef<ApexTableFeatures, D, V>;
export type ApexTableInstance<D extends RowData> = ReactTable<ApexTableFeatures, D, null>;
export type ApexTableState = TableState<ApexTableFeatures>;
export type ApexTableSlots<D extends RowData> = ApexSlots<ApexTableFeatures, D, null>;
type ApexTableReactBaseProps<D extends RowData> = Omit<ApexTableProps<ApexTableFeatures, D, null>, 'table'> & Omit<TableOptions<ApexTableFeatures, D>, 'features' | 'atoms' | 'mergeOptions' | 'key' | 'data'> & {
  table?: never;
  tableRef?: Ref<ApexTableInstance<D>>;
};
/*
 * 请求模式沿用从零开始的原生页码，取消信号可直接传给 fetch。
 * 排序和筛选使用原生状态结构，服务端应先查询完整结果再分页。
 * 显式使用本地排序或筛选时，对应请求条件为空，不重复要求服务端处理。
 */
export type ApexTableRequestParams = PaginationState & Pick<ApexTableState, 'sorting' | 'columnFilters'> & { globalFilter: unknown; signal: AbortSignal };
export interface ApexTableRequestResult<D extends RowData> { data: D[]; rowCount: number }
export type ApexTableRequest<D extends RowData> = (params: ApexTableRequestParams) => Promise<ApexTableRequestResult<D>>;
export type ApexTableReactRequestProps<D extends RowData> = Omit<ApexTableReactBaseProps<D>, 'rowCount' | 'pageCount' | 'manualPagination' | 'loading' | 'error' | 'onRetry'> & {
  request: ApexTableRequest<D>;
  data?: never;
  rowCount?: never;
  pageCount?: never;
  manualPagination?: never;
  loading?: never;
  error?: never;
  onRetry?: never;
};
/*
 * 本地数据和自动请求是互斥的数据来源，避免外部状态覆盖请求结果。
 * 原生实例入口同样禁止混入 request，保留已有数据模式的类型名称。
 */
export type ApexTableReactLocalProps<D extends RowData> = ApexTableReactBaseProps<D> & {
  data: D[];
  request?: never;
  /*
   * data 与 onDataChange 组成受控编辑接口，默认仍为只读。
   * 每次有效修改返回新数组及变更详情，不直接改写传入记录。
   */
  editable?: boolean;
  onDataChange?(data: D[], change: ApexCellChange<D>): void;
};
export type ApexTableReactDataProps<D extends RowData> = ApexTableReactLocalProps<D> | ApexTableReactRequestProps<D>;
export type ApexTableReactProps<D extends RowData, F extends TableFeatures = ApexTableFeatures, S = TableState<F>> = ApexTableReactDataProps<D> | (ApexTableProps<F, D, S> & { columns?: never; data?: never; request?: never; tableRef?: never });
export type ApexTableReactRef = ApexTableRef;

/*
 * 常用状态及更新函数类型从组件包直接导出，业务无需导入底层依赖。
 * 保留 TanStack 的类型名称和更新器语义，React 状态 setter 可直接作为回调。
 */
export type { ColumnFiltersState, ColumnOrderState, ColumnPinningState, ColumnSizingState, ColumnVisibilityState, OnChangeFn, PaginationState, RowSelectionState, SortingState, Updater } from '@tanstack/react-table';
