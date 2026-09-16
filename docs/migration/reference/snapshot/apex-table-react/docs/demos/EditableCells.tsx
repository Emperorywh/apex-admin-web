import { useRef, useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexCellChange, ApexColumnDef, ApexTableInstance } from 'apex-table-react';

/*
 * 同一份受控数据展示十种内置单元格，列配置决定控件及其 antd 属性。
 * 商品记录用稳定业务 ID 标识，排序、分页后仍修改原始记录。
 */
type Item = {
  id: string; name: string; checked: boolean; color: string | null; date: string | null;
  stock: number | null; delivery: string; category: string | null; enabled: boolean; time: string | null; image: string;
};
const thumbnail = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="16" fill="#eef5ff"/><path d="M35 35h45v42a18 18 0 0 1-18 18h-9a18 18 0 0 1-18-18z" fill="#5890d9"/><path d="M80 43h8a12 12 0 0 1 0 24h-8" fill="none" stroke="#5890d9" stroke-width="8"/></svg>');
const initialData: Item[] = Array.from({ length: 30 }, (_, index) => ({
  id: `item-${index + 1}`, name: `陶瓷杯 ${index + 1}`, checked: index % 2 === 0, color: '#5890d9', date: '2026-09-15',
  stock: 20 + index, delivery: 'express', category: 'home', enabled: true, time: '09:30:00', image: thumbnail,
}));
/*
 * 颜色和图片列只展示色块及缩略图，使用紧凑列宽。
 * 图片保留点击预览，颜色保留弹层选择。
 */
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '商品名称', size: 180, meta: { apex: { editor: { type: 'Input', props: { maxLength: 40, allowClear: true } } } } },
  { accessorKey: 'checked', header: '已核验', size: 90, meta: { apex: { editor: { type: 'Checkbox' } } } },
  { accessorKey: 'color', header: '颜色', size: 90, meta: { apex: { editor: { type: 'ColorPicker', props: { presets: [{ label: '常用颜色', colors: ['#5890d9', '#f97316', '#16a34a'] }] } } } } },
  { accessorKey: 'date', header: '上架日期', size: 180, meta: { apex: { editor: { type: 'DatePicker' } } } },
  { accessorKey: 'stock', header: '库存', size: 120, meta: { apex: { editor: { type: 'InputNumber', props: { min: 0, max: 9999, precision: 0 } } } } },
  { accessorKey: 'delivery', header: '配送方式', size: 220, meta: { apex: { editor: { type: 'Radio', props: { options: [{ label: '快递', value: 'express' }, { label: '自提', value: 'pickup' }] } } } } },
  { accessorKey: 'category', header: '分类', size: 140, meta: { apex: { editor: { type: 'Select', props: { allowClear: true, options: [{ label: '家居', value: 'home' }, { label: '办公', value: 'office' }] } } } } },
  { accessorKey: 'enabled', header: '启用', size: 90, meta: { apex: { editor: { type: 'Switch', props: { checkedChildren: '开', unCheckedChildren: '关' } } } } },
  { accessorKey: 'time', header: '发货时间', size: 160, meta: { apex: { editor: { type: 'TimePicker', props: { minuteStep: 15 } } } } },
  { accessorKey: 'image', header: '图片', size: 90, meta: { apex: { editor: { type: 'Image' } } } },
];

/*
 * 数据回调立即保存新数组；获取按钮演示从原生实例读取全部业务记录。
 * 只读切换和外部重置沿用同一份数据，虚拟滚动不会丢失已提交修改。
 */
export default function EditableCells() {
  const [data, setData] = useState(initialData);
  const [editable, setEditable] = useState(true);
  const [virtual, setVirtual] = useState(false);
  const [change, setChange] = useState<ApexCellChange<Item>>();
  const [snapshot, setSnapshot] = useState<string>();
  const [rowClicks, setRowClicks] = useState(0);
  const tableRef = useRef<ApexTableInstance<Item>>(null);
  return <div>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 12 }}>
      <label><input type="checkbox" checked={editable} onChange={(event) => setEditable(event.target.checked)} />允许编辑</label>
      <label><input type="checkbox" checked={virtual} onChange={(event) => { tableRef.current?.setPageIndex(0); setVirtual(event.target.checked); }} />连续虚拟滚动</label>
      <button type="button" onClick={() => setSnapshot(JSON.stringify(tableRef.current?.getCoreRowModel().rows.map((row) => row.original), null, 2))}>获取全部数据</button>
      <button type="button" onClick={() => { setData([...initialData]); setChange(undefined); setSnapshot(undefined); setRowClicks(0); }}>重置数据</button>
      <span aria-label="行点击次数">行点击：{rowClicks} 次</span>
    </div>
    <ApexTableReact columns={columns} data={data} editable={editable} onDataChange={(next, detail) => { setData(next); setChange(detail); }}
      tableRef={tableRef} getRowId={(row) => row.id} height={400} enableSorting columnSettingsEnabled onRowClick={() => setRowClicks((count) => count + 1)}
      pagination={!virtual} manualPagination={virtual} virtualization={virtual} initialState={{ pagination: { pageIndex: 0, pageSize: 10 } }} />
    <p role="status">{change ? `已更新 ${change.rowId} 的 ${change.columnId}：${change.columnId === 'image' ? '图片地址已更新' : String(change.value)}` : '横向滚动可查看全部十种组件；更改值后可获取最新数据。'}</p>
    {snapshot && <pre aria-label="最新表格数据" style={{ maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{snapshot}</pre>}
  </div>;
}
