import { useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';
import type { ApexDensity } from 'apex-table-react';

/*
 * 密度由 React 状态控制，改变行高时同步更新表格布局。
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
export default function Density() {
  const [density, setDensity] = useState<ApexDensity>('standard');
  return <div>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <button type="button" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>紧凑</button>
      <button type="button" aria-pressed={density === 'standard'} onClick={() => setDensity('standard')}>标准</button>
      <button type="button" aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')}>宽松</button>
    </div>
    <ApexTableReact columns={columns} data={data} height={310} density={density} onDensityChange={setDensity} />
  </div>;
}
