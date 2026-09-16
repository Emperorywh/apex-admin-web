import { memo } from 'react';
import { Checkbox, ConfigProvider } from 'antd';
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';
import type { ComponentProps } from 'react';
import type { ApexTableSlots } from 'apex-table-react';

/*
 * 复选框插槽直接转发 antd 属性与引用，使用局部主题修改选择颜色。
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
/*
 * antd 负责同步半选状态与引用，插槽无需手动修改真实输入框。
 * 包装节点标记为交互区域，点击标签和勾选图标不会触发行点击。
 */
const CustomCheckbox = memo(function CustomCheckbox({ controlProps }: ComponentProps<ApexTableSlots<Item>['checkbox']>) {
  return <ConfigProvider theme={{ token: { colorPrimary: '#ad4f22' } }}>
    <span className="apex-table-checkbox" data-apex-interactive><Checkbox {...controlProps} /></span>
  </ConfigProvider>;
});
const slots: Partial<ApexTableSlots<Item>> = { checkbox: CustomCheckbox };
export default function CheckboxSlot() {
  return <ApexTableReact columns={columns} data={data} getRowId={(row) => row.id} height={290} showSelectionColumn slots={slots} />;
}
