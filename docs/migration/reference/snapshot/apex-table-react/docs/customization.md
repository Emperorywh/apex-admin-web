---
title: 主题与扩展
nav:
  title: 主题与扩展
  order: 3
---

# 样式、插槽和偏好

从默认入口导入 ApexTableReact 时自动加载结构样式与默认主题，无需额外导入 CSS。品牌外观通过 `style` props 中的公开主题变量配置，所有 demo 均使用同一组件入口。样式不包含全局 reset，默认系统中文字体不需要外部下载。

颜色变量包括 --apex-table-bg/header-bg/text-color/muted-color/accent-color，状态变量包括 --apex-table-row-hover-bg/row-selected-bg/disabled-color/focus-color。边框、圆角、阴影、字体、间距和层级对应 --apex-table-border-color/radius/pinned-shadow/font-family/font-size/padding-inline/control-gap/icon-size/overlay-z-index。--apex-geometry-* 为只读输出。

稳定类名以 apex-table 开头，包含 header/body/row/cell/pagination/column-settings/empty/error/skeleton；行状态使用 data-selected/data-pinned，控件禁用使用原生 disabled，不依赖 nth-child。

行展开提供 `apex-table-expand-button`、`apex-table-expanded-row` 和 `apex-table-expanded-cell` 类名；普通数据行展开时带有 `data-expanded`，展开辅助列使用 `data-apex-track="expansion"`。详情复用 `--apex-table-row-hover-bg`、`--apex-table-border-color` 和 `--apex-table-padding-inline`，结构样式允许内容自然撑高。

## 插槽 DOM 包

| 插槽 | 转发目标 |
| --- | --- |
| toolbar | 容器 rootProps |
| headerContent/sortIcon | 内容 rootProps、真实按钮 sortButtonProps、装饰图标 |
| cellContent | 内容容器 rootProps |
| checkbox | antd Checkbox 的 controlProps；直接转发属性、半选状态和 CheckboxRef |
| resizeHandle | 手柄 handleProps、数值输入 widthInputProps |
| pagination | rootProps/getPageButtonProps(index)/pageSizeProps/jumpInputProps |
| columnSettings | 模态弹窗内容 rootProps；转发 ref 并保留 children 可复用拖动、编辑、权限和草稿提交 |
| tooltip | triggerProps/contentProps；提示不作为焦点目标 |
| loading/empty/error | rootProps、可选 retryButtonProps |
| selectionSummary | rootProps、原生选择和 count；清空用 reset(true) |

slotProps.checkbox.controlProps 等可补充 className、非几何 style、ref 和事件。业务事件先执行，同步 preventDefault 取消此次内部 setter，stopPropagation 仅影响传播。Escape/指针释放/卸载清理始终执行。

行选择和表头全选默认使用 antd `Checkbox`，主题沿用当前表格的 `editorConfig`。复选框的 `controlProps.onChange` 接收 antd 变更事件，通过 `event.target.checked` 读取状态；`ref` 指向 antd `CheckboxRef`，真实输入框可通过 `ref.current.input` 访问。自定义复选框插槽应转发 `controlProps`，并将包装节点标记为 `data-apex-interactive`，避免触发行点击。

slots 接收 React 组件，支持组件内部 Hook、memo 和 forwardRef。建议在组件外定义稳定的插槽组件，避免每次父级渲染创建新组件类型导致控件卸载。复选框示例使用 memo，并由 antd Checkbox 同步半选状态。

插槽上下文容器属性为只读；其中的 table、row、column、cell 和 header 仍是原生对象，可以正常调用它们的方法。工具栏、复选框和事件补充分为三个示例；受控选择与实例 API 也分别演示。

类型与运行时保护身份、状态、role、tabIndex、必需 aria 和几何。aria-describedby 去重合并。DOM 引用指向同一真实元素，支持 React 18 的 null 和 React 19 的清理返回值；复选框引用使用 antd CheckboxRef。

getPopupContainer 应选择主题作用域内的容器，或由业务给外部浮层容器提供对应样式和变量。

列配置使用原生 `dialog.showModal()` 进入浏览器顶层，背景不可交互、Tab 焦点保留在弹窗内；默认在表格内部挂载，也支持 `getPopupContainer`。打开时继承来源表格的主题变量。确认按钮与提示文字使用 `--apex-table-accent-color`，交互行使用 `--apex-table-row-selected-bg`，提示底色和边框沿用表格主题，默认统一为蓝色。

## 文案

内置单元格控件使用 antd 样式，通过 `editorConfig.theme` 配置控件主题，`editorConfig.locale` 配置日期等控件文案；它们与表格自身的 CSS 变量、locale 分别管理。`unstyled` 入口不加载 Apex 自有样式，但 antd 控件仍具有组件样式。

locale 支持局部覆盖并回退简体中文。Localization 示例仅覆盖选择场景的英文文案，展示数量格式化与可访问名称函数。需要完整替换时，用 ApexLocale 声明完整对象。业务列名、菜单项和提示内容由业务自己翻译；加载、空态和错误在各自示例中演示。

## 通过 props 配置双主题

以下独立页面从 `apex-table-react` 导入组件，传入 `columns`、`data` 和 `style`，在同一页面展示两套品牌外观。组件自动加载默认结构和主题，示例不导入样式文件。

<iframe src="/structure-only/index.html" title="通过 props 配置双主题" width="100%" height="720"></iframe>

源码位于 examples/structure-only，`pnpm docs:build` 自动生成该页面并检查默认入口包含必要样式。目录和地址保留以兼容已有链接。

## 列偏好

独立入口：apex-table-react/adapters/local-column-preferences。createLocalColumnPreferences 必须提供 namespace/userId/tenantId/tableId/schemaVersion，无多租户也明确 tenantId。

工厂不访问存储；load({columns,initialState}) 接收允许的原生 leaf columns，返回四个原生布局切片。通过 `tableRef.current.getAllLeafColumns()` 获取列，再将恢复结果传入 `state` 和各个 `onColumn…Change` 回调。适配器不覆盖回调。

save(state) 默认防抖 300ms，仅保存 columnOrder/columnVisibility/columnSizing/columnPinning。flush/cancel/clear/dispose 管理生命周期。load 后再订阅避免恢复写回，身份切换 dispose 取消旧待写任务。

版本变化默认回退，可显式 migrate；损坏、存储不可用、配额和迁移错误通过 onDiagnostic 反馈。丢弃删除/无权限列，宽度按当前 min/max 约束，恢复边界遵守锁定。没有跨标签同步，不保存业务数据、选择、查询或密度。

Preferences 示例演示读取、显式保存和清除列布局。打开列设置修改并确认后，点击“保存列布局”，刷新页面即可恢复；点击“清除并恢复默认”仅清理该示例的记录。恢复不自动写回。迁移和多身份隔离按上面的适配器接口在业务中按需接入。
