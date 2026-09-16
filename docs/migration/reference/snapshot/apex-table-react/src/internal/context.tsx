import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { ApexLocale, ApexSlotProps } from '../types';
import type { RuntimeSlots } from './runtime';
import { zhCN } from '../locale';

/*
 * 上下文只承载界面扩展与有效焦点容器，不复制原生表格状态。
 * 内置提示复用当前表格的浮层生命周期，业务菜单由 antd Dropdown 管理。
 */
export interface UIContextValue {
  locale: ApexLocale;
  slots: RuntimeSlots;
  slotProps: ApexSlotProps;
  root: RefObject<HTMLDivElement | null>;
  viewport: RefObject<HTMLDivElement | null>;
  getPopupContainer?: () => HTMLElement;
  closeSignal?: object;
  /*
   * 固定特性集合不代表界面已启用对应能力。
   * 子控件共用实际启用标记，连续列表不会出现分页语义或空选择摘要。
   */
  paginationEnabled?: boolean;
  selectionEnabled?: boolean;
}
export const UIContext = createContext<UIContextValue>({ locale: zhCN, slots: {}, slotProps: {}, root: { current: null }, viewport: { current: null } });
export function useUI() { return useContext(UIContext); }
