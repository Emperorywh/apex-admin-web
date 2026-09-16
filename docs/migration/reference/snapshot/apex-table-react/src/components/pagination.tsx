import { useEffect, useState } from 'react';
import type { ComponentPropsWithRef } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import type { ApexButtonDOM, ApexInputDOM, ApexSelectDOM } from '../types';
import { useUI } from '../internal/context';
import { mergeDOM } from '../internal/dom';
import type { RuntimeTable } from '../internal/runtime';
/*
 * 复用表格内置选择统计，让选择数量紧随总数展示。
 * 统计仍独立订阅选择状态，并保留清空选择和自定义插槽。
 */
import { SelectionSummary } from './selection';

/*
 * 页码校正只发生在输入控件提交边界，所有动作直接调用原生方法。
 * 加载和错误期间不泄露旧总数，未知总数不伪造分页范围。
 */
function PaginationView({ table, pagination, unavailable, pageSizeOptions }: { table: RuntimeTable; pagination: PaginationState; unavailable: boolean; pageSizeOptions: number[] }) {
  const { locale, slots, slotProps } = useUI();
  const [jump, setJump] = useState(String(pagination.pageIndex + 1));
  useEffect(() => setJump(String(pagination.pageIndex + 1)), [pagination.pageIndex]);
  const pageCount = unavailable ? 0 : table.getPageCount();
  const unknown = !unavailable && pageCount < 0;
  const total = unavailable || unknown ? undefined : table.getRowCount();
  const rootProps = mergeDOM<ComponentPropsWithRef<'nav'>>({ className: 'apex-table-pagination', 'aria-label': locale.pageUnit }, slotProps.pagination?.rootProps);
  const getPageButtonProps = (index: number) => mergeDOM<ApexButtonDOM>({ type: 'button', disabled: unavailable || unknown || index < 0 || index >= pageCount, 'aria-label': locale.page(index), 'aria-current': index === pagination.pageIndex ? 'page' : undefined, onClick: () => table.setPageIndex(index) }, slotProps.pagination?.pageButtonProps);
  const sizes = [...new Set([...pageSizeOptions, pagination.pageSize])].filter((size) => Number.isInteger(size) && size > 0).sort((a, b) => a - b);
  const pageSizeProps = mergeDOM<ApexSelectDOM>({ 'aria-label': locale.pageSize, value: pagination.pageSize, onChange: (event) => table.setPageSize(Number(event.currentTarget.value)) }, slotProps.pagination?.pageSizeProps);
  const submitJump = () => {
    if (!jump.trim() || unavailable || unknown) { setJump(String(pagination.pageIndex + 1)); return; }
    const parsed = Number(jump);
    const page = Number.isFinite(parsed) ? Math.max(1, Math.min(Math.max(1, pageCount), Math.floor(parsed))) : pagination.pageIndex + 1;
    setJump(String(page));
    if (page !== pagination.pageIndex + 1) table.setPageIndex(page - 1);
  };
  const jumpInputProps = mergeDOM<ApexInputDOM>({ type: 'text', inputMode: 'numeric', 'aria-label': locale.jumpToPage, disabled: unavailable || unknown || !pageCount, value: jump, onChange: (event) => setJump(event.currentTarget.value), onBlur: submitJump, onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); submitJump(); } } }, slotProps.pagination?.jumpInputProps);
  const pages = [...new Set([0, pagination.pageIndex - 1, pagination.pageIndex, pagination.pageIndex + 1, pageCount - 1])].filter((index) => index >= 0 && index < pageCount).sort((a, b) => a - b);
  const children = <>
    <select {...pageSizeProps}>{sizes.map((size) => <option key={size} value={size}>{locale.perPage(size)}</option>)}</select>
    <span className="apex-table-total">{unavailable ? '—' : unknown ? locale.unknownTotal : locale.total(total ?? 0)}</span>
    <SelectionSummary table={table} />
    <div className="apex-table-page-buttons">
      <button type="button" {...getPageButtonProps(pagination.pageIndex - 1)} aria-label={locale.previousPage}>‹</button>
      {pages.map((index, position) => <span className="apex-table-page-item" key={index}>{position > 0 && index - pages[position - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" {...getPageButtonProps(index)}>{index + 1}</button></span>)}
      <button type="button" {...getPageButtonProps(pagination.pageIndex + 1)} aria-label={locale.nextPage}>›</button>
    </div>
    <label className="apex-table-jump">{locale.jumpToPage}<input {...jumpInputProps} />{locale.pageUnit}</label>
  </>;
  return slots.pagination ? <slots.pagination {...{ table, locale, pagination, total, pageCount, unavailable, rootProps, getPageButtonProps, pageSizeProps, jumpInputProps, children }} /> : <nav {...rootProps}>{children}</nav>;
}
export function Pagination({ table, unavailable, pageSizeOptions = [10, 20, 50, 100, 200] }: { table: RuntimeTable; unavailable: boolean; pageSizeOptions?: number[] }) {
  if (!table.atoms.pagination || !table.getPageCount) return null;
  return <table.Subscribe source={table.atoms.pagination}>{(pagination) => <PaginationView table={table} pagination={pagination} unavailable={unavailable} pageSizeOptions={pageSizeOptions} />}</table.Subscribe>;
}
