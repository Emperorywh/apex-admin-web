/**
 * Dashboard 业务域常量（规格 §14.1/§14.3）：图表日期格式。
 * dashboard service、图表组件与 demo adapter 一律引用本文件；
 * 概览接口路径由 dashboard service 在调用点内联（规格 §14.3 v1.8）。
 */

/**
 * 图表序列日期格式（规格 §14.1）。
 * loginTrend/userGrowth 的 date 使用 YYYY-MM-DD，序列按日期升序。
 */
export const DASHBOARD_DATE_FORMAT = 'YYYY-MM-DD'

/**
 * Dashboard 页面 i18n 命名空间（规格 §12）：
 * 路由 meta.i18nNamespaces 声明该值，en-US 资源文件为
 * src/i18n/locales/en-US/dashboard.ts（文件名即命名空间）。
 */
export const DASHBOARD_I18N_NAMESPACE = 'dashboard'
