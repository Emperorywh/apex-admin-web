---
title: API
nav:
  title: API
  order: 2
---

# ApexTableReact API

统一传入 `columns`、数据来源（`data` 或 `request`）和功能 props，组件封装 TanStack Table 的实例、特性和本地行模型，默认入口自动加载结构与主题样式。列、状态、更新回调及 manual 选项尽量沿用 TanStack v9 命名，业务无需导入第三方表格 API。

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| columns | 必填 | 列定义数组，可从本包导入 ApexColumnDef&lt;Item&gt; 类型 |
| data | 与 request 二选一 | 数据数组，更新数组引用即可刷新；默认行 ID 使用原生索引 |
| request | 与 data 二选一 | 异步查询函数，接收 {pageIndex,pageSize,sorting,columnFilters,globalFilter,signal}，返回 Promise&lt;{data,rowCount}&gt;；自动管理服务端分页、排序、筛选、加载、错误和重试 |
| height | 100% | 像素或 CSS 高度，需要可测父容器 |
| rowHeight | 随密度 | 有限数且 ≥32，覆盖密度 |
| density/defaultDensity/onDensityChange | standard | 可受控的 Apex UI 状态 |
| showSelectionColumn | false | true 或 {size,sticky}；默认 44px/start |
| expandable | 无 | 行详情配置，支持受控展开、行权限和动态高度；详见下方行展开说明 |
| showRowNumber | 随 columnSettingsEnabled | true 或 {size,sticky}；默认 48px/false；显式 false 隐藏行号列 |
| columnSettingsEnabled | false | 弹窗配置显隐、宽度、固定位置、拖动排序和恢复默认；确认后应用，取消放弃草稿；入口默认位于行号列表头 |
| pagination | 未配置时连续列表 | true 或 {pageSizeOptions} 启用分页；false 隐藏控件，页大小选项默认 10/20/50/100/200 |
| virtualization | auto | true/false/{overscan}，默认上下各 8 行 |
| loading/error/onRetry | 无 | 配置错误 → loading → 非空 error → 行模型 |
| name/locale | 简体中文 | 表格名称、内置文案及格式化函数 |
| slots/slotProps | 无 | 替换控件/补充公开 DOM 包 |
| onRowClick | 无 | (nativeRow,event)；不隐含选择或跳转 |
| className/style | 无 | 根级外观；style 支持 --apex-table-* 主题变量，无需 CSS 导入 |
| getPopupContainer | 随控件 | Apex 自有弹层在当前位置，antd 单元格弹层默认 document.body；可覆盖挂载容器 |
| onDiagnostic | 无 | 几何、分页参数、身份、能力和受保护属性诊断 |

ref 提供 focus()、scrollToRow(rowId):boolean 和 reload(options?):void。滚动目标须在当前结果中，不存在时返回 false 并保持位置，不跨页请求。reload 仅在 request 模式发起查询，默认保留当前页；传入 {resetPageIndex:true} 回到第一页。data 和原生 table 模式下 reload 不执行操作，数据更新由业务负责。

## 数据与功能 props

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| getRowId | 数据索引 | 返回稳定业务 ID，选择和跨页场景建议提供 |
| defaultColumn | 原生默认列 | 公共尺寸、渲染器及列能力配置 |
| enableSorting / enableMultiSort | false / false | 启用排序；多列排序可用 Shift 点击表头 |
| state / initialState | 内部管理 | 受控切片 / 初始切片，切片名称沿用 TanStack |
| onSortingChange / onColumnFiltersChange / onGlobalFilterChange | 内部更新 | 配合相应 state 切片，React setter 可直接传入 |
| onPaginationChange / onRowSelectionChange | 内部更新 | 受控分页与选择 |
| onColumnOrderChange / onColumnVisibilityChange / onColumnSizingChange / onColumnPinningChange | 内部更新 | 受控列布局及偏好恢复 |
| enableRowSelection | 随 showSelectionColumn | boolean 或行权限回调；enableMultiRowSelection 可控制多选 |
| enableColumnResizing | 随 columnSettingsEnabled | 也可独立启用表头调宽；其他列权限沿用 enableHiding / enableColumnPinning |
| manualPagination / manualSorting / manualFiltering | data 模式 false；request 模式 true | 对应功能改由服务端处理，组件跳过该本地行模型；request 不允许覆盖 manualPagination |
| autoResetPageIndex | request 模式 true | 服务端排序或筛选条件变化时回到第一页，false 保留当前页；若设置 autoResetAll，则优先使用它 |
| rowCount / pageCount | 根据本地结果计算 | 服务端返回的总行数或页数 |
| tableRef | 无 | Ref&lt;ApexTableInstance&lt;Item&gt;&gt;，提交后获得内部实例，卸载时清理 |
| editable | false | 仅 data 模式，开启已配置内置编辑器的单元格；需要同时提供 onDataChange |
| onDataChange | 无 | (nextData, change)；每次有效修改返回新数组和 ApexCellChange&lt;Item&gt;，父组件需要将新数组传回 data |
| editorConfig | 中文、小尺寸 | antd ConfigProvider 的 locale、theme、componentSize、direction、prefixCls，作用于当前表格 |

