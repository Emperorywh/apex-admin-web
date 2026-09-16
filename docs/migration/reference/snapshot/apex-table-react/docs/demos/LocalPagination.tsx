import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 通过 pagination 和 initialState 配置本地分页，完整数据始终保存在内存中。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = Array.from({ length: 36 }, (_, index) => ({ id: String(index), name: `物品 ${index + 1}`, stock: 100 - index }));
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称' },
  { accessorKey: 'stock', header: '库存' },
];
export default function LocalPagination() {
  return <ApexTableReact columns={columns} data={data}
    initialState={{ pagination: { pageIndex: 0, pageSize: 5 } }} height={380} pagination={{ pageSizeOptions: [5, 10, 20] }} />;
}
