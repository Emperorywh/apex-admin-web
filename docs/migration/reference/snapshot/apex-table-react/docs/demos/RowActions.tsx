import { useMemo, useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';
import { Dropdown } from 'antd';

/*
 * 操作列通过 antd Dropdown 展示菜单，使用原生行数据执行操作。
 * 触发按钮与菜单点击独立处理，避免浮层事件冒泡后触发行点击。
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
export default function RowActions() {
  const [notice, setNotice] = useState('点击行查看物品，或在操作菜单中选择编辑。');
  const actionColumns = useMemo<ApexColumnDef<Item>[]>(() => [
    ...columns,
    { id: 'actions', header: '操作', cell: ({ row }) => <Dropdown trigger={['click']} menu={{
      items: [{ key: 'edit', label: '编辑' }],
      onClick: ({ domEvent }) => { domEvent.stopPropagation(); setNotice(`编辑：${row.original.name}`); },
    }}>
      <button type="button" onClick={(event) => event.stopPropagation()}>更多操作</button>
    </Dropdown> },
  ], []);
  return <div>
    <ApexTableReact columns={actionColumns} data={data} height={260} onRowClick={(row) => setNotice(`查看：${row.original.name}`)} />
    <p role="status">{notice}</p>
  </div>;
}
