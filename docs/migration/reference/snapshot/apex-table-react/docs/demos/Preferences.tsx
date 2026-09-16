import { useEffect, useRef, useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import { createLocalColumnPreferences } from 'apex-table-react/adapters/local-column-preferences';
import type { ColumnPreferenceSlices } from 'apex-table-react/adapters/local-column-preferences';
import type { ApexColumnDef, ApexTableInstance, ColumnOrderState, ColumnVisibilityState, ColumnSizingState, ColumnPinningState } from 'apex-table-react';

/*
 * 本地偏好只保存列布局，使用显式保存和恢复展示适配器的基本接入。
 * 列布局通过 state 和对应回调传入组件，存储适配器也来自本包公开入口。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', stock: 36 },
  { id: 'cloth', name: '亚麻桌布', stock: 12 },
  { id: 'vase', name: '玻璃花瓶', stock: 24 },
];
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'id', header: '编号', size: 120 },
  { accessorKey: 'name', header: '物品名称', size: 220, enableHiding: false },
  { accessorKey: 'stock', header: '库存', size: 160 },
];
export default function Preferences() {
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('正在恢复列布局');
  const preferences = useRef<ReturnType<typeof createLocalColumnPreferences> | null>(null);
  const tableRef = useRef<ApexTableInstance<Item>>(null);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ start: [], end: [] });
  const applyLayout = (layout: ColumnPreferenceSlices) => {
    setColumnOrder(layout.columnOrder ?? []);
    setColumnVisibility(layout.columnVisibility ?? {});
    setColumnSizing(layout.columnSizing ?? {});
    setColumnPinning(layout.columnPinning ?? { start: [], end: [] });
  };
  /*
   * 每次副作用建立时创建适配器，卸载时取消待写任务并释放引用。
   * 自动恢复只读取本示例的存储键，后续点击保存才会写入浏览器。
   */
  useEffect(() => {
    const instance = createLocalColumnPreferences({
      namespace: 'apex-learning-demos', userId: 'demo-user', tenantId: 'demo-tenant',
      tableId: 'column-layout', schemaVersion: 1,
      onDiagnostic: () => setNotice('浏览器存储不可用，仍可在当前页面调整布局。'),
    });
    preferences.current = instance;
    setNotice('已恢复布局；调整列设置后点击保存，刷新页面可再次恢复。');
    if (tableRef.current) applyLayout(instance.load({ columns: tableRef.current.getAllLeafColumns() }));
    setReady(true);
    return () => { instance.dispose(); preferences.current = null; };
  }, []);
  const save = () => {
    setNotice('已保存当前列布局。');
    preferences.current?.save({
      columnOrder,
      columnVisibility,
      columnSizing,
      columnPinning,
    });
    preferences.current?.flush();
  };
  const clear = () => {
    setNotice('已清除本示例保存的布局并恢复默认列。');
    preferences.current?.clear();
    applyLayout({});
  };
  return <div>
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <button type="button" disabled={!ready} onClick={save}>保存列布局</button>
      <button type="button" disabled={!ready} onClick={clear}>清除并恢复默认</button>
    </div>
    <ApexTableReact columns={columns} data={data} tableRef={tableRef} defaultColumn={{ minSize: 80, maxSize: 400 }}
      state={{ columnOrder, columnVisibility, columnSizing, columnPinning }}
      onColumnOrderChange={setColumnOrder} onColumnVisibilityChange={setColumnVisibility}
      onColumnSizingChange={setColumnSizing} onColumnPinningChange={setColumnPinning} height={300} columnSettingsEnabled />
    <p role="status">{notice}</p>
  </div>;
}
