import type { Ref } from 'react';
import type { ApexDiagnostic } from '../types';

/*
 * 回调引用的清理兼容 React 18 的 null 回调及 React 19 清理返回值。
 * 合并引用始终指向同一个真实元素，禁止把控件引用转到包装节点。
 */
export function composeRefs<T>(...refs: (Ref<T> | undefined)[]): Ref<T> {
  let cleanups: (() => void)[] = [];
  return (node) => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        if (node === null) return;
        const cleanup = ref(node);
        cleanups.push(typeof cleanup === 'function' ? cleanup : () => { ref(null); });
      } else if (ref) {
        ref.current = node;
        if (node !== null) cleanups.push(() => { ref.current = null; });
      }
    });
  };
}
/*
 * 模态语义属于弹窗内部约束，插槽不能把背景不可交互的状态改为普通面板。
 * 与其他必要的可访问属性一致，运行时忽略外部的 aria-modal 覆盖。
 */
const protectedKeys = new Set(['id', 'role', 'tabIndex', 'children', 'dangerouslySetInnerHTML', 'checked', 'indeterminate', 'defaultChecked', 'disabled', 'type', 'value', 'defaultValue', 'min', 'max', 'step', 'aria-label', 'aria-labelledby', 'aria-checked', 'aria-sort', 'aria-rowindex', 'aria-colindex', 'aria-rowcount', 'aria-colcount', 'aria-busy', 'aria-expanded', 'aria-controls', 'aria-haspopup', 'aria-hidden', 'aria-current', 'aria-orientation', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-live', 'aria-modal']);
const geometryKeys = new Set(['position', 'display', 'width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight', 'top', 'bottom', 'left', 'right', 'inset', 'transform', 'overflow', 'overflowX', 'overflowY', 'flex', 'flexBasis', 'gridTemplateColumns', 'boxSizing', 'zIndex']);
type DOMBag = Record<string, unknown>;

/*
 * 先执行业务事件，只有同步 preventDefault 才取消内部界面动作。
 * Escape 与释放指针等清理动作不受取消影响，传播控制不改变提交语义。
 */
export function mergeDOM<T extends object>(internal: T, extra?: object): T {
  if (!extra) return internal;
  const result = { ...internal } as DOMBag;
  const base = internal as DOMBag;
  Object.entries(extra).forEach(([key, value]) => {
    if (protectedKeys.has(key) || key.startsWith('data-apex') || ['data-selected', 'data-pinned', 'data-disabled'].includes(key)) return;
    if (key === 'className') result[key] = [base[key], value].filter(Boolean).join(' ');
    else if (key === 'style') result[key] = { ...(base[key] as object), ...Object.fromEntries(Object.entries((value ?? {}) as object).filter(([name]) => !geometryKeys.has(name) && !name.startsWith('--apex-geometry-'))) };
    else if (key === 'ref') result[key] = composeRefs(base[key] as Ref<unknown>, value as Ref<unknown>);
    else if (key === 'aria-describedby') result[key] = [...new Set(`${base[key] ?? ''} ${value ?? ''}`.split(/\s+/).filter(Boolean))].join(' ');
    else if (/^on[A-Z]/.test(key) && typeof value === 'function' && typeof base[key] === 'function') {
      result[key] = (event: { defaultPrevented: boolean; key?: string }) => {
        value(event);
        /*
         * 指针抬起还承担释放捕获的职责，必须进入内部清理。
         * 对应处理函数自行检查 defaultPrevented，取消时不提交尺寸。
         */
        if (!event.defaultPrevented || event.key === 'Escape' || key === 'onLostPointerCapture' || key === 'onPointerCancel' || key === 'onPointerUp') (base[key] as (event: unknown) => void)(event);
      };
    } else result[key] = value;
  });
  return result as T;
}
export function hasProtectedProps(slotProps: object | undefined) {
  return Object.values(slotProps ?? {}).some((slot) => Object.values(slot ?? {}).some((bag) => Object.entries((bag ?? {}) as object).some(([key, value]) => protectedKeys.has(key) || key.startsWith('data-apex') || ['data-selected', 'data-pinned', 'data-disabled'].includes(key) || (key === 'style' && Object.keys(value ?? {}).some((name) => geometryKeys.has(name) || name.startsWith('--apex-geometry-'))))));
}
export function diagnostic(code: ApexDiagnostic['code'], message: string): ApexDiagnostic { return { code, message }; }
export function isInteractive(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('a,button,input,select,textarea,summary,[contenteditable="true"],[role="button"],[role="switch"],[role="checkbox"],[role="menuitem"],[data-apex-interactive]');
}
export function focusWithoutScroll(element: HTMLElement | null) { element?.focus({ preventScroll: true }); }
