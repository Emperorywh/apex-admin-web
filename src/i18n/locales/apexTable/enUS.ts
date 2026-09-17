/**
 * ApexTableReact 英文文案资源（T00.5 表格公共设施）。
 *
 * - 包 apex-table-react 内置仅简体中文（zhCN），其余语言由本项目交付；
 * - key 集合与包内 ApexLocale 完全一致（56 条静态文案 + 6 个数量格式化函数），
 *   包升级新增文案时须在此补齐，禁止缺 key 导致运行期回退中文；
 * - 表格文案不进 i18next 命名空间：ApexLocale 是结构化对象（含格式化函数），
 *   由 resolveApexLocale 按当前语言整体注入 <ApexTableReact locale>。
 */

import type { ApexLocale } from 'apex-table-react'

export const enUS: ApexLocale = {
  tableName: 'Data table',
  loading: 'Loading…',
  empty: 'No data',
  noMatches: 'No matching results',
  noColumns: 'No visible columns. Choose columns to display in column settings.',
  error: 'Failed to load',
  retry: 'Retry',
  columnSettings: 'Column settings',
  fieldName: 'Field name',
  pinPosition: 'Pin position',
  displayStatus: 'Visibility',
  settingsHint: 'Drag the handle to reorder. You can also set column width, visibility and pinning.',
  cancel: 'Cancel',
  confirm: 'OK',
  close: 'Close',
  resetLayout: 'Reset layout',
  clearSelection: 'Clear selection',
  invalidColumnWidth: 'Enter a column width within the allowed range',
  reorderBlocked: 'Columns can only be reordered within the same pinned area and cannot cross locked columns',
  dragColumn: 'Drag to reorder',
  dragInstructions: 'Press Space to start dragging, use Up/Down arrow keys to adjust the order, press Space to drop, or press Esc to cancel.',
  selectPage: 'Select selectable rows on this page',
  selectResults: 'Select all filtered results',
  rowNumber: 'No.',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  expansion: 'Row expansion',
  expandRow: 'Expand row',
  collapseRow: 'Collapse row',
  pageSize: 'Page size',
  jumpToPage: 'Go to',
  pageUnit: 'page',
  pinStart: 'Pin to left',
  pinEnd: 'Pin to right',
  unpin: 'Unpin',
  moveUp: 'Move up',
  moveDown: 'Move down',
  width: 'Width',
  showColumn: 'Show column',
  minOneColumn: 'Keep at least one business column',
  pinSpace: 'Pinned columns must leave at least 160px for the center area',
  unknownTotal: 'Accurate total count is unavailable. Replace or hide the pagination controls.',
  unsupportedLayout: 'This configuration is not fully supported yet: this version only supports flat single-row headers',
  invalidGeometry: 'Invalid size configuration: row height must be at least 32px, and track and column widths must be finite positive numbers',
  invalidPagination: 'Invalid pagination: pageIndex must be a non-negative integer and pageSize must be a positive integer',
  duplicateRowId: 'Empty or duplicate row IDs found. Provide a unique and stable getRowId',
  duplicateColumnId: 'Empty or duplicate column IDs found. Check the column definitions',
  unmeasurable: 'The table body needs an explicit height or a measurable flex container',
  virtualizationDisabled: 'Virtualization is disabled for large data. Full rendering may affect performance',
  protectedProp: 'Slots must not override protected semantic, state or geometry attributes',
  compact: 'Compact',
  standard: 'Standard',
  comfortable: 'Comfortable',
  density: 'Row density',
  // 数量格式化与包内 zhCN 行为对齐：千分位随目标语言，页面语义不变
  selectRow: (id) => `Select row ${id}`,
  sortColumn: (label) => `Sort by ${label}`,
  resizeColumn: (label) => `Resize ${label}`,
  page: (index) => `Page ${index + 1}`,
  total: (count) => `${count.toLocaleString('en-US')} items in total`,
  selected: (count) => `${count.toLocaleString('en-US')} selected`,
  perPage: (count) => `${count} / page`,
}
