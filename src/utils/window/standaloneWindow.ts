/**
 * 独立窗口工具（T00.6，规格 7 / D08）。
 *
 * 完整详情/监控类页面默认进入工作区页签，另提供独立窗口或全屏入口；
 * 两种模式共用业务实现与鉴权（P38/P39/P40 消费本工具打开各自的布局外路由）。
 *
 * 机制说明：
 * - 独立窗口 = 浏览器弹窗直接打开目标路由（order-info / vehicle-info /
 *   server-resource-monitor 等布局外页面）。这些路由在路由树中受认证 + 权限
 *   守卫保护，新窗口加载时按持久化会话走同一套守卫，不存在免鉴权通道
 * - 会话/语言/主题来自 localStorage 持久化，新窗口自动一致；
 *   退出登录经 storage 事件同步到所有窗口（T00.3 authBridge）
 * - 窗口按「路由 + 实体参数」命名：同一实体重复打开复用同一窗口，
 *   不同实体各得独立窗口，与实体页签隔离语义一致
 */

/** 独立窗口默认尺寸：不低于规格最低视口 1366×768 的可用比例 */
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800

/** 弹窗特性串；popup 声明确保各浏览器以独立小窗打开而非新标签。
    不能加 noopener：noopener 下 window.open 恒返回 null，将无法检测弹窗拦截；
    改为打开成功后切断 opener 引用，保持等效的窗口隔离 */
function buildFeatures(width: number, height: number): string {
  const left = Math.max(0, Math.floor((window.screen.availWidth - width) / 2))
  const top = Math.max(0, Math.floor((window.screen.availHeight - height) / 2))
  return [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'popup=yes',
  ].join(',')
}

/**
 * 打开独立窗口。
 * @param path 站内绝对路径（如 /order-info）；仅站内路径，外链一律拒绝
 * @param params 实体定位参数（如 { id: '123' }）；与实体页签相同的规范化语义
 * @param options 窗口尺寸覆盖
 * @returns 是否成功打开（浏览器拦截弹窗时返回 false，调用方应给出可读提示）
 */
export function openStandaloneWindow(
  path: string,
  params: Record<string, string> = {},
  options?: { width?: number; height?: number },
): boolean {
  // 安全面：只允许站内绝对路径，禁止外链与 javascript: 伪协议
  if (!path.startsWith('/')) return false
  const search = new URLSearchParams(params)
  search.sort()
  const query = search.toString()
  const url = `${path}${query ? `?${query}` : ''}`
  // 窗口名 = 路由 + 排序后的参数：同实体复用窗口，异实体相互独立
  const windowName = `apex-standalone:${path}:${query}`
  const opened = window.open(
    url,
    windowName,
    buildFeatures(options?.width ?? DEFAULT_WIDTH, options?.height ?? DEFAULT_HEIGHT),
  )
  if (opened === null) return false
  // 切断 opener 引用（等效 noopener 的窗口隔离），返回 true 表示成功开窗
  opened.opener = null
  return true
}
