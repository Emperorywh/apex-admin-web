import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 一万行本地数据只演示虚拟滚动，表体按可视区域挂载数据行。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = Array.from({ length: 10000 }, (_, index) => ({ id: `item-${index + 1}`, name: `物品 ${index + 1}`, stock: index % 100 }));
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称' },
  { accessorKey: 'stock', header: '库存' },
];
export default function LocalTable() {
  return <ApexTableReact columns={columns} data={data} getRowId={(row) => row.id} height={420} showRowNumber virtualization={{ overscan: 8 }} />;
}
