/**
 * 会话任务层唯一引入口（T011）：页面与外壳只经本文件消费
 * 写入/传输控制器与订阅 Hook，不得深路径绕过 store 内部。
 */

export type {
  SessionTasksSnapshot,
  TransferPhase,
  TransferStatus,
  TransferTaskRecord,
  WriteTaskRecord,
  WriteTaskStatus,
  WriteUnknownReason,
  WriteTaskRunContext,
} from '@/services/session-tasks/sessionTask.types'
export {
  getSessionTasksSnapshot,
  subscribeSessionTasks,
  resetSessionTasks,
} from '@/services/session-tasks/sessionTaskStore'
export {
  submitWriteTask,
  stopWaitingForWrite,
  dismissWriteTask,
  type SubmitWriteTaskInput,
  type WriteTaskHandle,
} from '@/services/session-tasks/writeTasks'
export {
  startTransferTask,
  cancelTransferTask,
  dismissTransferTask,
  type StartTransferTaskInput,
  type TransferTaskHandle,
} from '@/services/session-tasks/transferTasks'
export {
  UPLOAD_STALL_TIMEOUT_MS,
  UPLOAD_SERVER_PROCESSING_TIMEOUT_MS,
  type UploadEngineOutcome,
  type UploadEngineProgress,
} from '@/services/session-tasks/uploadEngine'
export {
  useSessionTasksSnapshot,
  useTabWriteTasks,
  useTabTransferTasks,
  useHasActiveTransfers,
} from '@/services/session-tasks/useSessionTasks'
