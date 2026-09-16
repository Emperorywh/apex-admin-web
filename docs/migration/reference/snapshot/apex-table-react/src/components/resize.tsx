import { useLayoutEffect, useRef, useState } from 'react';
import type { ApexInputDOM, ApexRootDOM } from '../types';
import { useUI } from '../internal/context';
import { mergeDOM } from '../internal/dom';
import { clampWidth, columnLabel } from '../internal/runtime';
import type { RuntimeColumn, RuntimeTable } from '../internal/runtime';

/*
 * 当前安装的 v9 将拖动切片命名为 columnResizing，沿用实际原生名称。
 * 所有指针事件通过同一 props 包合并，业务取消与内部清理保持一致。
 */
export function ResizeHandle({ table, column, renderedSize }: { table: RuntimeTable; column: RuntimeColumn; renderedSize: number }) {
  const { locale, slots, slotProps } = useUI();
  const [delta, setDelta] = useState<number | null>(null);
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const drag = useRef<{ x: number; size: number; nextSize: number; original: ReturnType<typeof table.atoms.columnSizing.get>; table: RuntimeTable; mode: 'onEnd' | 'onChange'; node: HTMLDivElement; pointer: number; cleanup(): void } | null>(null);
  const finish = (cancel: boolean) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    active.cleanup();
    if (active.node.hasPointerCapture(active.pointer)) active.node.releasePointerCapture(active.pointer);
    if (cancel && active.mode === 'onChange') active.table.setColumnSizing(active.original);
    active.table.resetHeaderSizeInfo(true);
    setDelta(null);
  };
  /*
   * 列对象或订阅源更换时，保留的手柄组件也要清空指示线状态。
   * 实际卸载时 React 会丢弃状态更新，原生拖动切片仍正常清理。
   */
  useLayoutEffect(() => () => finish(true), [table.store, column]);
  if (!column.getCanResize?.()) return null;
  /*
   * flex 只扩展显示宽度，拖动和键盘从实际轨道开始，避免首次调整突然缩窄。
   * 数字输入保留编辑草稿，在提交时校正边界，不阻止多位数字逐字输入。
   */
  const widthInputProps = mergeDOM<ApexInputDOM>({ type: 'number', step: 'any', className: 'apex-table-visually-hidden', tabIndex: -1, 'aria-label': locale.resizeColumn(columnLabel(column)), value: widthDraft ?? renderedSize, min: column.columnDef.minSize ?? 20, max: column.columnDef.maxSize,
    onChange: (event) => setWidthDraft(event.currentTarget.value), onBlur: (event) => {
    const value = event.currentTarget.valueAsNumber;
    if (Number.isFinite(value) && value !== renderedSize) table.setColumnSizing((old) => ({ ...old, [column.id]: clampWidth(column, value) }));
    setWidthDraft(null);
  }, onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { setWidthDraft(null); finish(true); } } }, slotProps.resizeHandle?.widthInputProps);
  const handleProps = mergeDOM<ApexRootDOM>({
    role: 'separator', tabIndex: 0, 'aria-orientation': 'vertical', 'aria-label': locale.resizeColumn(columnLabel(column)),
    'aria-valuenow': renderedSize, 'aria-valuemin': column.columnDef.minSize ?? 20, 'aria-valuemax': column.columnDef.maxSize,
    className: 'apex-table-resize-handle', style: { transform: `translateX(${delta ?? 0}px)` },
    onKeyDown: (event) => {
      if (event.key === 'Escape') { finish(true); event.stopPropagation(); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        table.setColumnSizing((old) => ({ ...old, [column.id]: clampWidth(column, renderedSize + (event.key === 'ArrowRight' ? 8 : -8)) }));
      }
    },
    onPointerDown: (event) => {
      if (event.button !== 0 || drag.current) return;
      event.preventDefault();
      const node = event.currentTarget;
      const startSize = renderedSize;
      const startX = event.clientX;
      const original = table.atoms.columnSizing.get();
      const key = (keyboard: KeyboardEvent) => { if (keyboard.key === 'Escape') { keyboard.preventDefault(); finish(true); } };
      node.setPointerCapture(event.pointerId);
      node.ownerDocument.addEventListener('keydown', key, true);
      drag.current = { x: startX, size: startSize, nextSize: startSize, node, pointer: event.pointerId, original, table, mode: table.options.columnResizeMode === 'onChange' ? 'onChange' : 'onEnd', cleanup: () => node.ownerDocument.removeEventListener('keydown', key, true) };
      table.setColumnResizing({ startOffset: startX, startSize, deltaOffset: 0, deltaPercentage: 0, isResizingColumn: column.id, columnSizingStart: [[column.id, startSize]] });
      setDelta(0);
    },
    onPointerMove: (event) => {
      const active = drag.current;
      if (!active || event.pointerId !== active.pointer) return;
      active.nextSize = clampWidth(column, active.size + (event.clientX - active.x) * (active.table.options.columnResizeDirection === 'rtl' ? -1 : 1));
      const offset = active.nextSize - active.size;
      setDelta(active.mode === 'onChange' ? 0 : offset);
      active.table.setColumnResizing((old) => ({ ...old, deltaOffset: offset, deltaPercentage: offset / active.size }));
      if (active.mode === 'onChange') active.table.setColumnSizing((old) => ({ ...old, [column.id]: active.nextSize }));
    },
    onPointerUp: (event) => {
      const active = drag.current;
      if (!active || event.pointerId !== active.pointer) return;
      /*
       * 取消提交仍释放捕获；onEnd 仅在有效释放时调用一次尺寸 setter。
       * onChange 被取消时恢复开始前的完整原生尺寸切片。
       */
      if (!event.defaultPrevented && active.mode === 'onEnd') active.table.setColumnSizing((old) => ({ ...old, [column.id]: active.nextSize }));
      finish(event.defaultPrevented);
    },
    onPointerCancel: () => finish(true),
    onLostPointerCapture: () => finish(true),
  }, slotProps.resizeHandle?.handleProps);
  return slots.resizeHandle ? <slots.resizeHandle {...{ table, column, locale, resizing: delta !== null, handleProps, widthInputProps }} /> : <><div {...handleProps} data-resizing={delta !== null || undefined} /><input {...widthInputProps} /></>;
}
