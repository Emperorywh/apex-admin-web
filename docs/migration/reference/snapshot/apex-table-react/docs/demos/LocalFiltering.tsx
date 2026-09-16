import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef, ColumnFiltersState } from 'apex-table-react';

/*
 * 搜索表单只更新名称列的过滤条件，由本地过滤行模型计算结果。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', stock: 36 },
  { id: 'cloth', name: '亚麻桌布', stock: 12 },
  { id: 'vase', name: '玻璃花瓶', stock: 24 },
];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称', filterFn: (row, id, value: string) => row.getValue<string>(id).includes(value) },
  { accessorKey: 'stock', header: '库存' },
];
export default function LocalFiltering() {
  const [keyword, setKeyword] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  return <div>
    <form style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }} onSubmit={(event) => {
      event.preventDefault();
      setColumnFilters(keyword.trim() ? [{ id: 'name', value: keyword.trim() }] : []);
    }}>
      <label>物品名称<input value={keyword} onChange={(event) => setKeyword(event.currentTarget.value)} placeholder="输入陶瓷杯" /></label>
      <button type="submit">搜索</button>
      <button type="button" onClick={() => { setKeyword(''); setColumnFilters([]); }}>重置</button>
    </form>
    <ApexTableReact columns={columns} data={data} state={{ columnFilters }} onColumnFiltersChange={setColumnFilters} height={260} />
  </div>;
}
