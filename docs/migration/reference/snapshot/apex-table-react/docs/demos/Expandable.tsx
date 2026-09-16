import { useRef, useState } from 'react';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef, ApexTableRef } from 'apex-table-react';

/*
 * 详情渲染直接接收业务记录，禁止展开的行仍保留按钮列的位置。
 * 使用稳定字符串 ID 控制展开，切页和排序后仍能关联到原记录。
 */
type Person = { id: string; name: string; age: number; address: string; description: string; expandable?: boolean };
const people: Person[] = [
  { id: 'john', name: 'John Brown', age: 32, address: '纽约湖畔公园 1 号', description: '我是 John Brown，今年 32 岁，住在纽约湖畔公园 1 号。' },
  { id: 'jim', name: 'Jim Green', age: 42, address: '伦敦湖畔公园 1 号', description: '我是 Jim Green，今年 42 岁，住在伦敦湖畔公园 1 号。这里可以放置订单明细、备注或者嵌套表格。' },
  { id: 'disabled', name: '不可展开', age: 29, address: '江苏湖畔公园 1 号', description: '这条记录没有详情入口。', expandable: false },
  { id: 'joe', name: 'Joe Black', age: 32, address: '悉尼湖畔公园 1 号', description: '我是 Joe Black，今年 32 岁，住在悉尼湖畔公园 1 号。' },
];
const columns: ApexColumnDef<Person>[] = [
  { accessorKey: 'name', header: '姓名', size: 180 },
  { accessorKey: 'age', header: '年龄', size: 100 },
  { accessorKey: 'address', header: '地址', size: 300, meta: { apex: { flex: 1 } } },
];

/*
 * 此示例使用非受控展开，仅传入详情渲染器和行权限即可工作。
 * 默认展开一行，多段内容用来展示自动行高。
 */
export default function Expandable() {
  return <ApexTableReact columns={columns} data={people} getRowId={(record) => record.id} height={360} expandable={{
    defaultExpandedRowKeys: ['john'],
    rowExpandable: (record) => record.expandable !== false,
    expandedRowRender: (record) => <p style={{ margin: 0 }}>{record.description}</p>,
  }} />;
}

/*
 * 受控示例同时开放排序、分页和虚拟滚动，详情可在展开后改变高度。
 * 页外展开状态保留，定位按钮用于展示详情高度参与滚动计算。
 */
const manyPeople = Array.from({ length: 240 }, (_, index) => ({ ...people[index % people.length], id: `person-${index}`, name: `${people[index % people.length].name} ${index + 1}` }));
export function ControlledExpandable() {
  const ref = useRef<ApexTableRef>(null);
  const [keys, setKeys] = useState<string[]>(['person-0']);
  const [longContent, setLongContent] = useState(false);
  const [virtual, setVirtual] = useState(true);
  return <div>
    <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => setKeys([])}>收起全部</button>
      <button type="button" onClick={() => setLongContent(!longContent)}>切换详情长度</button>
      <button type="button" onClick={() => setVirtual(!virtual)}>{virtual ? '关闭虚拟滚动' : '开启虚拟滚动'}</button>
      <button type="button" onClick={() => ref.current?.scrollToRow('person-15')}>定位第 16 条</button>
    </div>
    <ApexTableReact ref={ref} columns={columns} data={manyPeople} getRowId={(record) => record.id} height={420} enableSorting showSelectionColumn showRowNumber virtualization={virtual} pagination initialState={{ pagination: { pageIndex: 0, pageSize: 40 } }} expandable={{
      expandedRowKeys: keys,
      onExpandedRowsChange: setKeys,
      rowExpandable: (record) => record.expandable !== false,
      expandRowByClick: true,
      fixed: 'left',
      expandedRowRender: (record) => <div>{Array.from({ length: longContent ? 12 : 1 }, (_, index) => <p key={index} style={{ margin: '0 0 8px' }}>{record.description}</p>)}</div>,
    }} />
    <p>已展开：{keys.length ? keys.join('、') : '无'}</p>
  </div>;
}
