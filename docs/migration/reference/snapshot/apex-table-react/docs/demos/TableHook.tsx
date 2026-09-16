import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexTableReactDataProps, RowSelectionState } from 'apex-table-react';

/*
 * 项目 Hook 只组合可复用的 props，实例创建和样式加载继续由组件负责。
 * 属性使用本包导出的类型，React 状态更新器可直接传给同名回调。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [{ id: 'cup', name: '陶瓷杯', stock: 36 }, { id: 'cloth', name: '亚麻桌布', stock: 12 }];
const columns = [{ accessorKey: 'name', header: '物品名称' }, { accessorKey: 'stock', header: '库存' }];
function useInventoryProps(): ApexTableReactDataProps<Item> {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  return { columns, data, getRowId: (row) => row.id, showSelectionColumn: true, state: { rowSelection }, onRowSelectionChange: setRowSelection };
}
export default function TableHook() {
  const props = useInventoryProps();
  return <ApexTableReact {...props} height={260} />;
}
