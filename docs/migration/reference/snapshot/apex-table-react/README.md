# ApexTableReact

面向业务列表的 React 表格组件，基于 TanStack Table v9 和 TanStack Virtual 构建。通过 `columns`、`data` 或 `request` 配置表格，内置排序、筛选、分页、行选择、列设置和虚拟滚动。

默认入口自带结构样式和主题，可通过 CSS 变量调整外观、通过 React 插槽替换控件。适用于商品、订单、配置等需要统一交互、同时保留业务定制空间的列表。

[使用指南](./docs/guide.md) · [API 文档](./docs/api.md) · [主题与扩展](./docs/customization.md) · [示例源码](./docs/demos) · [更新记录](./CHANGELOG.md)

> 当前正式版本为 `0.1.0`，通过 npm 官方源的 `latest` 标签发布。

## 特性

- **通过 props 接入**：组件管理表格实例和常用行模型，基础使用无需创建 TanStack 实例或额外导入 CSS。
- **两种数据来源**：`data` 支持本地数据；`request` 自动管理服务端分页、排序、筛选、主动刷新、加载、错误重试、请求取消和过期响应。
- **排序与筛选**：支持本地排序、列筛选、全局筛选，以及由业务接管计算的 `manual` 选项。
- **列布局与选择**：支持列显隐、宽度调整、起始侧与末尾侧固定、列设置面板调序、行选择和序号列。
- **行展开**：通过 `expandable` 自定义详情、限制可展开行，支持默认展开、受控展开及行点击；详情高度自动测量并兼容虚拟滚动。
- **虚拟滚动**：按可视区域挂载数据行，支持固定行高、预渲染行数和三种密度。
- **类型与状态控制**：提供 TypeScript 类型、受控状态回调和实例引用，列与状态命名沿用 TanStack v9。
- **主题与控件扩展**：提供 CSS 变量、无样式入口、组件插槽和简体中文文案覆盖；内置控件包含键盘交互与 ARIA 属性。
- **列偏好存储**：独立适配器支持按用户、租户和表格保存列布局，可配置版本迁移。

## 安装

### 环境要求

| 环境 | 要求 |
| --- | --- |
| React / React DOM | 18 或 19，使用相匹配的版本 |
| Node.js | 20 及以上 |
| 模块与样式 | 支持 ESM 和 CSS 导入的构建工具 |
| 浏览器 | 支持 `ResizeObserver`、`AbortController` 等现代 Web API |

React 和 React DOM 由消费项目提供；TanStack 依赖随组件包安装，基础接入不需要自行注册特性。

### 从 npm 官方源安装当前正式版本

```sh
# 指定当前正式版本，从 npm 官方源安装。
# React 和 React DOM 由业务项目提供。
npm install apex-table-react@0.1.0 --registry=https://registry.npmjs.org/
```

### 从源码安装当前正式版本

在组件库目录构建并打包：

```sh
# 获取源码并进入组件库目录。
# 后续构建命令均在该目录执行。
git clone https://github.com/Emperorywh/ApexTableReact.git
cd ApexTableReact
pnpm install
pnpm build
pnpm pack --pack-destination .artifacts
```

然后在已有 React 项目中安装生成的压缩包。以下假设业务项目与 `ApexTableReact` 目录同级，请按实际位置调整路径：

```sh
# 将构建后的组件包安装为项目依赖。
# 包名仍为 apex-table-react，导入方式与后续示例一致。
pnpm add ../ApexTableReact/.artifacts/apex-table-react-0.1.0.tgz
```

## 快速开始

在 React 项目中添加以下组件：

```tsx
import { ApexTableReact } from 'apex-table-react';
import type { ApexColumnDef } from 'apex-table-react';

/*
 * 列定义与数据共用行类型，便于检查字段和渲染回调。
 * 使用稳定的业务 ID，确保排序、筛选后仍能识别同一条记录。
 */
type Item = { id: string; name: string; stock: number };

const columns: ApexColumnDef<Item>[] = [
  { accessorKey: 'name', header: '商品名称' },
  { accessorKey: 'stock', header: '库存', sortFn: 'basic' },
];

const data: Item[] = [
  { id: 'cup', name: '陶瓷杯', stock: 36 },
  { id: 'cloth', name: '亚麻桌布', stock: 12 },
  { id: 'vase', name: '玻璃花瓶', stock: 24 },
];

/*
 * 明确高度后即可显示表格，默认入口会自动加载所需样式。
 * 示例启用本地排序、行选择、列设置和分页，状态由组件内部管理。
 */
export default function App() {
  return (
    <ApexTableReact
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      height={420}
      enableSorting
      showSelectionColumn
      columnSettingsEnabled
      pagination={{ pageSizeOptions: [10, 20, 50] }}
    />
  );
}
```

