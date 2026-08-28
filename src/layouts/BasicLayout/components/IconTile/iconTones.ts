/** 图标瓷片四色调（与视觉基准渐变一致） */
export type IconTone = 'blue' | 'green' | 'orange' | 'purple'

/** 路由 ID → 图标色调（未命中的路由回退蓝色） */
const ROUTE_ICON_TONES = {
  'system-user': 'green',
  'system-role': 'orange',
  'system-menu': 'purple',
  profile: 'blue',
} as const

/** 按路由 ID 取图标色调 */
export function routeIconTone(routeId: string): IconTone {
  return (ROUTE_ICON_TONES as Record<string, IconTone>)[routeId] ?? 'blue'
}
