/**
 * 车辆详情路由参数契约（P39）：/vehicle-info 的实体定位参数单一真相。
 *
 * 参数形状核对结论（TASKS P39「核对旧调用点参数」；同构 P38 orderDetailNavigation）：
 * - 旧源码（C:\code\dd）中没有任何导航到 /vehicle-info 的调用点（grep 全仓仅
 *   .umirc.ts 路由声明）——旧车辆详情与旧任务详情同为直访 URL 形态；旧页面用
 *   `location.search.substring(1)` 取整段 query 作为 vehicleKey，即历史链接形态
 *   为裸值 `/vehicle-info?<vehicleKey>`（无参数名）。
 * - 新导航统一使用命名参数 `?vehicleKey=<车辆唯一标识>`：实体页签隔离依赖
 *   「pathname + 规范化 search」的页签 key，参数名稳定才能保证不同车辆各自
 *   独立页签/独立请求 scope（contracts 第 4 节实体页签）。
 * - 历史裸值链接向下兼容：query 解析时无命名参数则把整段原始串视为 vehicleKey
 *   （A22 历史链接可用），仅作为兼容回退，不用于新导航。
 */

/** /vehicle-info 的实体定位参数名（构造与解析共用的单一真相） */
export const VEHICLE_INFO_QUERY_KEY = 'vehicleKey'

/**
 * 构造车辆详情路由完整路径：车辆唯一标识为业务标识字符串，
 * 进入 query 前按 URL 规则转义（车辆 key 含「/」等字符时保持单段路径语义）。
 */
export function buildVehicleInfoPath(vehicleKey: string): string {
  return `/vehicle-info?${VEHICLE_INFO_QUERY_KEY}=${encodeURIComponent(vehicleKey)}`
}

/**
 * 解析 /vehicle-info 的定位参数。
 * 返回 null 表示缺参数（页面据此呈现明确反馈，不发起空参请求）：
 * 1. 优先取命名参数 vehicleKey（新导航标准形态）；
 * 2. 兼容旧裸值形态两种变体：原始 `?KEY`，以及经页签 search 规范化
 *    （URLSearchParams 重序列化，BasicLayout tabKey 机制）后写回地址栏的
 *    `?KEY=`（无值参数）——两者都把整段视为 vehicleKey；
 * 3. 命名参数存在但值为空、或 search 为空/含其他参数 → 缺参数。
 */
export function parseVehicleInfoSearch(search: string): { vehicleKey: string } | null {
  const params = new URLSearchParams(search)
  const named = params.get(VEHICLE_INFO_QUERY_KEY)
  if (named !== null) {
    return named.trim() !== '' ? { vehicleKey: named } : null
  }
  // 裸值变体一：原始 search 去掉「?」后不含「=」（历史链接原样形态）
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (raw !== '' && !raw.includes('=')) {
    return { vehicleKey: decodeURIComponent(raw) }
  }
  // 裸值变体二：规范化后的「?KEY=」（单条无值参数，key 即 vehicleKey 的解码形态）
  const entries = [...params.entries()]
  if (entries.length === 1 && entries[0][1] === '' && entries[0][0] !== VEHICLE_INFO_QUERY_KEY) {
    return { vehicleKey: entries[0][0] }
  }
  return null
}
