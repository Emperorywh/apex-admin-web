import { useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Cell, RowData, TableFeatures } from '@tanstack/react-table';
import { Checkbox, ColorPicker, ConfigProvider, DatePicker, Image, Input, InputNumber, Radio, Select, Switch, TimePicker } from 'antd';
import antdLocale from 'antd/locale/zh_CN.js';
import type { ColorPickerProps } from 'antd';
import type { ApexCellContext, ApexCellEditor, ApexEditorConfig, ApexSelectValue } from './types';
import { useUI } from '../internal/context';
import { cellContext, EditingContext } from '../internal/editing';
import { editorPath } from '../internal/editing-data';
import { columnLabel } from '../internal/runtime';
import { editorText, parseEditorDate } from './values';

/*
 * 使用带扩展名的公共语言包入口，兼容 Node 原生 ESM 与浏览器构建器。
 * antd 的 CommonJS 语言包可能保留 default 层，在边界统一解包一次。
 */
const antdZhCN = (antdLocale as typeof antdLocale & { default?: typeof antdLocale }).default ?? antdLocale;

/*
 * antd 负责控件与浮层样式，表格只提供默认语言、尺寸及可覆盖的配置。
 * 数字输入的语义类用于铺满单元格，不依赖业务自定义的 antd 类名前缀。
 * 浮层默认挂到文档主体，避免被单元格和虚拟滚动容器裁剪。
 */
export function EditorTheme({ config, getPopupContainer, children }: { config?: ApexEditorConfig; getPopupContainer?: () => HTMLElement; children: ReactNode }) {
  return <ConfigProvider locale={antdZhCN} componentSize="small" inputNumber={{ classNames: { input: 'apex-table-editor-number-input' } }} {...config} getPopupContainer={getPopupContainer}>{children}</ConfigProvider>;
}
function resolveProps<P>(props: P | ((context: ApexCellContext<RowData>) => P) | undefined, context: ApexCellContext<RowData>): P | undefined {
  return typeof props === 'function' ? (props as (context: ApexCellContext<RowData>) => P)(context) : props;
}

/*
 * 颜色拖动期间保留 antd 原生颜色对象，避免反复转码造成精度抖动。
 * 对外每次提交规范化十六进制字符串，外部替换数据时同步清除旧颜色。
 */
function ColorEditor({ value, onChange, ...props }: Omit<ColorPickerProps, 'value' | 'onChange' | 'onClear' | 'mode'> & { value: string | null; onChange(value: string | null): void }) {
  const [color, setColor] = useState<{ source: string | null; value: ColorPickerProps['value'] }>({ source: value, value: value ?? '' });
  return <ColorPicker {...props} mode="single" value={color.source === value ? color.value : value ?? ''} onChange={(next) => {
    const text = next.cleared ? null : next.toHexString();
    setColor({ source: text, value: next });
    onChange(text);
  }} onClear={() => { setColor({ source: null, value: '' }); onChange(null); }} />;
}

/*
 * 各控件统一将业务值交给数据入口回写，不在单元格中保留业务数据副本。
 * 查询变化会关闭弹层，数据行卸载时由 antd 清理浮层与内部监听。
 * 输入类控件默认使用无边框变体，由单元格统一呈现背景与焦点边框。
 */
