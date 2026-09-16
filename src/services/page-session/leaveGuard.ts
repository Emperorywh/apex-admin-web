/**
 * 统一离开协调器（T013，SPEC §9.1）：
 * 页签关闭（单关/批量）、页签刷新、主动退出、浏览器刷新/关闭与容量准入
 * 全部经由本模块的同一套保护检查与确认流程。
 *
 * 保护条件三来源（§9.1 缓存淘汰行 + 离开确认要求）：
 * - 草稿：页面会话 store 的显式登记（无稿初始值不构成保护）；
 * - 普通写入：会话任务层 running/queued（执行中）与 unknown（待确认）；
 * - 文件传输：active（在途）、unknown 与 cancelled 但已有字节发出（待确认）。
 *
 * 语义约束：
 * - 确认「停止等待」不能撤销后端执行：弹窗列明对象、动作、执行中/待确认
 *   状态；用户确认后才停止等待、清除任务记录并执行离开动作；
 * - 批量关闭先统一检查和确认，取消时不部分关闭（一次 dispatch 原子执行）；
 * - 无任何自动重发/重试；结果未知不伪装成功或已撤销（沿 T011 合同）。
 */

import { store } from '@/store/store'
import { PAGE_CACHE_MAX_ENTRIES, tabsClosed, tabRefreshed } from '@/store/slices/tabsSlice'
import { findDefinitionByPath } from '@/router/definitions'
import { resolveTabIdentity } from '@/router/tabIdentity'
import {
  dismissTransferTask,
  cancelTransferTask,
  dismissWriteTask,
  getSessionTasksSnapshot,
  stopWaitingForWrite,
} from '@/services/session-tasks'
import {
  clearTabSessionState,
  getPageSessionSnapshot,
} from '@/services/page-session/pageSessionStore'
import type {
  LeaveAction,
  LeaveConfirmRequest,
  TabProtection,
} from '@/services/page-session/pageSession.types'
import type { TransferTaskRecord, WriteTaskRecord } from '@/services/session-tasks'

/* -------------------------------------------------------------------------- */
/* 保护条件汇总                                                                */
/* -------------------------------------------------------------------------- */

/** 写入记录是否构成保护：执行中（含排队）或结果待确认 */
function isProtectiveWrite(record: WriteTaskRecord): boolean {
  return record.status === 'queued' || record.status === 'running' || record.status === 'unknown'
}

/** 传输记录是否构成保护：在途，或已发字节、业务结果待确认 */
function isProtectiveTransfer(record: TransferTaskRecord): boolean {
  if (record.status === 'active' || record.status === 'unknown') return true
  return record.status === 'cancelled' && record.resultUnknown
}

/**
 * 汇总给定页签的保护条件；tabKeys 允许包含 null 表示会话级任务
 * （tabKey=null 的写入/传输不隶属页签，仅主动退出需要纳入）。
 * 只返回存在保护条件的条目；调用方据此决定直接放行或弹窗确认。
 */
export function collectTabProtections(tabKeys: readonly (string | null)[]): TabProtection[] {
  const draftsByTab = getPageSessionSnapshot().drafts
  const tasks = getSessionTasksSnapshot()
  const protections: TabProtection[] = []
  const seen = new Set<string | null>()
  for (const tabKey of tabKeys) {
    if (seen.has(tabKey)) continue
    seen.add(tabKey)
    const drafts = tabKey === null ? [] : (draftsByTab[tabKey] ?? [])
    const writes = tasks.writes.filter((record) => record.tabKey === tabKey && isProtectiveWrite(record))
    const transfers = tasks.transfers.filter(
      (record) => record.tabKey === tabKey && isProtectiveTransfer(record),
    )
    if (drafts.length > 0 || writes.length > 0 || transfers.length > 0) {
      protections.push({ tabKey, drafts, writes, transfers })
    }
  }
  return protections
}

/** 当前全部受保护页签的 key 集合（不含会话级 null 条目）；容量准入与 LRU 豁免共用 */
export function collectProtectedTabKeys(): string[] {
  return collectTabProtections(
    store.getState().tabs.tabs.map((tab) => tab.key),
  )
    .map((protection) => protection.tabKey)
    .filter((key): key is string => key !== null)
}

