/** 菜单图标的语义色调 */
export type IconTone = 'blue' | 'green' | 'orange' | 'purple'

/** 路由 ID → 图标色调（未命中的路由回退蓝色） */
const ROUTE_ICON_TONES = {
  dashboard: 'blue',
} as const

/** 按路由 ID 取图标色调 */
export function routeIconTone(routeId: string): IconTone {
  return (ROUTE_ICON_TONES as Record<string, IconTone>)[routeId] ?? 'blue'
}
