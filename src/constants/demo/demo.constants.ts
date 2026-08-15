/**
 * 多级菜单演示业务域常量（规格 §14.2）：多级菜单演示页面的 i18n 命名空间。
 * 与可整体剔除的演示模式运行时 src/demo/ 无关——多级菜单演示是模板正式页面
 * （三级导航、面包屑链与页签缓存验证载体），页面与路由定义一律引用本文件。
 */

/**
 * 多级菜单演示页面 i18n 命名空间（规格 §12）：
 * 三个层级叶子路由的 meta.i18nNamespaces 均声明该值，en-US 资源文件为
 * src/i18n/locales/en-US/demoNested.ts（文件名即命名空间）。
 */
export const DEMO_NESTED_I18N_NAMESPACE = 'demoNested'