`pagination` 为 true 或配置对象，或提供 `request`、`state.pagination`、`initialState.pagination`、`manualPagination` 时启用分页。`pagination={false}` 只隐藏控件；其余分页配置仍可维持分页模型。基础用法没有分页配置时渲染连续列表。

支持在列定义上直接写 `sortFn: 'basic'`、`filterFn: 'includesString'` 等内置名称或传入自定义函数，组件内部注册所需实现。`state` 与对应 `on…Change` 成对使用；只传初始值时用 `initialState`，更改 initialState 不重置现有实例。默认不控制状态的切片由组件内部管理。

`ApexTableReactDataProps<Item>` 描述 props 接入，`ApexColumnDef<Item>` 描述列，`ApexTableSlots<Item>` 描述插槽，`ApexTableState` 描述全部已封装的状态。`SortingState`、`ColumnFiltersState`、`PaginationState`、`RowSelectionState` 等常用类型均从本包导出。

`tableRef` 提供 `setSorting`、`setColumnFilters`、`setPageIndex`、`setRowSelection`、`resetRowSelection`、`getAllLeafColumns` 等原生实例方法。方法更新受控切片时仍经过业务回调；业务界面应通过受控状态或插槽订阅更新。实例的 `state` 为 null，按需读取快照可用原生 `atoms.<slice>.get()`，无需导入或自行创建 atom。`ref` 的 `focus` 和 `scrollToRow` 能力保持独立。

### 行展开

通过 `expandable` 配置详情展示，适用于备注、订单明细或嵌套组件。`expandedRowRender` 和 `rowExpandable` 接收原始业务记录；列定义及数据入口仍使用本组件的 `columns` 和 `data/request/table`，不是 antd 的 `dataSource`。

```tsx | pure
/*
 * 行 ID 同时用于展开、选择和滚动定位，应使用唯一稳定的字符串。
 * 详情高度按内容测量，普通数据行仍沿用 rowHeight。
 */
<ApexTableReact
  columns={columns}
  data={data}
  getRowId={(record) => String(record.key)}
  expandable={{
    expandedRowRender: (record) => <p style={{ margin: 0 }}>{record.description}</p>,
    rowExpandable: (record) => record.name !== 'Not Expandable',
  }}
/>
```

配置类型 `ApexExpandable<Item>` 从包入口导出：

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| expandedRowRender | 必填 | `(record, index, indent, expanded) => ReactNode`；index 为当前页排序、筛选后的数据索引，indent 为 0，展开渲染时 expanded 为 true |
| rowExpandable | 全部可展开 | `(record) => boolean`；返回 false 时隐藏入口且不渲染详情，即使键存在于展开集合中 |
| expandedRowKeys | 内部管理 | `readonly string[]`，受控展开键，使用 getRowId 返回的字符串，而非自动读取 record.key |
| defaultExpandedRowKeys | [] | 非受控初始展开键；传入时优先于 defaultExpandAllRows |
| defaultExpandAllRows | false | 默认展开挂载时已有的可展开数据；后续新增或请求返回的记录不自动展开，需要时使用受控键 |
| onExpand | 无 | `(expanded, record) => void`，用户切换一行时触发 |
| onExpandedRowsChange | 无 | `(expandedKeys: string[]) => void`，返回切换后的完整键集合，可直接接收 React setter |
| expandRowByClick | false | 点击行的非交互区域切换；链接、按钮、选择框、编辑器及文字选择不会触发；onRowClick 中 preventDefault 可阻止展开 |
| showExpandColumn | true | 是否显示独立展开列；隐藏时可通过受控状态或行点击触发展开，业务应提供可用键盘操作的入口 |
| columnWidth / columnTitle | 44 / 空 | 展开列宽度（有限正数）及表头内容 |
| fixed | false | true 或 left 固定在左侧，right 固定在右侧，遵守现有窄容器固定列降级规则 |

