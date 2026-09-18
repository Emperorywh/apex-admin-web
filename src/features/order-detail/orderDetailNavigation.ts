/**
 * 任务详情路由参数契约（P38）：/order-info 的实体定位参数单一真相。
 *
 * 参数形状核对结论（TASKS P38「核对旧调用点参数」+ 规格 3.3）：
 * - 旧源码（C:\code\dd）中没有任何导航到 /order-info 的调用点——旧详情均为
 *   列表弹窗快速预览，/order-info 是直访 URL 形态；旧页面用
 *   `location.search.substring(1)` 取整段 query 作为 orderTaskKey，
 *   即历史链接形态为裸值 `/order-info?<orderTaskKey>`（无参数名）。
 * - 新导航统一使用命名参数 `?orderKey=<任务编号>`：实体页签隔离依赖
 *   「pathname + 规范化 search」的页签 key，参数名稳定才能保证
 *   不同任务各自独立页签/独立请求 scope（contracts 第 4 节实体页签）。
 * - 历史裸值链接向下兼容：query 解析时无命名参数则把整段原始串视为
 *   orderKey（A22 历史链接可用），仅作为兼容回退，不用于新导航。
 */

/** /order-info 的实体定位参数名（构造与解析共用的单一真相） */
export const ORDER_INFO_QUERY_KEY = 'orderKey'

/** 任务详情路由完整路径（来自路由定义树推导表，禁止手写副本） */
export function buildOrderInfoPath(orderKey: string): string {
  // 任务编号为业务标识字符串：进入 query 前按 URL 规则转义
  return `/order-info?${ORDER_INFO_QUERY_KEY}=${encodeURIComponent(orderKey)}`
}

/**
 * 解析 /order-info 的定位参数。
 * 返回 null 表示缺参数（页面据此呈现明确反馈，不发起空参请求）：
 * 1. 优先取命名参数 orderKey（新导航标准形态）；
 * 2. 兼容旧裸值形态两种变体：原始 `?KEY`，以及经页签 search 规范化
 *    （URLSearchParams 重序列化，BasicLayout tabKey 机制）后写回地址栏的
 *    `?KEY=`（无值参数）——两者都把整段视为 orderKey；
 * 3. 命名参数存在但值为空、或 search 为空/含其他参数 → 缺参数。
 */
export function parseOrderInfoSearch(search: string): { orderKey: string } | null {
  const params = new URLSearchParams(search)
  const named = params.get(ORDER_INFO_QUERY_KEY)
  if (named !== null) {
    return named.trim() !== '' ? { orderKey: named } : null
  }
  // 裸值变体一：原始 search 去掉「?」后不含「=」（历史链接原样形态）
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (raw !== '' && !raw.includes('=')) {
    return { orderKey: decodeURIComponent(raw) }
  }
  // 裸值变体二：规范化后的「?KEY=」（单条无值参数，key 即 orderKey 的解码形态）
  const entries = [...params.entries()]
  if (entries.length === 1 && entries[0][1] === '' && entries[0][0] !== ORDER_INFO_QUERY_KEY) {
    return { orderKey: entries[0][0] }
  }
  return null
}
