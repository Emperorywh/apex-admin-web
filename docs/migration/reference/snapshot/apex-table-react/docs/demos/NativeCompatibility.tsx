import { useRef } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef, ApexTableInstance } from 'apex-table-react';

/*
 * tableRef 由组件填充，外部按钮直接调用与 TanStack 同名的实例方法。
 * 实例和状态仍由组件管理，无需在业务侧创建 atom 或导入第三方库。
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
export default function NativeCompatibility() {
  const tableRef = useRef<ApexTableInstance<Item>>(null);
  return <div>
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <button type="button" onClick={() => tableRef.current?.setRowSelection({ cloth: true })}>通过 API 选择桌布</button>
      <button type="button" onClick={() => tableRef.current?.resetRowSelection(true)}>通过 API 清空</button>
    </div>
    <ApexTableReact columns={columns} data={data} getRowId={(row) => row.id} tableRef={tableRef}
      initialState={{ rowSelection: { cup: true } }} height={290} showSelectionColumn />
  </div>;
}
