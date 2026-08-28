/** 图标瓷片四色调（与视觉基准渐变一致） */
export type IconTone = 'blue' | 'green' | 'orange' | 'purple'

/** 路由 ID → 图标色调（未命中的路由回退蓝色） */
const ROUTE_ICON_TONES = {
  'over-look': 'green',
  'order-record': 'blue',
  'dispatch-hub': 'purple',
  'analyze-visual-record-playback': 'orange',
  'analyze-visual-dashboard-realtime': 'blue',
  'analyze-visual-dashboard-task': 'green',
  'analyze-visual-dashboard-fault': 'orange',
  'analyze-visual-vehicle-status': 'purple',
  'analyze-visual-server-resource': 'blue',
  profile: 'blue',
} as const

/** 按路由 ID 取图标色调 */
export function routeIconTone(routeId: string): IconTone {
  return (ROUTE_ICON_TONES as Record<string, IconTone>)[routeId] ?? 'blue'
}
