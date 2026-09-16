/**
 * 统一失效编排器（T015；SPEC §6.2、§8.2、§9.1、A02/A03/A09）。
 *
 * 三条编排链，全部接入既有清理点、不自建第二套状态：
 *
 * 1. 认证失效（1000000 / 会话不可信）：身份层事件桥清 token/存储/身份并推进
 *    纪元（T005）；本编排器在纪元变化时同步中止全部可取消活动——写入停等
 *    （转待确认）、传输取消（已发字节转待确认）——随后 React 宿主
 *    （SessionTasksHost/LeaveGuardHost/tabsSlice）按纪元清空任务记录、草稿、
 *    页签缓存并跳登录。迟到回执凭纪元隔离，重登后不自动重发。
 *
 * 2. 软件授权暂停/恢复（1001000）：挂起标记置位时暂停受保护活动（中止可取消
 *    等待与传输，记录保留为待确认；草稿、页签会话与页签缓存全部保留——身份
 *    仍有效，不推进纪元），路由层（SessionHost + 守卫）转入授权页；激活成功后
 *    由 T018 调用 resumeAfterSoftwareAuthorizationActivated 重查身份与权限，
 *    通过后清除挂起标记并收敛撤权，仍有权草稿与入口自动恢复。
 *
 * 3. 403 权限撤销（SPEC §8.2）：接口 403 不当作登录失效——单飞行重查权限
 *    快照（detail），核验期间 isPermissionReconcileInProgress 供动作层阻止
 *    重发；新快照撤销页面权限时按 §9.1 立即关闭并清除该页（无确认框、中止
 *    任务、清草稿与选择、提示权限已变更），仅撤销按钮权限时保留页面与草稿，
 *    动作入口由消费方按新快照隐藏/禁用。
 */

import i18next from 'i18next'
import { store } from '@/store/store'
import { softwareAuthorizationResumed } from '@/store/slices/authSlice'
import { tabsClosed } from '@/store/slices/tabsSlice'
import { reverifyIdentity, type IdentityReverifyOutcome } from '@/services/auth/auth.service'
import { hasMenuCode } from '@/services/auth/permission.model'
import { findRouteMeta } from '@/router/projections'
import { subscribeLegacyEvents } from '@/services/request/legacy/legacyRequest'
import {
  cancelTransferTask,
  dismissTransferTask,
  dismissWriteTask,
  getSessionTasksSnapshot,
  stopWaitingForWrite,
} from '@/services/session-tasks'
import { clearTabSessionState } from '@/services/page-session/pageSessionStore'
import { uiFeedback } from '@/services/feedback/uiFeedback'
import type { IdentitySnapshot } from '@/types/auth/auth.types'

/* -------------------------------------------------------------------------- */
/* 可取消活动中止（纪元推进 / 授权暂停共用原语）                                    */
/* -------------------------------------------------------------------------- */

/**
 * 中止当前全部可取消活动：执行中/排队写入停等（后端执行不可撤销，无回执转
 * 待确认）、在途传输取消（已发字节的业务结果转待确认）。记录是否保留由调用
 * 场景决定——认证失效后由纪元复位清空，授权暂停后保留供恢复后核查。
 */
export function abortCancellableSessionActivities(): void {
  const tasks = getSessionTasksSnapshot()
  for (const record of tasks.writes) {
    if (record.status === 'queued' || record.status === 'running') {
      stopWaitingForWrite(record.id)
    }
  }
  for (const record of tasks.transfers) {
    if (record.status === 'active') {
      cancelTransferTask(record.id)
    }
  }
}

/* -------------------------------------------------------------------------- */
/* 页面/按钮撤权收敛（SPEC §8.2 × §9.1 撤权行）                                   */
/* -------------------------------------------------------------------------- */

interface RevokedPage {
  tabKey: string
  title: string
}

/**
 * 按当前身份快照收集已被撤销页面权限的页签：路由声明 menuCode 且新快照
 * （祖先填充后）不再持有该码。仅撤销按钮权限不影响任何页签——消费方按
 * hasButtonCode 隐藏/禁用动作，页面与草稿保留。
 */
function collectRevokedPages(identity: IdentitySnapshot): RevokedPage[] {
  const revoked: RevokedPage[] = []
  for (const tab of store.getState().tabs.tabs) {
    const meta = findRouteMeta(tab.routeId)
    if (meta === undefined || meta.menuCode === undefined) continue
    if (!hasMenuCode(identity, meta.menuCode)) {
      revoked.push({ tabKey: tab.key, title: meta.title })
    }
  }
  return revoked
}

/**
 * 执行页面撤权清理（§9.1 撤权行）：不以确认框阻止撤权——被撤页签的执行中
 * 写入停等并清除记录（不自动重发，结果可能未知）、在途传输取消并清除记录、
 * 草稿与选择随页面会话清除，最后单次 dispatch 原子关闭全部被撤页签（其他
 * 有权页不受影响）。返回被撤页签数；0 表示无页面撤权（可能仅有按钮撤权）。
 */
