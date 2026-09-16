---
title: 快速开始
nav:
  title: 使用指南
  order: 1
---

# 接入指南

通过 npm 官方源安装正式版本 `apex-table-react@0.1.0`，也可使用仓库 `pnpm pack` 生成的 tarball。基础场景只需从本包导入 `ApexTableReact`，传入 `columns`、`data` 和 `height`，无需导入 TanStack API 或样式。排序、筛选、分页、选择和列设置也通过 props 启用。最小接入见 README，完整示例见 [组件演示](/components/apex-table)。

## 按顺序学习

组件演示从三条本地数据和两列普通对象开始，由组件内部创建实例。后续示例只增加对应功能的 props，保持相同接入方式。

1. 基础渲染：本地数据、单元格格式、行操作。
2. 本地交互：选择、排序、搜索、分页、列设置、密度。
3. 展示状态：加载、空数据、错误重试。
4. 外观扩展：文案、主题、工具栏插槽、复选框插槽、事件补充。
5. 进阶接入：受控选择、实例 API、复用表格 props、虚拟滚动、服务端分页、列偏好。

所有示例统一从 `apex-table-react` 及其公开子入口导入组件、类型和适配器，与安装组件包后的业务项目保持一致。

## 本地与服务器

本地连续列表直接传 `data` 和 `columns`。排序传 `enableSorting`；搜索通过 `state.columnFilters` 或 `state.globalFilter` 及其对应回调控制，组件内置本地过滤和排序行模型。

本地分页传 `pagination` 或 `pagination={{ pageSizeOptions: [5, 10, 20] }}`；初始页通过 `initialState.pagination` 设置。没有分页配置时保持连续列表，不会默认截取前十条。

服务器分页列表只需传 `request`，接收 `{ pageIndex, pageSize, sorting, columnFilters, globalFilter, signal }` 并返回 `{ data, rowCount }`。组件自动协调服务端分页、排序与筛选，管理数据、总数、加载和错误重试。页码从 0 开始，默认每页 10 条，可通过 `initialState.pagination` 设置初始分页。无需传入 `data`、`rowCount`、`manualPagination`、`onPaginationChange` 或 `loading`。

`request` 可直接使用内联函数，不会因函数引用变化重复请求。业务可将 `signal` 传给 `fetch`；组件在查询变化和卸载时取消旧信号，并丢弃过期响应。排序仍通过 `enableSorting` 开启，筛选通过 `state.columnFilters/state.globalFilter` 及对应回调接入。服务端应先筛选、排序再分页，rowCount 返回筛选后总数；条件变化默认回到第一页，可用 `autoResetPageIndex={false}` 保留页码。显式设置 `manualSorting/manualFiltering={false}` 可沿用当前页本地计算。外部请求库仍可用 `data`、`rowCount` 和 manual 选项自行管理。

主动刷新使用 `ref.current?.reload()`，默认保留当前页；`ref.current?.reload({ resetPageIndex: true })` 从第一页刷新。引用类型为 `ApexTableRef`，原有 focus/scrollToRow 方法保持可用。刷新不会重建表格或清除列布局、选择状态。外部业务参数变化后，应在 React 提交后的 effect 中调用 reload，确保读取最新请求闭包。

`pagination={false}` 隐藏分页控件；如果仍传入 `request`、`state.pagination`、`initialState.pagination` 或 `manualPagination`，分页模型依然启用。没有这些分页配置时使用连续列表。

选择传 `showSelectionColumn`，列设置传 `columnSettingsEnabled`。开启列设置后，默认在行号列顶部显示齿轮入口；显式传 `showRowNumber={false}` 时隐藏行号列并使用工具栏入口。列定义使用普通对象，`sortFn: 'basic'`、`filterFn: 'includesString'` 等内置名称可直接使用，自定义函数也可直接传入。

## 受控状态与实例 API

data 模式支持十种 antd 内置单元格。通过 `meta.apex.editor` 选择控件，同时传 `editable` 和 `onDataChange={setData}` 开启编辑。完整配置、值类型和示例见 [单元格编辑](/editing)。

使用 `state` 和同名 `on…Change` 回调即可管理状态，回调接收原生 updater，可直接传 React state setter。只需初始值时使用 `initialState`，后续更新交给组件；两者同时包含同一切片时，以 `state` 为准。

外部按钮可通过 `tableRef` 调用 `setRowSelection`、`resetRowSelection`、`setColumnFilters`、`setPageIndex` 等原生命名的方法。引用类型从本包导入 `ApexTableInstance<Item>`，无需创建实例或 atom。用于界面同步的业务状态应使用受控 props；不要在 render 中通过引用读取状态。

## 尺寸与交互

提供明确 height，或使用有确定高度且 min-height:0 的 flex 父容器。隐藏容器暂停虚拟窗口，ResizeObserver 在重新显示时恢复。默认行高 48px，compact 40px，comfortable 64px；rowHeight 覆盖密度且必须 ≥32，不能只改 CSS 高度。

连续列表默认虚拟化，分页结果超过 200 行才自动开启。overscan 默认上下各 8 行。普通浏览器查找只能覆盖已挂载窗口，业务搜索覆盖全量数据。

跨页选择用稳定 getRowId。分页表头调用原生页内全选，连续列表调用全部筛选结果全选。摘要清空调用 resetRowSelection(true)，恢复初始值使用 resetRowSelection()。

服务端分页示例只需列配置和 `request`，分页状态及请求生命周期由组件管理。跨页保留选择、筛选后清空选择等策略由业务决定。行操作示例单独演示行点击和菜单按钮；自定义交互区可添加 data-apex-interactive。

`request` 模式自动在分页、服务端排序/筛选变化或主动刷新时显示加载态，并一起提交当前页和总数。使用外部请求自行管理 `data` 时，业务仍需在查询变化时传 `loading`，丢弃旧成功/失败，完成时一起提交 `data`、`rowCount`、`error`、`loading`。开关等待保存成功才更新值。

## v9 实际名称

9.2.4 使用 **columnResizing** 临时切片、setColumnResizing 和 resetHeaderSizeInfo(true)。规格部分段落的 columnSizingInfo 为旧名称；实现不新增同义状态。固定位置是 start/end，比较器是 sortFn。

所有示例直接使用列对象数组，可用本包的 ApexColumnDef&lt;Item&gt; 标注类型；格式化数值时可用 `cell.getValue<number>()` 或 `row.original` 读取明确类型的数据。
