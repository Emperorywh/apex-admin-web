import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 错误由业务传入，重试回调在本示例中清除模拟错误并展示本地数据。
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
export default function ErrorState() {
  const [error, setError] = useState<Error | undefined>(() => new Error('模拟读取失败'));
  return <div>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}><button type="button" onClick={() => setError(new Error('模拟读取失败'))}>模拟失败</button></div>
    <ApexTableReact columns={columns} data={data} height={260} error={error} onRetry={() => setError(undefined)} />
  </div>;
}