function releaseRevokedPages(revoked: readonly RevokedPage[]): number {
  if (revoked.length === 0) return 0
  const keySet = new Set(revoked.map((page) => page.tabKey))
  const tasks = getSessionTasksSnapshot()
  for (const record of tasks.writes) {
    if (record.tabKey === null || !keySet.has(record.tabKey)) continue
    // 先停等（执行中转待确认）再清除记录：页面已不存在，无处展示待确认
    if (record.status === 'queued' || record.status === 'running') {
      stopWaitingForWrite(record.id)
    }
    dismissWriteTask(record.id)
  }
  for (const record of tasks.transfers) {
    if (record.tabKey === null || !keySet.has(record.tabKey)) continue
    if (record.status === 'active') cancelTransferTask(record.id)
    dismissTransferTask(record.id)
  }
  for (const key of keySet) clearTabSessionState(key)
  store.dispatch(tabsClosed([...keySet]))
  // 撤权提示（§9.1「提示权限已变更」）：列明被撤页面，说明未知结果与不重发
  uiFeedback.notification.warning({
    key: 'permission-revoked',
    message: i18next.t('权限已变更', { ns: 'common' }),
    description: i18next.t(
      '您的页面访问权限已被调整：{{titles}} 已关闭。进行中的指令结果可能未知，系统不会自动重发。',
      { ns: 'common', titles: revoked.map((page) => page.title).join('、') },
    ),
  })
  return keySet.size
}

/**
 * 撤权收敛入口（真实 API）：按 store 当前身份快照收集并清理被撤页面。
 * 403 重查链路与授权恢复链路在拿到新快照后都经此收敛；验证探针亦可直接
 * 调用（配合注入快照构造撤权场景，注入动作本身不走生产路径）。
 */
export function reconcileRevokedPagesNow(): number {
  const identity = store.getState().auth.identity
  if (identity === null) return 0
  return releaseRevokedPages(collectRevokedPages(identity))
}

/* -------------------------------------------------------------------------- */
/* 403 权限快照重查（单飞行；并发失效只处理一次）                                   */
/* -------------------------------------------------------------------------- */

let reconcileInFlight = false

/** 权限快照重查是否进行中：核验期间动作层据此阻止被拒动作重发（§8.2） */
export function isPermissionReconcileInProgress(): boolean {
  return reconcileInFlight
}

/**
 * 403 后的权限快照重查：detail 核查成功即按新快照收敛撤权；核查遇 1000000
 * 由身份层清除会话（事件桥/重查共用同一次收敛）、1001000 转授权编排、网络
 * 失败保留原快照。并发 403 在飞行中只处理一次——首个触发代表快照过期，
 * 后续事件在快照刷新后自然失效，不排队放大请求。
 */
export async function reconcilePermissionsAfterForbidden(): Promise<void> {
  if (reconcileInFlight) return
  if (store.getState().auth.identity === null) return
  reconcileInFlight = true
  try {
    const outcome = await reverifyIdentity()
    if (outcome === 'verified') {
      reconcileRevokedPagesNow()
    }
  } finally {
    reconcileInFlight = false
  }
}

/* -------------------------------------------------------------------------- */
/* 软件授权恢复接口（供 T018 激活成功后调用）                                       */
/* -------------------------------------------------------------------------- */

export type AuthorizationResumeOutcome =
  | 'resumed' // 重查通过：挂起已解除，仍有权草稿/入口已按新快照恢复
  | 'still-unauthorized' // 激活未生效（后端仍报 1001000）：保持授权页
  | 'session-expired' // 会话已失效：失效编排已收敛，交登录页
  | 'unreachable' // 网络不可达：保持挂起，稍后可重试

/**
 * 激活恢复编排（T018 接线点，SPEC §6.2/§9.1）：重新核查身份与权限；
 * 通过后清除挂起标记（不推进纪元——草稿/页签会话/待确认任务记录因此保留），
 * 并按新快照收敛暂停期间可能发生的撤权，随后由调用方路由回业务视图。
 * 未通过则保持挂起状态，返回结论供授权页提示。
 */
export async function resumeAfterSoftwareAuthorizationActivated(): Promise<AuthorizationResumeOutcome> {
  const outcome: IdentityReverifyOutcome = await reverifyIdentity()
  if (outcome !== 'verified') {
    return outcome === 'unauthorized' ? 'still-unauthorized' : outcome
  }
  store.dispatch(softwareAuthorizationResumed())
  // 暂停期间授权可能被调整：恢复前按新快照收敛撤权（含暂停前打开的页签）
  reconcileRevokedPagesNow()
  return 'resumed'
}

/* -------------------------------------------------------------------------- */
/* 编排器装配（启动期注册一次）                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 注册统一失效编排：旧协议 403 事件 → 权限重查；store 状态变迁 →
 * 认证失效中止可取消活动（先于 React 宿主的纪元复位执行）与授权暂停。
 * 返回解除注册函数（应用生命周期内不解除，供测试/诊断兜底）。
 */
export function initInvalidationOrchestrator(): () => void {
  const unsubscribeEvents = subscribeLegacyEventsForwarder()
  let prevEpoch = store.getState().auth.epoch
  let prevAuthorizationRequired = store.getState().auth.authorizationRequired
  const unsubscribeStore = store.subscribe(() => {
    const { epoch, authorizationRequired } = store.getState().auth
    if (epoch !== prevEpoch) {
      // 登录/恢复完成与认证失效都推进纪元：同步中止上一会话可取消活动，
      // 迟到回执由任务控制器的纪元守卫丢弃，不会写入新会话（§6.3）
      prevEpoch = epoch
      abortCancellableSessionActivities()
    }
    if (authorizationRequired && !prevAuthorizationRequired) {
      // 1001000：身份保留，暂停受保护活动——记录保留为待确认，草稿与
      // 页签会话不动；转授权页由路由层（SessionHost 效应 + 守卫）完成
      abortCancellableSessionActivities()
    }
    prevAuthorizationRequired = authorizationRequired
  })
  return () => {
    unsubscribeEvents()
    unsubscribeStore()
  }
}

/** 403 → 权限重查的事件转发：独立函数便于解除注册（避免闭包膨胀） */
function subscribeLegacyEventsForwarder(): () => void {
  return subscribeLegacyEvents((event) => {
    if (event.type === 'request-error' && event.error?.status === 403) {
      void reconcilePermissionsAfterForbidden()
    }
  })
}
