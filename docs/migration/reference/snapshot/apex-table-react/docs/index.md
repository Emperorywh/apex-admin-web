---
title: ApexTableReact
nav:
  title: 首页
  order: 0
---

# 传入 props，即可使用完整表格

ApexTableReact 为商品、订单和配置列表提供紧凑、可定制的 React 表格。保留 TanStack Table v9 的列、实例、状态和 updater，增加业务列表需要的布局与交互。

[组件演示](/components/apex-table) · [快速开始](/guide) · [API](/api)

业务通过 props 传入列、数据及功能配置，负责请求、缓存、身份和权限；组件内部封装 TanStack 的实例与状态，并管理表头、虚拟表体、控件、布局、滚动和焦点。

组件自动加载结构样式和默认主题，无需额外导入 CSS。通过 style props 配置品牌变量，通过插槽替换控件。

当前正式版本为 `apex-table-react@0.1.0`，通过 npm 官方源的 `latest` 标签发布。