/** 会话内是否存在任一保护条件（含会话级任务）：浏览器 beforeunload 守卫依据 */
export function hasAnySessionProtection(): boolean {
  const allKeys: (string | null)[] = [...store.getState().tabs.tabs.map((tab) => tab.key), null]
  return collectTabProtections(allKeys).length > 0
}

/* -------------------------------------------------------------------------- */
/* 确认请求通道：协调器发起 → LeaveGuardHost 渲染 → 用户裁决回填                 */
/* -------------------------------------------------------------------------- */

let confirmSequence = 0
let confirmQueue: readonly LeaveConfirmRequest[] = []
const confirmListeners = new Set<() => void>()
const pendingResolvers = new Map<number, (confirmed: boolean) => void>()

function notifyConfirmListeners(): void {
  for (const listener of confirmListeners) listener()
}

/** 订阅待确认离开请求队列（LeaveGuardHost 渲染弹窗用） */
export function subscribeLeaveConfirms(listener: () => void): () => void {
  confirmListeners.add(listener)
  return () => {
    confirmListeners.delete(listener)
  }
}

/** 读取待确认队列快照；同一时刻只应渲染第一条（队列由弹窗模态天然串行） */
export function getLeaveConfirmsSnapshot(): readonly LeaveConfirmRequest[] {
  return confirmQueue
}

/** LeaveGuardHost 回填用户裁决：true=确认离开并执行；false=留在当前页 */
export function resolveLeaveConfirm(requestId: number, confirmed: boolean): void {
  const resolve = pendingResolvers.get(requestId)
  if (resolve === undefined) return
  pendingResolvers.delete(requestId)
  confirmQueue = confirmQueue.filter((request) => request.id !== requestId)
  notifyConfirmListeners()
  resolve(confirmed)
}

/** 发起一条确认请求；Promise 在用户裁决后落定 */
function requestLeaveConfirm(action: LeaveAction, protections: readonly TabProtection[]): Promise<boolean> {
  return new Promise((resolve) => {
    confirmSequence += 1
    const request: LeaveConfirmRequest = { id: confirmSequence, action, protections }
    confirmQueue = [...confirmQueue, request]
    pendingResolvers.set(request.id, resolve)
    notifyConfirmListeners()
  })
}

/* -------------------------------------------------------------------------- */
/* 确认后的执行原语                                                            */
/* -------------------------------------------------------------------------- */

/**
 * 释放一组保护：执行中写入停止等待（转待确认后清除）、在途传输取消，
 * 随后清除全部相关任务记录与页面会话状态。只在用户确认离开后调用；
 * 「取消查询不报错」的规则不适用于此处的状态提示（§9.1）。
 */
function releaseProtections(protections: readonly TabProtection[]): void {
  for (const protection of protections) {
    for (const record of protection.writes) {
      if (record.status === 'queued' || record.status === 'running') {
        stopWaitingForWrite(record.id)
      }
      dismissWriteTask(record.id)
    }
    for (const record of protection.transfers) {
      if (record.status === 'active') cancelTransferTask(record.id)
      dismissTransferTask(record.id)
    }
    if (protection.tabKey !== null) clearTabSessionState(protection.tabKey)
  }
}

/* -------------------------------------------------------------------------- */
/* 对外离开入口                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 关闭页签（单关或批量）：先统一检查保护条件；无保护直接原子关闭，
 * 有保护弹窗确认——取消时一个页签都不关（批量原子性），确认后一次
 * dispatch 完成全部关闭并清除对应会话状态。
 */
export async function requestCloseTabs(tabKeys: readonly string[]): Promise<boolean> {
  const uniqueKeys = [...new Set(tabKeys)]
  if (uniqueKeys.length === 0) return true
  const protections = collectTabProtections(uniqueKeys)
  if (protections.length === 0) {
    executeTabClose(uniqueKeys)
    return true
  }
  const confirmed = await requestLeaveConfirm(
    uniqueKeys.length > 1 ? 'batch-close' : 'close',
    protections,
  )
  if (!confirmed) return false
  releaseProtections(protections)
  executeTabClose(uniqueKeys)
  return true
}

/** 页签刷新：与关闭同一套保护检查；确认后清草稿/轻量状态再重建实例 */
export async function requestRefreshTab(tabKey: string): Promise<boolean> {
  const protections = collectTabProtections([tabKey])
  if (protections.length === 0) {
    clearTabSessionState(tabKey)
    store.dispatch(tabRefreshed(tabKey))
    return true
  }
  const confirmed = await requestLeaveConfirm('refresh', protections)
  if (!confirmed) return false
  releaseProtections(protections)
  clearTabSessionState(tabKey)
  store.dispatch(tabRefreshed(tabKey))
  return true
}

