import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 点击库存表头切换排序方向，排序行模型负责重排本地数据。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', stock: 36 },
  { id: 'cloth', name: '亚麻桌布', stock: 12 },
  { id: 'vase', name: '玻璃花瓶', stock: 24 },
];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称', enableSorting: false },
  { accessorKey: 'stock', header: '库存', sortFn: 'basic' },
];
export default function LocalSorting() {
  return <ApexTableReact columns={columns} data={data} enableSorting sortDescFirst={false} height={260} />;
}
