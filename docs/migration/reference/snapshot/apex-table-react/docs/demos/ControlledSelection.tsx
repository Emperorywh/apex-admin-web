import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';
import type { RowSelectionState } from 'apex-table-react';

/*
 * React state 是选择状态的所有者，原生 updater 直接交给状态 setter。
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
export default function ControlledSelection() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({ cup: true });
  return <div>
    <ApexTableReact columns={columns} data={data} getRowId={(row) => row.id}
      state={{ rowSelection }} onRowSelectionChange={setRowSelection} height={290} showSelectionColumn />
    <p role="status">已选 ID：{Object.keys(rowSelection).filter((id) => rowSelection[id]).join('、') || '无'}</p>
  </div>;
}
