---
title: ApexTableReact 表格
group:
  title: 组件
  order: 1
---

# ApexTableReact

所有场景都直接给 `ApexTableReact` 传入 `columns`、`data` 和功能 props，组件内部管理实例并自动加载样式。开发者只需使用 React 与本包，无需导入 TanStack、其他第三方库或 CSS。下面按由简到繁的顺序排列，每个示例只介绍一个主题。

## 基础渲染

### 1. 最简单的本地数据渲染

三条静态数据、两列普通对象，无需导入 TanStack API 或样式。复制这个示例即可开始。

<code src="../../docs/demos/Basic.tsx"></code>

### 2. 单元格格式

用列的 `cell` 回调显示售价与库存标签。

<code src="../../docs/demos/CellRendering.tsx"></code>

### 3. 行点击与操作菜单

点击行查看物品，菜单中的编辑操作独立触发。

<code src="../../docs/demos/RowActions.tsx"></code>

## 本地交互

### 4. 行选择

启用复选框选择与选择摘要，使用稳定的行 ID。

<code src="../../docs/demos/RowSelection.tsx"></code>

### 5. 本地排序

点击库存表头切换升序、降序和默认顺序。

<code src="../../docs/demos/LocalSorting.tsx"></code>

### 6. 本地搜索

提交名称关键字过滤本地数据，重置后恢复全部数据。

<code src="../../docs/demos/LocalFiltering.tsx"></code>

### 7. 本地分页

传入 pagination 和 initialState，组件自动分页处理 36 条本地数据，尝试翻页和更改每页条数。

<code src="../../docs/demos/LocalPagination.tsx"></code>

### 8. 列设置

点击行号列顶部的齿轮打开配置弹窗，拖动序号调整同一固定区域内的顺序，设置列宽、显隐，并通过下拉框选择固定位置。点击“确定”应用，点击“取消”放弃修改；恢复默认也在确认后生效。启用列设置时默认显示行号列。

<code src="../../docs/demos/ColumnSettings.tsx"></code>

### 9. 行密度

切换紧凑、标准和宽松，观察行高变化。

<code src="../../docs/demos/Density.tsx"></code>

## 展示状态

### 10. 加载中

切换加载开关，观察骨架与数据行的切换。

<code src="../../docs/demos/Loading.tsx"></code>

### 11. 空数据

直接传入空数组，查看默认空态。

<code src="../../docs/demos/Empty.tsx"></code>

### 12. 错误与重试

初始显示模拟错误，点击重试恢复数据，再次点击“模拟失败”可重新体验。

<code src="../../docs/demos/ErrorState.tsx"></code>

## 外观与插槽

### 13. 文案覆盖

仅将选择场景改为英文，未覆盖的文案仍使用默认值。

<code src="../../docs/demos/Localization.tsx"></code>

### 14. 品牌主题

通过 style props 中的主题变量覆盖颜色、字体和圆角，无需导入 CSS。独立双主题示例见 [主题与扩展](/customization)。

<code src="../../docs/demos/Customization.tsx"></code>

### 15. 工具栏插槽

在工具栏中加入业务标题，转发插槽的 DOM 属性及内置内容。

<code src="../../docs/demos/AdvancedSlots.tsx"></code>

### 16. 复选框插槽

替换真实复选框，保留属性、引用和半选状态。选择一行后可观察表头半选效果。

<code src="../../docs/demos/CheckboxSlot.tsx"></code>

### 17. 补充控件事件

勾选“禁止修改选择”后，业务事件通过 `preventDefault()` 取消复选框操作。

<code src="../../docs/demos/SlotEvents.tsx"></code>

## 进阶接入

### 18. 受控选择

使用 React state 管理选择，在表格下方同步显示选中的 ID。

<code src="../../docs/demos/ControlledSelection.tsx"></code>

### 19. 实例 API

传入 tableRef，由组件提供实例；按钮调用 setRowSelection 和 resetRowSelection，方法名称与 TanStack 一致。

<code src="../../docs/demos/NativeCompatibility.tsx"></code>

### 20. 复用表格 props

项目 Hook 组合列、数据和受控状态 props，再统一传给 ApexTableReact，实例生命周期由组件管理。

<code src="../../docs/demos/TableHook.tsx"></code>

### 21. 一万行虚拟滚动

在固定高度内浏览一万条本地数据，只挂载可见窗口附近的行。浏览器查找只能匹配当前挂载的内容。

<code src="../../docs/demos/LocalTable.tsx"></code>

### 22. 服务端分页

只传 `request` 即可接入服务端分页、排序与筛选，无需维护数据、总数或加载状态。示例模拟 500 毫秒接口延迟：点击表头排序，提交商品搜索及最低库存筛选，条件变化默认回到第一页；刷新按钮通过 ref.reload 保留当前页或返回首页。组件取消过期请求，请求失败时提供重试。

<code src="../../docs/demos/ProductTable.tsx"></code>

### 23. 保存与恢复列偏好

调整列设置后显式保存，刷新页面恢复布局。清除操作仅移除这个示例的存储记录。

<code src="../../docs/demos/Preferences.tsx"></code>

### 24. 内置单元格与受控编辑

data 模式通过 `editable` 和 `onDataChange` 开启编辑，列的 `meta.apex.editor` 选择 antd 控件。示例包含十种组件，支持排序、分页、虚拟滚动、只读切换和获取全部数据。Image 只展示缩略图并支持预览，图片更新由业务通过 data 接入；ColorPicker 默认只展示可点击选择颜色的色块。

<code src="../../docs/demos/EditableCells.tsx"></code>

### 25. 行展开

通过 `expandable.expandedRowRender` 渲染详情，`rowExpandable` 控制哪些记录可以展开。展开键使用 `getRowId` 返回的字符串；普通行保持固定高度，详情按内容自动撑高。

<code src="../../docs/demos/Expandable.tsx"></code>

### 26. 受控展开与虚拟滚动

`expandedRowKeys` 配合 `onExpandedRowsChange` 控制展开；点击行的非交互区域也可切换。尝试切换详情长度、翻页、排序与定位，展开状态独立于行选择，详情不计入分页条数。

<code src="../../docs/demos/ControlledExpandable.tsx"></code>
