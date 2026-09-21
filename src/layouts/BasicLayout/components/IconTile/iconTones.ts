/** 菜单图标的语义色调 */
export type IconTone = 'blue' | 'green' | 'orange' | 'purple'

/** 路由 ID → 图标色调（未命中的路由回退蓝色） */
const ROUTE_ICON_TONES = {
  // 监控入口使用绿色，与运行正常的单机状态建立一致的视觉识别。
  'robot-monitor': 'green',
} as const

/** 按路由 ID 取图标色调 */
export function routeIconTone(routeId: string): IconTone {
  return (ROUTE_ICON_TONES as Record<string, IconTone>)[routeId] ?? 'blue'
}
