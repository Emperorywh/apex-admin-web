import type { ApexCellEditor, ApexColumnDef, ApexTableReactLocalProps, ApexTableReactRequestProps } from '../src';

/*
 * 编译期验证列回调保留业务类型，并阻止覆盖表格管理的数据绑定属性。
 * 错误用例由编译器断言，不生成运行时代码。
 */
type Item = { id: string; name: string; enabled: boolean };
const column: ApexColumnDef<Item> = {
  accessorKey: 'name',
  meta: { apex: { editor: { type: 'Input', editable: ({ row }) => row.enabled, props: ({ row }) => ({ placeholder: row.name }) } } },
};
const local: ApexTableReactLocalProps<Item> = { columns: [column], data: [], editable: true, onDataChange(data, change) { data[0].name.toUpperCase(); change.row.name.toUpperCase(); } };
const request: ApexTableReactRequestProps<Item> = {
  columns: [column], request: async () => ({ data: [], rowCount: 0 }),
  // @ts-expect-error 自动请求入口不支持编辑数据回写。
  editable: true,
};
const invalid: ApexCellEditor<Item> = {
  type: 'Input',
  // @ts-expect-error 内置编辑器禁止外部覆盖值绑定。
  props: { value: '绕过数据源' },
};
const wrongProps: ApexCellEditor<Item> = {
  type: 'Checkbox',
  // @ts-expect-error 组件属性必须匹配当前编辑器类型。
  props: { precision: 2 },
};
void [local, request, invalid, wrongProps];
