import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 空数组会显示默认空态，无需额外注册特性或传递状态参数。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { name: string; stock: number };
const data: Item[] = [];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称' },
  { accessorKey: 'stock', header: '库存' },
];
export default function Empty() {
  return <ApexTableReact columns={columns} data={data} height={260} />;
}
