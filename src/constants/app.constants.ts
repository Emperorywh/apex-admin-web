/**
 * 应用级容量与时间边界常量（规格 §3.6 所有权表）。
 * 本文件是这些值的唯一所有者，其他模块一律从此处导入，禁止重复字面量。
 */

/**
 * 页面缓存（Activity 实例）最大容量，单位：个（规格 §9.1）。
 * 只统计非 affix 的普通缓存实例；affix 页签（默认仅 Dashboard）不计入，
 * 当前激活页与 affix 页永不参与 LRU 淘汰。
 */
export const PAGE_CACHE_MAX_ENTRIES = 10

/**
 * 全局进度条收起延迟，单位：毫秒（规格 §7.4）。
 * loadingCount 归零后按该延迟收起进度条，避免短促请求导致进度条闪烁。
 */
export const GLOBAL_PROGRESS_HIDE_DELAY_MS = 200

/**
 * 权限变更提示冷却窗口，单位：毫秒（规格 §5.4）。
 * 权限变更（AUTH_PERMISSION_CHANGED）刷新 profile 后，
 * 相同 permissionVersion 在该窗口内不重复弹出提示。
 */
export const PERMISSION_CHANGE_TIP_COOLDOWN_MS = 30_000

/**
 * 窄视口断点 media query（规格 §11.1：视口 <768px）。
 * 触发侧边菜单改 Drawer、顶部布局折叠为菜单按钮、Header 次要操作收入更多菜单；
 * 取 767.98px 与 antd Grid 断点口径一致，避免亚像素视口双向命中。
 * 布局响应式全部由该常量驱动的 matchMedia 判定，CSS 不另行维护第二份断点。
 */
export const LAYOUT_MOBILE_MEDIA_QUERY = '(max-width: 767.98px)'