export function BuiltinCell({ cell, editor }: { cell: Cell<TableFeatures, RowData>; editor: ApexCellEditor<RowData> }) {
  const editing = useContext(EditingContext);
  const { closeSignal } = useUI();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [closeSignal]);
  const context = cellContext(cell);
  const { value } = context;
  const column = cell.column.columnDef;
  const path = editorPath(editor.field ?? ('accessorKey' in column ? String(column.accessorKey) : undefined));
  const enabled = editing.enabled && !!(editor.setValue || path) && (typeof editor.editable === 'function' ? editor.editable(context) : editor.editable !== false);
  const label = `${columnLabel(cell.column)} · ${cell.row.id}`;
  const change = (next: unknown) => { if (enabled) editing.commit(cell, next); };
  const popup = { open: enabled && open, onOpenChange: setOpen };
  let keyboardEnabled = enabled;
  let control: ReactNode;
  switch (editor.type) {
    case 'Checkbox': {
      const props = resolveProps(editor.props, context);
      control = <Checkbox aria-label={label} {...props} checked={value === true} disabled={!enabled || props?.disabled} onChange={(event) => change(event.target.checked)} />;
      break;
    }
    case 'Switch': {
      const props = resolveProps(editor.props, context);
      control = <Switch aria-label={label} {...props} checked={value === true} disabled={!enabled || props?.disabled} onChange={change} />;
      break;
    }
    case 'Input': {
      const props = resolveProps(editor.props, context);
      control = <Input aria-label={label} variant="borderless" {...props} value={editorText(value)} disabled={!enabled || props?.disabled} onChange={(event) => change(event.target.value)} />;
      break;
    }
    case 'InputNumber': {
      const props = resolveProps(editor.props, context);
      control = <InputNumber aria-label={label} variant="borderless" {...props} value={typeof value === 'number' || typeof value === 'string' ? value : null} disabled={!enabled || props?.disabled} onChange={change} />;
      break;
    }
    case 'Radio': {
      const props = resolveProps(editor.props, context);
      control = <Radio.Group aria-label={label} {...props} value={value} disabled={!enabled || props?.disabled} onChange={(event) => change(event.target.value)} />;
      break;
    }
    case 'Select': {
      const props = resolveProps(editor.props, context);
      control = <Select<ApexSelectValue> aria-label={label} variant="borderless" {...props} {...popup} value={value as ApexSelectValue | null | undefined} disabled={!enabled || props?.disabled} labelInValue={false} onChange={(next) => change(next ?? null)} />;
      break;
    }
    case 'DatePicker': {
      const props = resolveProps(editor.props, context);
      const format = editor.valueFormat ?? (props?.showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
      control = <DatePicker aria-label={label} variant="borderless" format={format} {...props} {...popup} multiple={false} value={parseEditorDate(value, format)} disabled={!enabled || props?.disabled} onChange={(next) => change(next ? next.format(format) : null)} />;
      break;
    }
    case 'TimePicker': {
      const props = resolveProps(editor.props, context);
      const format = editor.valueFormat ?? 'HH:mm:ss';
      control = <TimePicker aria-label={label} variant="borderless" format={format} {...props} {...popup} value={parseEditorDate(value, format)} disabled={!enabled || props?.disabled} onChange={(next) => change(next ? next.format(format) : null)} />;
      break;
    }
    case 'ColorPicker': {
      const props = resolveProps(editor.props, context);
      keyboardEnabled = enabled && !props?.disabled;
      /*
       * 单元格默认只显示色块，避免颜色编码占用表格空间。
       * 颜色面板继续使用 antd 的选择与输入能力，业务值仍按原格式回写。
       */
      control = <ColorEditor aria-label={label} allowClear showText={false} {...props} {...popup} open={popup.open && keyboardEnabled} value={typeof value === 'string' ? value : null} disabled={!keyboardEnabled} onChange={change} />;
      break;
    }
    case 'Image': {
      const props = resolveProps(editor.props, context);
      /*
       * 图片单元格只呈现缩略图并保留点击预览，不展示地址输入框。
       * 图片地址仍从行数据读取，外部更新数据后自动同步展示。
       */
      control = <Image width={28} height={28} alt={label} {...props} src={editorText(value) || undefined} />;
      break;
    }
  }
  /*
   * 颜色选择器默认触发器是普通容器，补齐键盘开启入口而不重写控件样式。
   * 仅处理容器自身的按键，保留面板输入框和自定义子控件的键盘行为。
   * 阻止 React Portal 内的点击继续冒泡到数据行，避免选项选择触发行点击。
   * 弹层开启时标记原单元格，让焦点移到浮层后仍保留整格编辑提示。
   */
  return <div className="apex-table-editor" data-apex-editor={editor.type} data-apex-popup-open={keyboardEnabled && open || undefined} data-apex-interactive
    onClick={(event) => event.stopPropagation()}
    role={editor.type === 'ColorPicker' ? 'button' : undefined} aria-label={editor.type === 'ColorPicker' ? label : undefined}
    tabIndex={editor.type === 'ColorPicker' && keyboardEnabled ? 0 : undefined} aria-expanded={editor.type === 'ColorPicker' ? keyboardEnabled && open : undefined}
    aria-disabled={editor.type === 'ColorPicker' ? !keyboardEnabled : undefined}
    onKeyDown={(event) => {
      if (editor.type === 'ColorPicker' && keyboardEnabled && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setOpen(true); }
    }}>{control}</div>;
}
