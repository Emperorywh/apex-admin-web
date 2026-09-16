/**
 * 页面会话层唯一引入口（T013）：页面与外壳只经本文件消费
 * 草稿登记、轻量状态、离开协调器与订阅 Hook，不得深路径绕过内部。
 */

export type {
  DraftRecord,
  LeaveAction,
  LeaveConfirmRequest,
  PageSessionSnapshot,
  TabProtection,
} from '@/services/page-session/pageSession.types'
export {
  clearTabDraft,
  clearTabSessionState,
  getLightState,
  getPageSessionSnapshot,
  getTabDrafts,
  resetPageSession,
  setLightState,
  setTabDraft,
  subscribePageSession,
} from '@/services/page-session/pageSessionStore'
export {
  collectProtectedTabKeys,
  collectTabProtections,
  confirmSessionExit,
  getLeaveConfirmsSnapshot,
  hasAnySessionProtection,
  needsCapacityAdmission,
  requestCloseTabs,
  requestRefreshTab,
  resetLeaveGuard,
  resolveLeaveConfirm,
  subscribeLeaveConfirms,
  syncBeforeUnloadGuard,
} from '@/services/page-session/leaveGuard'
export { usePageSession, useTabDrafts } from '@/services/page-session/usePageSession'