只需连续列表时，传入 `columns`、`data` 和 `height` 即可；未配置分页时不会默认截取前十条数据。

## 单元格编辑

需要本地编辑时，通过列的 `meta.apex.editor` 指定 antd 控件，并传入 `editable` 和 `onDataChange={setData}`。内置 Checkbox、ColorPicker、DatePicker、Input、InputNumber、Radio、Select、Switch、TimePicker、Image，详见 [单元格编辑](./docs/editing.md)。

## 服务端分页

将 `data` 替换为 `request`。组件在首次挂载、分页或服务端排序/筛选变化、主动刷新和错误重试时调用请求函数，自动维护当前页、总数和加载状态。

以下示例沿用快速开始中的 `Item` 和 `columns`；`/api/items` 为业务接口占位地址，需要由你的服务提供。

```tsx
import { useRef } from 'react';
import type { ApexTableRef, ApexTableRequestResult } from 'apex-table-react';

/*
 * 请求页码从零开始；若后端从一开始计数，请在接口参数中转换。
 * 服务端先筛选、排序再分页，返回当前页 data 和筛选后的 rowCount。
 * 查询参数编码仅为示例，请根据实际接口约定映射字段。
 */
export function RemoteTable() {
  const ref = useRef<ApexTableRef>(null);
  return (
    <>
    <button onClick={() => ref.current?.reload()}>刷新当前页</button>
    <ApexTableReact
      ref={ref}
      columns={columns}
      getRowId={(row) => row.id}
      height={420}
      enableSorting
      initialState={{ pagination: { pageIndex: 0, pageSize: 20 } }}
      request={async ({ pageIndex, pageSize, sorting, columnFilters, globalFilter, signal }) => {
        const query = new URLSearchParams({
          pageIndex: String(pageIndex),
          pageSize: String(pageSize),
          sorting: JSON.stringify(sorting),
          filters: JSON.stringify(columnFilters),
          search: String(globalFilter ?? ''),
        });
        const response = await fetch(`/api/items?${query}`, { signal });
        if (!response.ok) throw new Error('加载商品列表失败');
        const result: ApexTableRequestResult<Item> = await response.json();
        return result;
      }}
    />
    </>
  );
}
```

接口应返回 `{ data: Item[], rowCount: number }`，其中 `rowCount` 是非负整数。请求模式无需且不能同时传入 `data`、`rowCount`、`pageCount`、`manualPagination`、`loading`、`error` 或 `onRetry`。

`request` 默认自动协调服务端分页、排序和筛选。通过 `enableSorting` 开启表头排序，通过 `state.columnFilters/state.globalFilter` 及对应回调接入筛选；条件变化默认回到第一页，`autoResetPageIndex={false}` 可保留页码。显式设置 `manualSorting/manualFiltering={false}` 可沿用当前页本地计算。需要外部请求库或缓存时，仍可使用 `data` 和 manual 选项由业务管理请求。

