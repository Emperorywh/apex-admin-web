import { createRoot } from 'react-dom/client';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef, ApexTableStyle } from 'apex-table-react';

/*
 * 独立页面也直接使用默认组件入口，样式随组件自动加载。
 * 两套品牌通过 style 属性中的公开主题变量配置，不再引入任何 CSS 文件。
 */
type Item = { id: string; name: string; quantity: number; material: string };
const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '物品' },
  { accessorKey: 'material', header: '材质' },
  { accessorKey: 'quantity', header: '数量', cell: (cell) => cell.getValue<number>().toFixed(0) },
];
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', material: '手工陶瓷', quantity: 36 },
  { id: 'tray', name: '木托盘', material: '天然木材', quantity: 12 },
  { id: 'vase', name: '陶花瓶', material: '手工陶瓷', quantity: 24 },
];
function Collection({ theme, name }: { theme: ApexTableStyle; name: string }) {
  return <section><h2>{name}</h2><ApexTableReact columns={columns} data={data} name={name} height={230} style={theme} /></section>;
}
function App() {
  return <main style={{ padding: 12, fontFamily: 'sans-serif' }}><p>通过 props 配置品牌主题</p>
    <Collection name="工作室 · 陶土主题" theme={{ '--apex-table-accent-color': '#904c36', '--apex-table-bg': '#fffdfa', '--apex-table-header-bg': '#f2e4d8', '--apex-table-border-color': '#904c36' }} />
    <Collection name="资料室 · 森林主题" theme={{ '--apex-table-accent-color': '#225b50', '--apex-table-bg': '#fafffd', '--apex-table-header-bg': '#d9ebe5', '--apex-table-border-color': '#225b50' }} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
