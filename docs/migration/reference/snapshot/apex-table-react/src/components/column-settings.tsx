import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ApexRootDOM } from '../types';
import { useUI } from '../internal/context';
import { focusWithoutScroll, mergeDOM } from '../internal/dom';
import { columnLabel } from '../internal/runtime';
import type { RuntimeColumn, RuntimeTable } from '../internal/runtime';
import type { Track } from '../internal/layout';

/*
 * 草稿保存完整的显示顺序和字段配置，所有控件只修改草稿。
 * 列宽区分实际显示尺寸与显式覆盖，确认其他设置不会固化弹性列宽。
 */
interface ColumnDraft {
  id: string;
  column: RuntimeColumn;
  width: string;
  sizing?: number;
  widthEdited: boolean;
  visible: boolean;
  pin: false | 'start' | 'end';
}
function groupDraft(rows: ColumnDraft[]) {
  return [...rows.filter((row) => row.pin === 'start'), ...rows.filter((row) => !row.pin), ...rows.filter((row) => row.pin === 'end')];
}
function createDraft(table: RuntimeTable, tracks: Track[], defaults = false): ColumnDraft[] {
  const state = defaults ? table.initialState : {
    columnOrder: table.atoms.columnOrder?.get(), columnPinning: table.atoms.columnPinning?.get(),
    columnVisibility: table.atoms.columnVisibility?.get(), columnSizing: table.atoms.columnSizing?.get(),
  };
  const columns = table.getAllFlatColumns().filter((column) => !column.columns.length);
  const order = [...new Set([...(state.columnOrder ?? []), ...columns.map((column) => column.id)])];
  const pinning = state.columnPinning;
  /*
   * 原生固定区有独立顺序，不能用中间区的 columnOrder 覆盖。
   * 隐藏列也保留在草稿中，恢复显示后仍使用用户配置的相对位置。
   */
  const ids = [...new Set([...(pinning?.start ?? []), ...order.filter((id) => !pinning?.start?.includes(id) && !pinning?.end?.includes(id)), ...(pinning?.end ?? [])])];
  return ids.flatMap((id) => {
    const column = columns.find((item) => item.id === id);
    if (!column) return [];
    const sizing = state.columnSizing?.[id];
    const size = defaults ? sizing ?? column.columnDef.size ?? 150 : tracks.find((track) => track.column === column)?.size ?? column.getSize?.() ?? 150;
    return [{ id, column, width: String(size), sizing, widthEdited: false,
      visible: state.columnVisibility?.[id] !== false,
      pin: pinning?.start?.includes(id) ? 'start' as const : pinning?.end?.includes(id) ? 'end' as const : false as const }];
  });
}

/*
 * 仅序号单元格承担拖动手柄，输入框和开关不会误触发排序。
 * 手柄保留键盘传感器；锁定列既不可拖动，也不可作为跨越目标。
 * 固定位置使用单一下拉框表达三个互斥状态，名称直接沿用字段定义。
 */
function SettingsRow({ row, index, lastVisible, canOrder, update }: { row: ColumnDraft; index: number; lastVisible: boolean; canOrder: boolean; update(patch: Partial<ColumnDraft>): void }) {
  const { locale } = useUI();
  const canMove = canOrder && row.column.columnDef.meta?.apex?.canReorder !== false;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: !canMove });
  const label = columnLabel(row.column);
  const canHide = !!row.column.getCanHide?.() && !(row.visible && lastVisible);
  return <tr ref={setNodeRef} className="apex-table-settings-row" data-dragging={isDragging || undefined} style={{ transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null), transition }}>
    <td><button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="apex-table-drag-handle" disabled={!canMove} aria-label={locale.dragColumn + ' ' + label} title={locale.dragInstructions}><span className="apex-table-drag-number">{index + 1}</span><span className="apex-table-drag-grip" aria-hidden="true">⠿</span></button></td>
    <td title={label}>{label}</td>
    <td><input type="number" step="any" aria-label={locale.width + ' ' + label} min={row.column.columnDef.minSize ?? 20} max={row.column.columnDef.maxSize} disabled={!row.column.getCanResize?.()} value={row.width} onChange={(event) => update({ width: event.currentTarget.value, widthEdited: true })} /></td>
    <td><button type="button" role="switch" className="apex-table-settings-switch" aria-label={locale.showColumn + ' ' + label} aria-checked={row.visible} disabled={!canHide} title={row.visible && lastVisible ? locale.minOneColumn : undefined} onClick={() => update({ visible: !row.visible })} /></td>
    <td><select aria-label={locale.pinPosition + ' ' + label} value={row.pin || ''} disabled={!row.column.getCanPin?.()} onChange={(event) => update({ pin: event.currentTarget.value as '' | 'start' | 'end' || false })}><option value="">{locale.unpin}</option><option value="start">{locale.pinStart}</option><option value="end">{locale.pinEnd}</option></select></td>
  </tr>;
}