受控模式中，点击仅触发回调，实际状态以回传的 `expandedRowKeys` 为准。默认值只在挂载时生效；传入 `expandedRowKeys={[]}` 可明确收起全部。翻页、排序、筛选及数据暂时移除不会主动清除展开键；永久删除记录时，可由业务清理受控键。`rowExpandable` 的限制始终优先。

展开内容独立于原生树形 `expanded` 状态；不参与分页条数、行选择、行号和业务总数计算。虚拟滚动保留开启，详情通过实际 DOM 高度自动测量，支持异步加载和内容高度变化。`scrollToRow` 会计入详情高度，目标仍须在当前页结果中。可访问行索引在启用 expandable 时按当前页的「数据行 + 详情行」排列。

详情在收起或离开虚拟窗口时卸载，内部表单等需要保留的状态应由业务提升管理。它用于平铺数据的行详情，不代表支持树形数据或分组。文案 `locale.expansion/expandRow/collapseRow` 可单独覆盖。

### request 服务端分页

详见下方请求入口说明；内置控件和受控编辑参见 [单元格编辑](/editing)。

`request({ pageIndex, pageSize, sorting, columnFilters, globalFilter, signal })` 返回 `Promise<{ data, rowCount }>`：`pageIndex` 从 0 开始，`pageSize` 默认 10；`data` 是当前页数组，`rowCount` 是筛选后的非负整数总行数。可通过 `initialState.pagination` 配置初始页码和每页条数，通过 `pagination.pageSizeOptions` 配置选项。

首次挂载、分页或服务端排序/筛选条件变化、主动刷新和错误重试时自动请求。支持直接传内联函数，单独更换函数引用不会触发请求；下一次请求使用最新已提交的函数。相同排序项、相同列筛选项不会因为数组引用变化重复请求；筛选项的 value 和 globalFilter 按 Object.is 比较，复杂对象应保留稳定引用并以不可变方式更新。

排序传入 `SortingState`（`{id,desc}[]`），顺序表示多列排序优先级；列筛选传入 `ColumnFiltersState`（`{id,value}[]`），全局筛选为 `unknown`，其具体含义由业务接口定义。组件不负责拼接 URL 或限制后端查询格式。服务端应先筛选、排序，再分页；返回结果默认不会被客户端再次筛选或排序。表头排序仍需 `enableSorting`，多列排序需 `enableMultiSort`；筛选输入控件由业务提供。

上述切片均支持 `initialState`、`state` 与对应 `onSortingChange/onColumnFiltersChange/onGlobalFilterChange` 回调，也支持 `tableRef` 的 `setSorting/setColumnFilters/setGlobalFilter`。服务端条件变化默认回到第一页；`autoResetPageIndex={false}` 可保留当前页。受控分页的重置会通过 `onPaginationChange` 通知，父组件应接收该更新；最终页码仍以传回的 `state.pagination` 为准。响应数据变化本身不会重置分页，避免重复请求。

`ref.current?.reload()` 刷新当前查询；`ref.current?.reload({ resetPageIndex: true })` 从第一页刷新。类型为 `ApexTableRef`（别名 `ApexTableReactRef`），选项类型为 `ApexTableReloadOptions`。刷新保留排序、筛选、列布局和选择状态，不需要修改 React `key`；返回 void，请求结果或错误通过表格界面与插槽展示。外部业务参数更新提交后可在 effect 中调用 reload，以使用最新请求闭包；搜索条件优先接入上述受控筛选切片。