请求函数可以内联定义；仅改变函数引用不会重新请求。`ref.current?.reload()` 刷新当前页，`reload({ resetPageIndex: true })` 从第一页刷新，两者均保留排序、筛选、列布局和选择状态。外部参数变化后的刷新时机见 [request API](./docs/api.md#request-服务端分页)。

## 常用配置

| 需求 | 配置入口 |
| --- | --- |
| 本地排序 | `enableSorting`；多列排序增加 `enableMultiSort` |
| 列筛选 / 全局筛选 | `state.columnFilters` / `state.globalFilter` 及对应回调；筛选输入控件由业务提供 |
| 本地分页 | `pagination`；通过 `initialState.pagination` 设置初始页 |
| 行选择 / 序号列 | `showSelectionColumn` / `showRowNumber` |
| 列设置 / 独立调宽 | `columnSettingsEnabled` / `enableColumnResizing` |
| 初始固定列 | `initialState.columnPinning`，使用 `start` / `end` |
| 密度 / 行高 | `density` 或 `defaultDensity`；`rowHeight` 可覆盖密度行高 |
| 加载 / 错误 / 重试 | 本地数据模式下使用 `loading` / `error` / `onRetry` |
| 行点击 | `onRowClick(row, event)`，通过 `row.original` 获取业务记录 |
| 本地化 | `locale` 局部覆盖文案与数量格式化函数 |
| 外部操作 | `tableRef` 获取实例；`ref` 提供聚焦和滚动方法 |

### 状态与实例

- 只设置初始值时使用 `initialState`；后续修改它不会重置现有状态。
- 需要受控状态时，将 `state` 中的切片与对应 `on…Change` 回调配对。回调接受 TanStack 原生 updater，可直接传 React 的状态 setter。
- 同一状态同时出现在 `state` 与 `initialState` 中时，以 `state` 为准。
- `tableRef` 可调用 `setPageIndex`、`setRowSelection`、`setColumnFilters` 等实例方法；界面同步使用受控状态或插槽订阅。
- `ref` 提供 `focus()`、`scrollToRow(rowId)` 与 `reload(options?)`；滚动定位仅针对当前结果，reload 仅在 request 模式刷新查询。

完整属性与类型见 [API 文档](./docs/api.md)，使用示例见 [受控选择](./docs/demos/ControlledSelection.tsx) 和 [实例方法](./docs/demos/TableHook.tsx)。

## 主题与扩展

### 自定义主题

默认入口自动加载结构样式和主题，不包含全局 CSS reset。可以通过 `style` 传入公开 CSS 变量，以下沿用快速开始中的数据和列：

```tsx
/*
 * 主题变量仅作用于当前表格，同一页面可以并存不同外观。
 * 行高通过 rowHeight 或密度配置调整，保持渲染与虚拟滚动计算一致。
 */
export function BrandedTable() {
  return (
    <ApexTableReact
      columns={columns}
      data={data}
      height={420}
      style={{
        '--apex-table-accent-color': '#ad4f22',
        '--apex-table-header-bg': '#f6eee4',
        '--apex-table-border-color': '#dac8b3',
        '--apex-table-radius': '8px',
      }}
    />
  );
}
```

需要自行提供样式时，从 `apex-table-react/unstyled` 导入组件，该入口不自动加载任何 CSS。可额外导入 `apex-table-react/styles/structure.css` 保留布局结构，再提供自己的主题。

### 插槽与偏好

- `slots` 接收 React 组件，可替换工具栏、表头内容、单元格内容、复选框、分页、加载、空态和错误界面等；支持组件内部使用 Hook。
- `slotProps` 为公开 DOM 属性补充类名、事件等。替换控件时，需要将插槽提供的属性转发到对应真实元素，以保留交互与可访问语义。
- `apex-table-react/adapters/local-column-preferences` 导出 `createLocalColumnPreferences`，按显式身份配置保存列顺序、显隐、宽度和固定状态；持久化由业务主动接入。

完整变量、插槽约定与存储接口见 [主题与扩展](./docs/customization.md)。

## 使用边界

- **容器需要可测量的高度**：推荐显式传入 `height`；使用默认 `100%` 高度时，父容器应有确定高度。Flex 布局还需允许容器收缩，例如设置 `min-height: 0`。
- **当前采用固定行高**：紧凑、标准、宽松密度分别为 40、48、64px。`rowHeight` 必须是大于等于 32 的有限数，不支持可变行高。
- **虚拟滚动影响浏览器查找范围**：默认连续列表开启虚拟化，分页结果超过 200 行时自动开启；浏览器页面查找只能覆盖已挂载行。可配置 `virtualization={false}` 渲染当前结果的全部行。
- **选择依赖稳定身份**：涉及排序、筛选或跨页选择时，应提供 `getRowId`。跨页保留、筛选后清空等选择策略由业务决定。
- **隐藏分页控件不等于关闭分页模型**：`pagination={false}` 隐藏控件，其他分页配置仍可能启用分页模型，详见 API 文档。
- **复杂结构尚未支持完整界面**：分组、树形数据、多级表头和未知总数分页不属于当前版本已完整支持的场景。

## 本地开发与贡献

欢迎通过 [Issues](https://github.com/Emperorywh/ApexTableReact/issues) 反馈问题或提出建议，通过 [Pull Requests](https://github.com/Emperorywh/ApexTableReact/pulls) 提交改进。

安装依赖后运行 `pnpm dev` 启动文档站，以终端输出地址为准。文档站包含本地数据、服务端分页、行选择、列设置、插槽和主题等演示。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动本地文档与示例 |
| `pnpm typecheck` | 检查源码、文档示例和配置的 TypeScript 类型 |
| `pnpm lint` | 检查源码脚本与样式 |
| `pnpm build` | 构建组件包到 `dist` |
| `pnpm docs:build` | 构建组件、独立主题示例和文档站 |
| `pnpm docs:preview` | 预览已构建的文档站 |

提交问题时，请提供版本、运行环境、最小复现和预期行为。贡献代码时，请遵循仓库开发规范，说明变更与验证方式；涉及公开 API 的改动应同步更新类型、文档、示例和变更记录。

## 许可证

本项目采用 [MIT License](./LICENSE)。