/*
 * 原生模态对话框进入浏览器顶层，避免被表格滚动容器裁切。
 * 焦点约束和背景不可交互由浏览器处理，关闭时恢复齿轮按钮焦点。
 */
export function ColumnSettings({ table, tracks, width, onClose }: { table: RuntimeTable; tracks: Track[]; width: number; onClose(): void }) {
  const { locale, slots, slotProps, root, getPopupContainer } = useUI();
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState(() => createDraft(table, tracks));
  const baseline = useRef(draft);
  const hintId = useId();
  const columns = table.getAllLeafColumns();
  const visibleCount = draft.filter((row) => row.visible).length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previous = document.activeElement;
    /*
     * 自定义挂载容器仍沿用来源表格的主题变量，不读取或复制业务数据。
     * 默认挂载在表格内部，弹窗大小独立于原表格高度。
     */
    if (root.current) {
      const styles = getComputedStyle(root.current);
      Array.from(styles).filter((name) => name.startsWith('--apex-table-')).forEach((name) => node.style.setProperty(name, styles.getPropertyValue(name)));
    }
    node.showModal();
    focusWithoutScroll(panel.current);
    return () => {
      node.close();
      focusWithoutScroll(previous instanceof HTMLElement && previous.isConnected ? previous : root.current);
    };
  }, [root]);
  const update = (id: string, patch: Partial<ColumnDraft>) => {
    setMessage('');
    setDraft((rows) => groupDraft(rows.map((row) => row.id === id ? { ...row, ...patch } : row)));
  };
  const move = ({ active, over }: DragEndEvent) => {
    dragging.current = false;
    if (!over || active.id === over.id) return;
    const from = draft.findIndex((row) => row.id === active.id);
    const to = draft.findIndex((row) => row.id === over.id);
    if (from < 0 || to < 0) return;
    if (draft[from].pin !== draft[to].pin || draft.slice(Math.min(from, to), Math.max(from, to) + 1).some((row) => row.column.columnDef.meta?.apex?.canReorder === false)) { setMessage(locale.reorderBlocked); return; }
    setDraft(arrayMove(draft, from, to));
    setMessage('');
  };
  const confirm = () => {
    if (dragging.current) return;
    if (!visibleCount) { setMessage(locale.minOneColumn); return; }
    const invalid = draft.find((row) => row.widthEdited && (!row.width.trim() || !Number.isFinite(Number(row.width)) || Number(row.width) < (row.column.columnDef.minSize ?? 20) || Number(row.width) > (row.column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER)));
    if (invalid) { setMessage(columnLabel(invalid.column) + '：' + locale.invalidColumnWidth); return; }
    /*
     * 固定区域按草稿里的显隐和宽度计算；已有的窄屏降级布局仍允许确认。
     * 仅当本次修改增加了固定区域宽度时，检查中间区域的最小可用空间。
     */
    const pinnedWidth = (rows: ColumnDraft[]) => rows.filter((row) => row.pin && row.visible).reduce((sum, row) => sum + Number(row.width), 0);
    const auxiliaryWidth = tracks.filter((track) => track.pin && !track.column).reduce((sum, track) => sum + track.size, 0);
    if (pinnedWidth(draft) > pinnedWidth(baseline.current) && pinnedWidth(draft) + auxiliaryWidth > width - 160) { setMessage(locale.pinSpace); return; }
    const sizing = Object.fromEntries(draft.flatMap((row) => row.widthEdited ? [[row.id, Number(row.width)]] : row.sizing !== undefined ? [[row.id, row.sizing]] : []));
    table.setColumnVisibility?.(Object.fromEntries(draft.map((row) => [row.id, row.visible])));
    table.setColumnOrder?.(draft.map((row) => row.id));
    table.setColumnPinning?.({ start: draft.filter((row) => row.pin === 'start').map((row) => row.id), end: draft.filter((row) => row.pin === 'end').map((row) => row.id) });
    table.setColumnSizing?.(sizing);
    onClose();
  };
  const reset = () => {
    /*
     * 恢复默认只修改当前草稿，取消仍可完整保留打开前的配置。
     * 无权限修改的字段沿用现值，排序锁定列保持原来的槽位。
     */
    const defaults = createDraft(table, tracks, true);
    const restored = defaults.map((row) => {
      const original = baseline.current.find((item) => item.id === row.id);
      if (!original) return row;
      return { ...row, ...(!row.column.getCanHide?.() ? { visible: original.visible } : {}), ...(!row.column.getCanPin?.() ? { pin: original.pin } : {}), ...(!row.column.getCanResize?.() ? { width: original.width, sizing: original.sizing } : {}) };
    });
    baseline.current.forEach((row, index) => {
      if (row.column.columnDef.meta?.apex?.canReorder !== false) return;
      const position = restored.findIndex((item) => item.id === row.id);
      if (position >= 0) restored.splice(index, 0, ...restored.splice(position, 1));
    });
    setDraft(groupDraft(restored));
    setMessage('');
  };
  const rootProps = mergeDOM<ApexRootDOM>({ ref: panel, tabIndex: -1, className: 'apex-table-column-settings', role: 'dialog', 'aria-modal': true, 'aria-label': locale.columnSettings, 'aria-describedby': hintId, onKeyDown: (event) => {
    /*
     * 拖动中的空格、回车和 Escape 交给传感器，避免误提交或关闭弹窗。
     * 输入法组合期间不处理确认快捷键，普通按钮保持原生回车行为。
     */
    if (dragging.current) { if (event.key === 'Escape') event.preventDefault(); return; }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && !(event.target as HTMLElement).closest('button,select')) { event.preventDefault(); confirm(); }
  } }, slotProps.columnSettings?.rootProps);
  const children = <>
    <div className="apex-table-panel-title"><strong>{locale.columnSettings}</strong><button type="button" aria-label={locale.close} onClick={onClose}>×</button></div>
    <div className="apex-table-settings-tools"><p id={hintId}>{locale.settingsHint}</p><button type="button" onClick={reset}>{locale.resetLayout}</button></div>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => { dragging.current = true; setMessage(''); }} onDragCancel={() => { dragging.current = false; }} onDragEnd={move} accessibility={{ screenReaderInstructions: { draggable: locale.dragInstructions }, announcements: {
      onDragStart: ({ active }) => locale.dragColumn + '：' + columnLabel(draft.find((row) => row.id === active.id)!.column),
      onDragOver: ({ over }) => over ? locale.rowNumber + ' ' + (draft.findIndex((row) => row.id === over.id) + 1) : undefined,
      onDragEnd: () => locale.confirm,
      onDragCancel: () => locale.cancel,
    } }}>
      <div className="apex-table-column-list">
        <table className="apex-table-settings-grid" aria-label={locale.columnSettings}>
          <colgroup><col style={{ width: 52 }} /><col style={{ width: 180 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 156 }} /></colgroup>
          <thead><tr><th scope="col">{locale.rowNumber}</th><th scope="col">{locale.fieldName}</th><th scope="col">{locale.width}<span aria-hidden="true"> ✎</span></th><th scope="col">{locale.displayStatus}</th><th scope="col">{locale.pinPosition}</th></tr></thead>
          <SortableContext items={draft.map((row) => row.id)} strategy={verticalListSortingStrategy}><tbody>{draft.map((row, index) => <SettingsRow key={row.id} row={row} index={index} lastVisible={visibleCount <= 1} canOrder={!!table.setColumnOrder} update={(patch) => update(row.id, patch)} />)}</tbody></SortableContext>
        </table>
      </div>
    </DndContext>
    <div role="status" className="apex-table-panel-message">{message}</div>
    <div className="apex-table-settings-footer"><button type="button" onClick={onClose}>{locale.cancel}(Esc)</button><button type="button" className="apex-table-settings-confirm" onClick={confirm}>{locale.confirm}(Enter)</button></div>
  </>;
  const content = <dialog ref={dialog} className="apex-table apex-table-settings-modal" role="presentation" onCancel={(event) => { event.preventDefault(); if (!dragging.current) onClose(); }}>
    {slots.columnSettings ? <slots.columnSettings {...{ table, columns, locale, onClose, rootProps, children }} /> : <div {...rootProps}>{children}</div>}
  </dialog>;
  const container = getPopupContainer?.();
  return container ? createPortal(content, container) : content;
}
