import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * slotProps 在原有控件上补充业务事件，preventDefault 可以取消本次选择。
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
export default function SlotEvents() {
  const [locked, setLocked] = useState(false);
  return <div>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}><label><input type="checkbox" checked={locked} onChange={(event) => setLocked(event.currentTarget.checked)} />禁止修改选择</label></div>
    <ApexTableReact columns={columns} data={data} getRowId={(row) => row.id} height={290} showSelectionColumn slotProps={{
      checkbox: { controlProps: { onChange: (event) => { if (locked) event.preventDefault(); } } },
    }} />
  </div>;
}
