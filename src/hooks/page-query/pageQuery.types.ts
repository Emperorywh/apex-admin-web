/**
 * 页面统一查询类型与轮询策略（T010 交付）。
 *
 * 规格依据：SPEC §6.3（多查询竞争用 AbortSignal 与过期响应防护）、
 * §9.2（应用页签可见且 document 可见才轮询；恢复后立即请求；
 * 同一查询不并发堆叠；其他页面不因名字含“状态”擅自增加轮询）。
 */

import type { ApiError } from '@/services/request/request.types'

/** 轮询策略：两种模式都以“上次请求落定”为基准重排，天然避免同一查询并发堆叠。 */
export type PagePollingPolicy =
  | {
      /** 固定间隔语义（如任务记录旧 1 秒轮询）：上次请求结束 intervalMs 后发起下一次 */
      mode: 'interval'
      intervalMs: number
    }
  | {
      /** 完成后间隔语义（实时看板/服务器资源）：每次请求结束 gapMs 后再发起下一次 */
      mode: 'after-completion'
      gapMs: number
    }

/**
 * SPEC §9.2 的源调用点轮询频率，唯一取值来源。
 * 新页面接入时先对照源实现确认确有轮询，再引用此处常量；不得自造间隔。
 */
export const PAGE_POLLING = {
  /** 任务记录和状态统计：保留旧 1 秒轮询 */
  taskRecords: { mode: 'interval', intervalMs: 1_000 },
  /** 实时看板：每次请求结束 5 秒后下一次 */
  realtimeDashboard: { mode: 'after-completion', gapMs: 5_000 },
  /** 服务器资源：每次请求结束 2 秒后下一次 */
  serverResources: { mode: 'after-completion', gapMs: 2_000 },
} as const satisfies Record<string, PagePollingPolicy>

/** 轮询策略到“落定后等待毫秒数”的统一换算 */
export function pollingGapMs(policy: PagePollingPolicy): number {
  return policy.mode === 'interval' ? policy.intervalMs : policy.gapMs
}

/**
 * 查询执行器：由 service 层提供，必须把 context.signal 透传给请求层，
 * 以便条件切换、隐藏与卸载时取消在途请求（SPEC §6.3）。
 */
export type PageQueryFetcher<TParams, TData> = (
  params: TParams,
  context: { signal: AbortSignal },
) => Promise<TData>

export interface UsePageQueryOptions<TParams, TData> {
  /** 请求执行器；请保持稳定语义（内部经 ref 透传，不必 useCallback） */
  fetcher: PageQueryFetcher<TParams, TData>
  /**
   * 查询条件；变化即视为新条件——旧条件在途请求被取消，其迟到的响应一律不落地。
   * 条件必须是可 JSON 序列化的纯数据（本仓库分页/筛选条件均满足），
   * 内部以 JSON 序列化结果判定“条件是否变化”。
   */
  params: TParams
  /** 轮询策略；缺省不轮询（§9.2：其他页面按当前有效实现，不擅自增加轮询） */
  polling?: PagePollingPolicy
  /**
   * 是否允许发请求（如非法参数、无权对象不发业务请求）。
   * 置 false 不清空已有数据，仅停止发起与轮询。
   */
  enabled?: boolean
}

export interface UsePageQueryResult<TData> {
  /** 最近一次成功数据；尚无成功数据时为 null（与“加载失败”“空数据”区分） */
  data: TData | null
  /** 首次加载：尚无任何成功数据且有待完成请求 */
  loading: boolean
  /** 后台刷新/轮询进行中：已有数据，等待新数据落地 */
  refreshing: boolean
  /** 最近一次已落定的失败；取消不算失败。数据过期期间错误保持可见（降级语义归页面） */
  error: ApiError | null
  /** 连续失败次数，成功后清零；供页面降级展示，本层不弹 toast（去重归错误事件层） */
  failureCount: number
  /** 手动重试/刷新：中止在途请求并立即重新发起 */
  reload: () => void
}
