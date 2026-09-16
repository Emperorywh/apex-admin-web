import type { CheckboxProps, ColorPickerProps, ConfigProviderProps, DatePickerProps, ImageProps, InputNumberProps, InputProps, RadioGroupProps, SelectProps, SwitchProps, TimePickerProps } from 'antd';

/*
 * 内置编辑器只接管数据绑定，其他外观与交互属性沿用 antd 类型。
 * 值与变更事件由表格统一管理，避免业务属性覆盖数据回写通道。
 */
type Binding = 'value' | 'defaultValue' | 'checked' | 'defaultChecked' | 'onChange' | 'onChangeComplete' | 'onClear' | 'open' | 'defaultOpen' | 'onOpenChange';
type EditorProps<P> = Omit<P, Binding>;
export type ApexSelectValue = string | number | (string | number)[];
export interface ApexEditorPropsMap {
  Checkbox: EditorProps<CheckboxProps>;
  ColorPicker: Omit<EditorProps<ColorPickerProps>, 'mode'>;
  DatePicker: Omit<EditorProps<DatePickerProps>, 'multiple'>;
  Input: EditorProps<InputProps>;
  InputNumber: EditorProps<InputNumberProps<string | number>>;
  Radio: EditorProps<RadioGroupProps>;
  Select: Omit<EditorProps<SelectProps<ApexSelectValue>>, 'labelInValue'>;
  Switch: EditorProps<SwitchProps>;
  TimePicker: EditorProps<TimePickerProps>;
  /*
   * 图片只开放 antd 的展示与预览属性，地址由当前行数据绑定。
   * 不再提供地址输入属性，避免配置未展示的编辑控件。
   */
  Image: Omit<ImageProps, 'src'>;
}
export type ApexEditorType = keyof ApexEditorPropsMap;
export interface ApexCellContext<D> {
  row: D;
  rowId: string;
  rowIndex: number;
  columnId: string;
  value: unknown;
}

/*
 * 列按组件名称形成可辨识联合类型，组件属性和行回调均保留推断。
 * 计算列可指定写入字段或不可变更新函数，日期与时间存储为格式化字符串。
 */
export type ApexCellEditor<D = unknown> = {
  [K in ApexEditorType]: {
    type: K;
    props?: ApexEditorPropsMap[K] | ((context: ApexCellContext<D>) => ApexEditorPropsMap[K]);
    editable?: boolean | ((context: ApexCellContext<D>) => boolean);
    field?: string | readonly string[];
    setValue?(row: D, value: unknown): D;
  } & (K extends 'DatePicker' | 'TimePicker' ? { valueFormat?: string } : unknown)
}[ApexEditorType];
export interface ApexCellChange<D> extends ApexCellContext<D> {
  previousValue: unknown;
  previousRow: D;
}
export type ApexEditorConfig = Pick<ConfigProviderProps, 'locale' | 'theme' | 'componentSize' | 'direction' | 'prefixCls'>;
