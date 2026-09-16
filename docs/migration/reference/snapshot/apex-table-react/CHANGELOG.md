# 变更记录
## 0.1.0（2026-09-16）

- 发布首个正式版本，包含候选版本的全部功能及最新行展开能力。
- npm 官方源使用 `latest` 标签发布，同步更新正式版安装说明。

## 0.1.0-rc.0（2026-09-16）

- 新增 `expandable` 行展开配置与 `ApexExpandable` 类型，支持自定义详情、行权限、默认及受控展开、变更回调、行点击和展开列固定；详情自动测量高度，兼容虚拟滚动及行定位，补充基础与受控示例。

- 新增 `ref.reload()` 与 `reload({ resetPageIndex: true })`，主动刷新保留列布局、排序、筛选及选择状态。`request` 新增 sorting、columnFilters、globalFilter 参数，条件变化自动请求并默认回到第一页，支持受控状态及原生实例 setter。
- 请求模式的 `manualSorting/manualFiltering` 默认值改为 true，由服务端处理完整查询；原有当前页本地排序/筛选可显式设置为 false。`autoResetPageIndex={false}` 保留条件变化前的页码，响应数据更新本身不再触发分页重置。

- 接入 antd 6.6.4，新增十种内置单元格；data 模式支持 editable / onDataChange 受控编辑、列级权限、嵌套字段和计算列回写，补充数据获取示例与回归测试。

- 新增 `request` 服务端分页入口，自动管理数据、总数、分页变化、加载、错误重试与过期请求；简化服务端分页示例并导出请求类型。
- 所有 demo 统一通过 `columns`、`data` 或 `request` 和功能 props 接入，移除 TanStack、外部 atom 和 CSS 导入。
- 内置排序、过滤、分页、选择及列设置，支持原生状态回调、manual 选项和内置函数名称。
- 增加 `tableRef`、`ApexTableInstance`、`ApexTableSlots` 和常用状态类型导出，主题变量可通过 `style` 配置。
- 保留原生实例入口兼容，更新指南、API 和独立主题示例。
