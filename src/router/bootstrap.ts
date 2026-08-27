/**
 * 路由启动引导：首屏渲染前确保基础命名空间就绪，
 * 避免登录页与外壳出现文案闪空（zh-CN 为同步空资源，en-US 需一次动态导入）。
 */

import i18next, { BASE_NAMESPACES, normalizeLanguage, preloadNamespaces } from '@/i18n/i18n'

export async function bootstrapRouter(): Promise<void> {
  await preloadNamespaces(normalizeLanguage(i18next.language), BASE_NAMESPACES)
}
