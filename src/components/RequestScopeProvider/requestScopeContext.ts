/**
 * 页面请求作用域上下文（规格 §7.4-6）：
 * 独立于组件文件维护，供 RequestScopeProvider 写入、usePageRequest/useRequestScopeId 读取。
 * null 表示未处于任何页面作用域。
 */
import { createContext } from 'react'

export const RequestScopeContext = createContext<string | null>(null)
