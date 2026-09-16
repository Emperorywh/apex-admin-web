import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 齿轮打开配置弹窗，支持拖动排序、显隐、固定位置下拉选择和列宽调整。
 * 所有操作确认后生效，取消放弃草稿；名称列不可隐藏，固定分区内可排序。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', stock: 36 },
  { id: 'cloth', name: '亚麻桌布', stock: 12 },
  { id: 'vase', name: '玻璃花瓶', stock: 24 },
];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'id', header: '编号', size: 120 },
  { accessorKey: 'name', header: '物品名称', size: 240, enableHiding: false },
  { accessorKey: 'stock', header: '库存', size: 160 },
];
export default function ColumnSettings() {
  return <ApexTableReact columns={columns} data={data}
    defaultColumn={{ minSize: 80, maxSize: 400 }}
    initialState={{ columnPinning: { start: ['name'], end: [] } }} height={300} columnSettingsEnabled />;
}
