import { useRef, useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef, ApexTableRef, ColumnFiltersState } from 'apex-table-react';

/*
 * 模拟接口先对完整库存筛选、排序，再返回当前页和筛选后的准确总数。
 * 搜索条件由业务表单控制，排序、分页和请求生命周期由组件管理。
 */
type Item = { id: string; name: string; stock: number };
const inventory: Item[] = Array.from({ length: 53 }, (_, index) => ({ id: String(index), name: `商品 ${index + 1}`, stock: 100 - index }));
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品名称' },
  { accessorKey: 'stock', header: '库存' },
];
export default function ProductTable() {
  const ref = useRef<ApexTableRef>(null);
  const sequence = useRef(0);
  const [keyword, setKeyword] = useState('');
  const [minimum, setMinimum] = useState('');
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [lastRequest, setLastRequest] = useState('等待首次请求');
  /*
   * 提交搜索时同时更新列筛选与全局筛选，只发送合并后的查询。
   * 刷新通过组件引用触发，无需修改 key，已有列布局和选择状态得以保留。
   */
  return <div>
    <form style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }} onSubmit={(event) => {
      event.preventDefault();
      setGlobalFilter(keyword.trim());
      setColumnFilters(minimum.trim() ? [{ id: 'stock', value: Number(minimum) }] : []);
    }}>
      <label>商品搜索<input value={keyword} onChange={(event) => setKeyword(event.currentTarget.value)} placeholder="例如：商品 2" /></label>
      <label>最低库存<input type="number" value={minimum} onChange={(event) => setMinimum(event.currentTarget.value)} /></label>
      <button type="submit">查询</button>
      <button type="button" onClick={() => { setKeyword(''); setMinimum(''); setGlobalFilter(''); setColumnFilters([]); }}>清空条件</button>
      <button type="button" onClick={() => ref.current?.reload()}>刷新当前页</button>
      <button type="button" onClick={() => ref.current?.reload({ resetPageIndex: true })}>返回首页并刷新</button>
    </form>
    <p><output aria-live="polite">{lastRequest}</output></p>
    <ApexTableReact ref={ref} columns={columns} getRowId={(row) => row.id} height={380} enableSorting enableMultiSort showSelectionColumn columnSettingsEnabled
    state={{ globalFilter, columnFilters }} onGlobalFilterChange={setGlobalFilter} onColumnFiltersChange={setColumnFilters}
    request={async ({ pageIndex, pageSize, sorting, columnFilters: filters, globalFilter: search, signal }) => {
      setLastRequest(`请求 ${++sequence.current} · 第 ${pageIndex + 1} 页 · 排序：${sorting.map((item) => `${item.id} ${item.desc ? '降序' : '升序'}`).join('、') || '默认'} · 搜索：${String(search || '全部')} · 列筛选：${filters.length} 项`);
      /*
       * 模拟网络延迟并响应取消信号，快速切换条件时不会提交旧请求。
       * 真实接口可将同一个 signal 直接传给 fetch，并自行映射查询参数。
       */
      await new Promise<void>((resolve, reject) => {
        /*
         * 先声明定时器句柄，避免取消回调引用尚未声明的变量。
         * 注册或触发取消回调前完成赋值，保留延迟结束与取消时的清理逻辑。
         */
        let timer: number;
        const cancel = () => { window.clearTimeout(timer); reject(new DOMException('请求已取消', 'AbortError')); };
        timer = window.setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 500);
        if (signal.aborted) cancel();
        else signal.addEventListener('abort', cancel, { once: true });
      });
      const minimumStock = filters.find((item) => item.id === 'stock')?.value;
      const rows = inventory.filter((row) => row.name.includes(String(search ?? '')) && (typeof minimumStock !== 'number' || row.stock >= minimumStock));
      rows.sort((left, right) => {
        for (const item of sorting) {
          const difference = item.id === 'stock' ? left.stock - right.stock : left.name.localeCompare(right.name, 'zh-CN', { numeric: true });
          if (difference) return item.desc ? -difference : difference;
        }
        return 0;
      });
      const start = pageIndex * pageSize;
      return { data: rows.slice(start, start + pageSize), rowCount: rows.length };
    }}
    initialState={{ pagination: { pageIndex: 0, pageSize: 5 } }} pagination={{ pageSizeOptions: [5, 10, 20] }} />
  </div>;
}
