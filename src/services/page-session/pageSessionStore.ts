/**
 * 页面会话 store（T013）：内存草稿登记 + 轻量页签状态的唯一容器（SPEC §9.1）。
 *
 * - 独立于可淘汰的页签实例（Activity 缓存）：LRU 淘汰只销毁页面实例，
 *   干净页的轻量状态保留在此，重建时由页面读取恢复并核验对象；
 * - 草稿登记是显式动作：只有页面在事件处理器中 setTabDraft 才构成脏，
 *   无稿初始值不会误标为脏；保存成功/重置确认后页面调用 clearTabDraft；
 * - 关闭/刷新页签清其全部状态（clearTabSessionState）；账号切换/认证失效
 *   由宿主组件订阅 auth.epoch 调 resetPageSession 全部清除；
 * - 不写 localStorage：整页刷新即回默认（§9.1 表格偏好与轻量状态同口径）；
 * - 快照不可变，保证 useSyncExternalStore 引用一致（沿 T011 store 模式）。
 */

import type { DraftRecord, PageSessionSnapshot } from '@/services/page-session/pageSession.types'

interface PageSessionState {
  drafts: Record<string, Record<string, DraftRecord>>
  lightStates: Record<string, Record<string, unknown>>
}

const state: PageSessionState = {
  drafts: {},
  lightStates: {},
}

/** 当前快照缓存：仅在内容变化时重建，保证订阅方拿到的引用稳定 */
let snapshot: PageSessionSnapshot = { drafts: {}, lightStates: {} }

type PageSessionListener = () => void

const listeners = new Set<PageSessionListener>()

/** 订阅页面会话变化；返回取消订阅函数（Hook 与离开协调器共用） */
export function subscribePageSession(listener: PageSessionListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 读取当前快照；引用在无变化期间恒定（useSyncExternalStore 约束） */
export function getPageSessionSnapshot(): PageSessionSnapshot {
  return snapshot
}

/** 内容变化后同步重建快照并通知订阅方 */
function commit(): void {
  const drafts: Record<string, readonly DraftRecord[]> = {}
  for (const [tabKey, records] of Object.entries(state.drafts)) {
    const list = Object.values(records)
    if (list.length > 0) drafts[tabKey] = list
  }
  snapshot = { drafts, lightStates: { ...state.lightStates } }
  for (const listener of listeners) listener()
}

/* -------------------------------------------------------------------------- */
/* 草稿登记                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 登记/更新一份脏草稿（同页同 draftKey 幂等覆盖）。
 * 必须在用户实际修改数据的事件处理器中调用，不要在初始化 effect 里调用，
 * 否则无稿初始值会被误标为脏（§9.1）。
 */
export function setTabDraft(tabKey: string, draftKey: string, label: string): void {
  const records = state.drafts[tabKey] ?? {}
  const existing = records[draftKey]
  records[draftKey] = {
    draftKey,
    label,
    dirtyAt: existing?.dirtyAt ?? Date.now(),
  }
  state.drafts[tabKey] = records
  commit()
}

/** 解除一份草稿保护：保存成功或用户确认重置后由页面调用 */
export function clearTabDraft(tabKey: string, draftKey: string): void {
  const records = state.drafts[tabKey]
  if (records === undefined || records[draftKey] === undefined) return
  delete records[draftKey]
  if (Object.keys(records).length === 0) delete state.drafts[tabKey]
  commit()
}

/** 读取某页签的全部草稿登记（快照内查找，供协调器与调试） */
export function getTabDrafts(tabKey: string): readonly DraftRecord[] {
  return snapshot.drafts[tabKey] ?? []
}

/* -------------------------------------------------------------------------- */
/* 轻量页签状态                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 保存一份轻量页签状态（查询条件/分页/展开 ID/选中 ID 等可序列化数据）。
 * 存入前做一次 JSON 往返：函数、循环引用等不可序列化内容被静默丢弃，
 * 保证「独立于可淘汰实例的会话状态」这一约定不被大批对象破坏；
 * 不保存大批查询结果规避缓存上限（§9.1）。
 */
export function setLightState(tabKey: string, stateKey: string, value: unknown): void {
  let safeValue: unknown
  try {
    safeValue = JSON.parse(JSON.stringify(value ?? null))
  } catch {
    // 不可序列化（循环引用等）：拒绝保存并保留旧值，不中断页面事件
    return
  }
  const records = state.lightStates[tabKey] ?? {}
  records[stateKey] = safeValue
  state.lightStates[tabKey] = records
  commit()
}

/** 读取一份轻量状态；未保存过返回 undefined，页面据默认值恢复 */
export function getLightState<T = unknown>(tabKey: string, stateKey: string): T | undefined {
  return state.lightStates[tabKey]?.[stateKey] as T | undefined
}

/* -------------------------------------------------------------------------- */
/* 生命周期清理                                                                */
/* -------------------------------------------------------------------------- */

/** 清除页签的草稿与轻量状态：关闭/刷新页签确认后由协调器调用 */
export function clearTabSessionState(tabKey: string): void {
  let changed = false
  if (state.drafts[tabKey] !== undefined) {
    delete state.drafts[tabKey]
    changed = true
  }
  if (state.lightStates[tabKey] !== undefined) {
    delete state.lightStates[tabKey]
    changed = true
  }
  if (changed) commit()
}

/** 会话复位：登录/登出/切账号/认证失效时清空全部页面会话状态（§9.1） */
export function resetPageSession(): void {
  state.drafts = {}
  state.lightStates = {}
  commit()
}