请求模式默认 `manualSorting/manualFiltering=true`。若需要沿用当前页本地计算，可显式设置对应选项为 false：本地排序变化不触发请求，传给 request 的 sorting 为 []；本地筛选变化不触发请求，传给 request 的 columnFilters 为 []、globalFilter 为 undefined。已有外部请求库或缓存管理仍可使用 data 和 manual 选项自行管理。

请求模式无需且不允许传入 `data`、`rowCount`、`pageCount`、`manualPagination`、`loading`、`error`、`onRetry`，分页状态和 `onPaginationChange` 也无需手动维护。需要受控分页时仍支持 `state.pagination` 配合 `onPaginationChange`。原生 `tableRef` 分页 setter 会触发相同的请求流程。

切页立即隐藏旧数据和旧总数；新查询或卸载时中止旧 `signal`，接口忽略取消信号时仍丢弃旧成功和失败结果。异常自动进入错误界面，默认重试按钮重新请求当前页，`slots.error` 可获取错误详情。使用 `fetch` 时应自行检查 `response.ok` 并抛出异常。非法分页不会调用接口；不符合结果结构的数据进入错误界面。

请求相关类型均从本包导出：`ApexTableRequest<Item>`、`ApexTableRequestParams`、`ApexTableRequestResult<Item>`、`ApexTableReactRequestProps<Item>`、`ApexTableReloadOptions`。`ApexTableReactDataProps<Item>` 同时包含本地数据和请求模式。

### 原有实例入口兼容

保留 `table` props 和 `ApexTableProps<F, D, S>`，用于兼容已有实例接入。与 `columns`、`data`、`request`、`tableRef` 互斥。所有 demo 均使用上述 props 数据模式；开发者不需要为了高级功能创建原生实例。

非法 pageIndex/pageSize 使用 invalidPagination 诊断；修正原生状态后恢复显示。诊断不隐式改写切片，不调用业务请求重试。

columnDef.meta.apex 支持 align(start/center/end)、flex、pinPriority、canReorder、label 和 editor。使用原生 columnMeta 类型槽时，将业务类型与 `{apex?:ApexColumnMeta<Item>}` 交叉；editor 的配置见 [单元格编辑](/editing)。

列配置通过行号列表头的齿轮打开原生模态弹窗；显式传 `showRowNumber={false}` 时使用工具栏入口。拖动序号可调整同一固定区域内的顺序，不能跨越 `canReorder: false` 的锁定列；“固定位置”下拉框提供取消固定、固定在左侧、固定在右侧三个选项。键盘聚焦序号后按空格开始拖动、上下方向键移动、空格放下、Esc 取消拖动。非拖动状态下 Esc 取消弹窗，在输入框内按 Enter 确认（输入法组合期间除外）。

列宽、显隐、固定和排序均先修改草稿，点击“确定”才写入组件状态和对应受控回调。“恢复默认”载入 `initialState` 和列定义，仍需确认后应用。至少保留一列可见；列宽遵守 minSize/maxSize；显隐、固定、调宽权限沿用原生列能力。字段名称沿用列定义，弹窗不提供名称编辑。

flex 只作用于未固定且无用户 sizing 覆盖的列，分配剩余宽度，不修改原生 getSize/size。无 flex 时余量留白。窄容器保留 160px 中间区，释放低优先级 sticky，原生固定状态与顺序不变。

行操作菜单直接使用 `import { Dropdown } from 'antd'`，通过 `menu.items` 配置菜单项、`menu.onClick` 处理操作，使用 `trigger={['click']}` 点击打开，参见行操作示例。菜单及浮层容器通过 Dropdown 自身的属性配置。

ApexTooltip：content/children，悬停或聚焦展示且不夺取焦点。表格内提示继承当前表格插槽和浮层容器。

headerContent/cellContent 接收原生 header/cell 与已经生成的 children，避免重复调用渲染器。普通列通过 table.FlexRender 渲染，配置 editor 的列生成内置单元格。原生 core table 上下文关系保持原样。

error 可独立使用且不要求 onRetry。默认显示本地化通用文案，业务详情通过插槽展示。全隐藏、部分 columnOrder、复杂过滤值和多列原生排序合法，Apex 不篡改状态；默认单列交互，enableMultiSort 可启用组合键多列排序。未知总数、分组、树形、多级表头尚无完整首版界面。
