import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';
import type { ApexTableSlots } from 'apex-table-react';

/*
 * 仅替换工具栏插槽，并转发 rootProps 和 children 以保留内置控件。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', stock: 36 },
  { id: 'cloth', name: '亚麻桌布', stock: 12 },
  { id: 'vase', name: '玻璃花瓶', stock: 24 },
];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称' },
  { accessorKey: 'stock', header: '库存' },
];
/*
 * 插槽定义放在组件外，保持组件类型稳定，避免父级更新时卸载控件。
 * 保留 children，后续启用表格内置工具时仍能显示对应内容。
 */
const slots: Partial<ApexTableSlots<Item>> = {
  toolbar: ({ rootProps, children }) => <div {...rootProps}><strong>工作室库存</strong>{children}</div>,
};
export default function AdvancedSlots() {
  return <ApexTableReact columns={columns} data={data} height={280} slots={slots} />;
}

