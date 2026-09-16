import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 只覆盖当前选择场景的内置文案，未提供的文案自动回退为简体中文。
 * 本示例直接传入列、数据和功能 props，组件自动管理实例并加载样式。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [
  { id: 'cup', name: 'Ceramic cup', stock: 36 },
  { id: 'cloth', name: 'Linen tablecloth', stock: 12 },
  { id: 'vase', name: 'Glass vase', stock: 24 },
];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: 'Product' },
  { accessorKey: 'stock', header: 'Stock' },
];
export default function Localization() {
  return <ApexTableReact columns={columns} data={data} getRowId={(row) => row.id} height={290} showSelectionColumn name="Inventory" locale={{
    selectResults: 'Select all results',
    selectRow: (id) => `Select row ${id}`,
    selected: (count) => `${count} selected`,
    clearSelection: 'Clear selection',
    density: 'Density',
    compact: 'Compact',
    standard: 'Standard',
    comfortable: 'Comfortable',
  }} />;
}
