import { ApexTableReact } from 'apex-table-react';

/*
 * 从 apex-table-react 导入组件后，只需传入列、数据和高度，列使用普通对象声明。
 * 组件内部创建表格实例并自动加载样式，无需业务调用 TanStack API。
 */
type Item = { id: string; name: string; stock: number };
const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', stock: 36 },
  { id: 'cloth', name: '亚麻桌布', stock: 12 },
  { id: 'vase', name: '玻璃花瓶', stock: 24 },
];
const columns = [
  { accessorKey: 'name', header: '物品名称' },
  { accessorKey: 'stock', header: '库存' },
];
export default function Basic() {
  return <ApexTableReact columns={columns} data={data} height={260} />;
}
