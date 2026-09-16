import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 加载开关控制骨架状态，加载期间表格暂时隐藏原有数据行。
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
export default function Loading() {
  const [loading, setLoading] = useState(true);
  return <div>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}><label><input type="checkbox" checked={loading} onChange={(event) => setLoading(event.currentTarget.checked)} />加载中</label></div>
    <ApexTableReact columns={columns} data={data} height={260} loading={loading} />
  </div>;
}
