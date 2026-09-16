---
title: 单元格编辑
nav:
  title: 单元格编辑
  order: 4
---

# 内置单元格与 data 编辑

组件内置 antd 6.6.4 的十种常用单元格。列通过 `meta.apex.editor` 选择控件，表格通过 `editable` 和 `onDataChange` 开启受控编辑。未开启编辑或未提供回调时控件不可修改；Image 仍支持预览。

## 快速接入

```tsx
import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 列只声明编辑器与 antd 属性，组件统一负责值绑定和不可变回写。
 * 稳定 ID 独立于可编辑字段，避免排序后或修改后丢失行身份。
 */
type Item = { id: string; name: string; stock: number | null; enabled: boolean };
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '名称', meta: { apex: { editor: { type: 'Input' } } } },
  { accessorKey: 'stock', header: '库存', meta: { apex: { editor: { type: 'InputNumber', props: { min: 0, precision: 0 } } } } },
  { accessorKey: 'enabled', header: '启用', meta: { apex: { editor: { type: 'Switch' } } } },
];

/*
 * data 是唯一业务数据源，onDataChange 可直接使用 React 状态 setter。
 * 保存时读取 data 即可，组件不会额外持有一份待同步的业务数据。
 */
export default function Example() {
  const [data, setData] = useState<Item[]>([{ id: 'cup', name: '陶瓷杯', stock: 20, enabled: true }]);
  return <ApexTableReact columns={columns} data={data} getRowId={(row) => row.id} editable onDataChange={setData} height={320} />;
}
```

## 十种组件演示

横向滚动可查看全部控件；切换只读、翻页、排序、虚拟滚动后，可点击“获取全部数据”检查最新记录。Image 只展示图片并支持预览，图片地址更新由业务通过 data 接入；ColorPicker 默认只展示色块，点击后可选择颜色。

<code src="./demos/EditableCells.tsx"></code>

## 列配置

| 配置 | 说明 |
| --- | --- |
| type | Checkbox / ColorPicker / DatePicker / Input / InputNumber / Radio / Select / Switch / TimePicker / Image |
| props | 对应 antd 属性，或 `(context) => props`；context 包含 row、rowId、原始 rowIndex、columnId、value |
| editable | 列级 boolean 或 `(context) => boolean`；与表格 editable 共同控制，false 的单元格不可修改 |
| field | 默认使用 accessorKey；点号字符串表示嵌套路径，字符串数组可表达包含点号的真实字段名 |
| setValue | `(row, value) => nextRow`；计算列可更新多个字段，必须返回新记录且不修改 row；优先于 field |
| valueFormat | 仅 DatePicker / TimePicker；业务字符串格式，默认分别为 YYYY-MM-DD、HH:mm:ss；DatePicker 开启 showTime 后默认 YYYY-MM-DD HH:mm:ss |

props 保留控件特有选项和类型推断，但 `value/defaultValue/checked/defaultChecked/onChange/onChangeComplete/onClear/open/defaultOpen/onOpenChange` 由表格管理。Radio 使用 Radio.Group；Select 支持单选、多选和搜索，不启用 labelInValue。ColorPicker 当前只支持单色；DatePicker 为单日期，不支持 multiple 或 RangePicker。

配置 editor 后，该列使用内置控件；未配置的列继续执行原生 cell。slots.cellContent 仍能包装或替换最终内容。计算列没有 accessorKey 时须配置 field 或 setValue，否则禁用编辑。建议提供稳定 getRowId，并避免使用可编辑字段作为 ID。

## 写回值与数据获取

| 组件 | 写回的业务值 |
| --- | --- |
| Checkbox、Switch | boolean；显示时只有 true 为选中 |
| Input | string，清空为 `''` |
| InputNumber | number 或 null；stringMode 开启时使用高精度 string |
| Radio | 选项 value，通常为 string 或 number |
| Select | string / number，多选为数组；单选清空为 null |
| DatePicker、TimePicker | 按 valueFormat 编码的 string，清空为 null；props.format 仅控制展示格式 |
| ColorPicker | 十六进制颜色字符串，透明度保留为 alpha，清空为 null |
| Image | 读取图片地址 string 展示缩略图，不在单元格内编辑地址；props 配置 antd Image |

每次控件有效的 onChange 立即触发 onDataChange。回调的第一个参数为新数组；第二个参数为 ApexCellChange，包含修改后的 row、修改前的 previousRow、rowId、原始 rowIndex、columnId、previousValue 和 value。未修改行保留原引用。

本次提供即时受控编辑，没有整行保存或取消草稿流程。日期和时间按 antd 自身的选择/确认规则产生有效值，未确认的面板输入不属于已提交数据；控件的中间输入和未确认弹层值在卸载时不保留。

获取最新数据可直接读取受控 state；在事件中也可使用 `tableRef.current?.getCoreRowModel().rows.map(row => row.original)` 读取当前实例全部原始记录，使用 getRowModel() 读取排序、筛选和分页后的结果。实例反映最近一次 React 提交的数据；在 onDataChange 中应直接使用 nextData，不要同步读取尚未传回 props 的新值。

## 分页、虚拟滚动与样式

编辑按原始行身份回写。编辑模式默认关闭 autoResetPageIndex，避免每次输入跳回第一页，显式配置仍优先。已提交数据随父组件 state 保存，虚拟滚动、翻页和只读切换不会清除；父组件替换 data 即采用新数据，不做内部合并。编辑排序或筛选字段可能使当前行移动或离开当前结果。

自动 request 和原生 table 入口只展示只读内置控件。需要服务端保存时，由业务在 data 模式加载数据并提交。Checkbox 业务字段与表格行选择列相互独立。

antd 弹层默认挂载 document.body，可通过控件属性或表格 getPopupContainer 覆盖；容器应容纳弹层并避免裁剪。editorConfig 支持 locale、theme、componentSize、direction 和 prefixCls，默认中文、小尺寸。

内置控件默认融入单元格：输入区域铺满整格，去掉独立边框、圆角和底色；聚焦或打开编辑弹层时，整格显示现有主题的蓝色边框。Checkbox、Radio、Switch 和图片保留自身形态，并沿用列的对齐配置。

现有 --apex-table-* 变量控制表格与整格焦点框（--apex-table-focus-color），editorConfig.theme 控制 antd 控件及弹层，两者不会自动互相转换。unstyled 入口仅移除 Apex 自有 CSS，antd 内置控件默认使用无边框输入变体，其余组件样式仍保留。固定行高下请控制图片尺寸、Radio 选项数量和多选标签数量，避免内容超出单元格。

当前 antd 6.6.4 的图片与日期底层依赖声明存在严格继承检查冲突，TypeScript 项目建议与本仓库一致设置 `skipLibCheck: true`。这只跳过第三方声明文件自身检查，业务代码仍使用 strict 和完整的编辑器属性类型检查。
