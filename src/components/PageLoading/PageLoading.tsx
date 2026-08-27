/**
 * 页面级加载态：路由 Suspense fallback 与按模块加载 i18n 的统一等待界面。
 */

import { Flex, Spin } from 'antd'

export default function PageLoading() {
  return (
    <Flex align="center" justify="center" style={{ minHeight: 220 }}>
      <Spin size="large" />
    </Flex>
  )
}
