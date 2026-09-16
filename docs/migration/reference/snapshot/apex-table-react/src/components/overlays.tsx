import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { ApexTooltipSlot } from '../types';
import { useUI } from '../internal/context';
import { mergeDOM } from '../internal/dom';

/*
 * 提示浮层不复制行 DOM；滚动、尺寸变化或表格状态变化时关闭。
 * 提示始终不夺取焦点，业务菜单的交互由 antd Dropdown 管理。
 */
function useOverlay() {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = useCallback(() => { setOpen(false); }, []);
  useLayoutEffect(() => { close(); }, [ui.closeSignal, close]);
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const bounds = content.current?.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - (bounds?.width ?? 220) - 8)), top: rect.bottom + (bounds?.height ?? 0) > window.innerHeight - 8 ? Math.max(8, rect.top - (bounds?.height ?? 0) - 4) : rect.bottom + 4 });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!content.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    const scroll = () => close();
    const focus = (event: FocusEvent) => { if (!content.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', focus);
    ui.viewport.current?.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    const viewport = ui.viewport.current;
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focus); viewport?.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); };
  }, [open, close, ui.viewport]);
  return { ...ui, open, setOpen, close, trigger, content, position };
}
export function ApexTooltip({ content: text, children }: { content: ReactNode; children: ReactNode }) {
  const overlay = useOverlay();
  const { slots, slotProps, open, setOpen, close, trigger, content, position } = overlay;
  const id = useId();
  const triggerProps = mergeDOM<ApexTooltipSlot['triggerProps']>({ ref: (node) => { trigger.current = node; }, className: 'apex-table-tooltip-trigger', tabIndex: 0, 'aria-describedby': open ? id : undefined, onMouseEnter: () => setOpen(true), onMouseLeave: () => close(), onFocus: () => setOpen(true), onBlur: () => close(), onKeyDown: (event) => { if (event.key === 'Escape') close(); } }, slotProps.tooltip?.triggerProps);
  const contentProps = mergeDOM<ApexTooltipSlot['contentProps']>({ ref: content, id, role: 'tooltip', className: 'apex-table-tooltip', style: { position: 'fixed', ...position } }, slotProps.tooltip?.contentProps);
  if (slots.tooltip) return <slots.tooltip {...{ open, content: text, triggerProps, contentProps, children }} />;
  const tooltip = open && <div {...contentProps}>{text}</div>;
  const container = open ? overlay.getPopupContainer?.() : undefined;
  return <><span {...triggerProps}>{children}</span>{container ? createPortal(tooltip, container) : tooltip}</>;
}
