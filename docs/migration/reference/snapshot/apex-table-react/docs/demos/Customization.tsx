import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 品牌样式通过根节点类名覆盖公开颜色变量，不改变表格行高和几何。
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
export default function Customization() {
  return <ApexTableReact columns={columns} data={data} height={260} style={{
    '--apex-table-accent-color': '#ad4f22', '--apex-table-header-bg': '#f6eee4',
    '--apex-table-border-color': '#dac8b3', '--apex-table-text-color': '#513d2e',
    '--apex-table-row-selected-bg': '#f9edd8', '--apex-table-row-hover-bg': '#fff9f1',
    '--apex-table-radius': 0, '--apex-table-font-family': "Georgia, 'SimSun', serif",
  }} />;
}
