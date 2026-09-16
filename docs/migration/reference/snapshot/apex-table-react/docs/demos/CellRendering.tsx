import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 列的 cell 回调直接读取原生值，分别展示货币格式和库存标签。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { id: string; name: string; price: number; stock: number };
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', price: 39.9, stock: 36 },
  { id: 'cloth', name: '亚麻桌布', price: 89, stock: 0 },
  { id: 'vase', name: '玻璃花瓶', price: 59, stock: 24 },
];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称' },
  { accessorKey: 'price', header: '售价', cell: (cell) => `¥ ${cell.getValue<number>().toFixed(2)}` },
  { accessorKey: 'stock', header: '库存状态', cell: (cell) => <span style={{ color: cell.getValue<number>() > 0 ? '#248954' : '#cb4556' }}>{cell.getValue<number>() > 0 ? '有货' : '缺货'}</span> },
];
export default function CellRendering() {
  return <ApexTableReact columns={columns} data={data} height={260} />;
}
