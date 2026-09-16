import { Checkbox } from 'antd';
import type { RowSelectionState } from '@tanstack/react-table';
import type { ApexCheckboxDOM, ApexRootDOM } from '../types';
import { mergeDOM } from '../internal/dom';
import { useUI } from '../internal/context';
import type { RuntimeRow, RuntimeTable } from '../internal/runtime';

/*
 * 行选择和表头全选统一使用 antd Checkbox，由控件同步半选状态。
 * 行选择仅订阅该行 ID，业务单元格不依赖整份选择集合。
 */
function SelectionCheckbox({ table, row, scope, checked, indeterminate, disabled, onChange }: {
  table: RuntimeTable; row?: RuntimeRow; scope: 'row' | 'page' | 'results'; checked: boolean; indeterminate: boolean; disabled: boolean; onChange(): void;
}) {
  const { locale, slots, slotProps } = useUI();
  /*
   * antd 变更事件通过 nativeEvent 记录取消状态，保留业务阻止选择的能力。
   * 跳过外部复选框组，确保选中状态始终由当前表格管理。
   */
  const controlProps = mergeDOM<ApexCheckboxDOM>({
    type: 'checkbox', checked, indeterminate, disabled, skipGroup: true,
    'aria-label': row ? locale.selectRow(row.id) : scope === 'page' ? locale.selectPage : locale.selectResults,
    'aria-checked': indeterminate ? 'mixed' : checked, onChange: (event) => { if (!event.nativeEvent.defaultPrevented) onChange(); },
  }, slotProps.checkbox?.controlProps);
  if (slots.checkbox) return <slots.checkbox {...{ table, row, scope, controlProps, locale }} />;
  /*
   * 外层标记覆盖 antd 的标签与勾选图标，点击任意位置都不会触发行点击。
   * 居中布局独立于控件外观，尺寸、禁用态与焦点样式由 antd 管理。
   */
  return <span className="apex-table-checkbox" data-apex-interactive><Checkbox {...controlProps} skipGroup /></span>;
}
export function RowCheckbox({ table, row }: { table: RuntimeTable; row: RuntimeRow }) {
  if (!table.atoms.rowSelection) return null;
  return <table.Subscribe source={table.atoms.rowSelection} selector={(state) => !!state[row.id]}>
    {(checked) => <SelectionCheckbox table={table} row={row} scope="row" checked={checked} indeterminate={false} disabled={!row.getCanSelect?.()} onChange={() => row.toggleSelected?.()} />}
  </table.Subscribe>;
}
export function HeaderCheckbox({ table, unavailable }: { table: RuntimeTable; unavailable: boolean }) {
  /*
   * 数据模式的连续列表也安装了分页特性，必须按界面配置区分页内与结果全选。
   * 原生实例未提供标记时继续探测其分页能力。
   */
  const { paginationEnabled } = useUI();
  if (!table.atoms.rowSelection) return null;
  return <table.Subscribe source={table.atoms.rowSelection}>
    {() => {
      const paged = paginationEnabled ?? (typeof table.getPageCount === 'function' && !!table.atoms.pagination);
      const rows = paged ? table.getRowModel().rows : (table.getFilteredRowModel?.() ?? table.getRowModel()).rows;
      return <SelectionCheckbox table={table} scope={paged ? 'page' : 'results'} checked={paged ? table.getIsAllPageRowsSelected() : table.getIsAllRowsSelected()} indeterminate={paged ? table.getIsSomePageRowsSelected() : table.getIsSomeRowsSelected()} disabled={unavailable || !rows.some((row) => row.getCanSelect?.())} onChange={() => paged ? table.toggleAllPageRowsSelected() : table.toggleAllRowsSelected()} />;
    }}
  </table.Subscribe>;
}
function Summary({ table, selection }: { table: RuntimeTable; selection: RowSelectionState }) {
  const { locale, slots, slotProps } = useUI();
  /*
   * 受控选择允许保留值为 false 的键，只统计实际选中的记录。
   * 摘要数量与行复选框读取同一份状态含义。
   */
  const count = Object.values(selection).filter(Boolean).length;
  const rootProps = mergeDOM<ApexRootDOM>({ className: 'apex-table-selection-summary', 'aria-live': 'polite' }, slotProps.selectionSummary?.rootProps);
  const children = <><span>{locale.selected(count)}</span>{count > 0 && <button type="button" onClick={() => table.resetRowSelection(true)}>{locale.clearSelection}</button>}</>;
  return slots.selectionSummary ? <slots.selectionSummary {...{ table, locale, rowSelection: selection, count, rootProps, children }} /> : <div {...rootProps}>{children}</div>;
}
export function SelectionSummary({ table }: { table: RuntimeTable }) {
  /*
   * 仅安装选择特性时不显示摘要，启用选择的表格才占用底栏空间。
   * 原生模式未提供标记时保持已有行为。
   */
  const { selectionEnabled } = useUI();
  if (selectionEnabled === false || !table.atoms.rowSelection) return null;
  return <table.Subscribe source={table.atoms.rowSelection}>{(selection) => <Summary table={table} selection={selection} />}</table.Subscribe>;
}