/**
 * 主动退出保护检查（向 T017 暴露的入口）：对全部页签与会话级任务
 * 完成草稿/写入/传输确认；返回 true 后由调用方执行登出请求并触发
 * sessionExpired（页签、任务与页面会话由各层纪元复位统一清除）。
 */
export async function confirmSessionExit(): Promise<boolean> {
  const allKeys: (string | null)[] = [
    ...store.getState().tabs.tabs.map((tab) => tab.key),
    null,
  ]
  const protections = collectTabProtections(allKeys)
  if (protections.length === 0) return true
  const confirmed = await requestLeaveConfirm('logout', protections)
  if (!confirmed) return false
  releaseProtections(protections)
  return true
}

/** 关闭页签的原子执行：清会话状态 + 单次批量 dispatch */
function executeTabClose(tabKeys: readonly string[]): void {
  for (const key of tabKeys) clearTabSessionState(key)
  store.dispatch(tabsClosed([...tabKeys]))
}

/* -------------------------------------------------------------------------- */
/* 容量准入（§9.1：全部受保护且容量不足时，创建/替换页面前提示）                  */
/* -------------------------------------------------------------------------- */

/**
 * 判定一次导航是否需要容量准入确认：目标会新建页签、缓存已满、
 * 且待淘汰候选全部受保护。该判定必须在导航提交前同步完成
 * （SessionHost 的 useBlocker 回调内调用），确保「不先导航后丢状态」。
 */
export function needsCapacityAdmission(nextPath: string, nextSearch: string): boolean {
  const definition = findDefinitionByPath(nextPath)
  if (!definition || !definition.loadPage) return false
  if (definition.meta.public === true || definition.meta.hideInTabs === true) return false
  const identity = resolveTabIdentity(definition.meta, {
    pathname: nextPath,
    search: nextSearch,
    hash: '',
    key: '',
  })
  // 目标不生成页签或已存在同身份页签（聚焦复用）都不消耗新容量
  if (identity === null) return false
  const { tabs } = store.getState().tabs
  if (tabs.some((tab) => tab.key === identity.tabKey)) return false

  const protectedKeys = new Set(collectProtectedTabKeys())
  const cachedNonAffix = tabs.filter((tab) => tab.cached && !tab.affix && tab.key !== identity.tabKey)
  const needed = Math.max(0, cachedNonAffix.length - (PAGE_CACHE_MAX_ENTRIES - 1))
  if (needed <= 0) return false
  const cleanAvailable = cachedNonAffix.filter((tab) => !protectedKeys.has(tab.key)).length
  return cleanAvailable < needed
}

/* -------------------------------------------------------------------------- */
/* 浏览器刷新/关闭守卫（§9.1：浏览器原生离开提示能力范围内保护）                  */
/* -------------------------------------------------------------------------- */

let beforeUnloadInstalled = false

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  // Chrome 要求 preventDefault 与 returnValue 同时设置才弹原生提示
  event.preventDefault()
  event.returnValue = ''
}

/** 按当前保护状态挂载/卸载 beforeunload 守卫；由 LeaveGuardHost 在快照变化时同步 */
export function syncBeforeUnloadGuard(): void {
  const needed = hasAnySessionProtection()
  if (needed && !beforeUnloadInstalled) {
    window.addEventListener('beforeunload', handleBeforeUnload)
    beforeUnloadInstalled = true
  } else if (!needed && beforeUnloadInstalled) {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    beforeUnloadInstalled = false
  }
}

/**
 * 会话复位时丢弃尚未裁决的确认请求（按取消处理）并复位守卫：
 * 登录/登出/切账号/认证失效后，旧会话的离开确认不得流入新会话。
 */
export function resetLeaveGuard(): void {
  // 先取出全部待裁决 resolver 再清空队列，逐个按取消落定
  const resolvers = [...pendingResolvers.values()]
  pendingResolvers.clear()
  confirmQueue = []
  notifyConfirmListeners()
  for (const resolve of resolvers) resolve(false)
  if (beforeUnloadInstalled) {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    beforeUnloadInstalled = false
  }
}
