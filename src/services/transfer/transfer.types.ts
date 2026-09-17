/**
 * 传输任务类型（T00.6 文件传输契约）。
 *
 * 传输是「独立生命周期」的长任务：不挂在任何页面 effect 上，也不随页签
 * 关闭/缓存淘汰而终止（规格 10.2）。页面通过 beginTransfer 取得句柄，
 * 把句柄上的 AbortSignal 传给请求层，并以 setProgress 回报真实进度。
 */

/** 传输方向：上传/下载仅用于展示语义，取消与进度行为由各请求自行决定 */
export type TransferKind = 'upload' | 'download'

/**
 * 传输阶段：
 * - transferring：字节传输中（上传/下载未完成）
 * - processing：字节已 100% 交给服务端、响应未返回——「传输完毕 ≠ 处理完毕」（规格 10.5）
 * - done / failed：以业务结果或文件响应确认的终态（规格 10.6）
 * - aborted：本地主动终止。仅代表客户端停止等待/传输，服务端可能已开始处理，
 *   不能视为服务端已撤销（结果待确认，规格 10.4）
 */
export type TransferPhase = 'transferring' | 'processing' | 'done' | 'failed' | 'aborted'

/** 传输进度快照；total 为 null 表示服务端未给出总字节数（不确定进度，规格 10.5） */
export interface TransferProgress {
  /** 已发送/接收字节数 */
  loaded: number
  /** 总字节数；未知时为 null，UI 只显示不确定进度，不得伪造成百分比 */
  total: number | null
}

/** 只读传输任务快照（管理器内部状态对外只读） */
export interface TransferTask {
  id: string
  /** 承载页签 key；null 表示不隶属任何页签的传输（如外壳级导入导出） */
  tabKey: string | null
  kind: TransferKind
  /** 展示名（文件名或业务说明） */
  name: string
  phase: TransferPhase
  progress: TransferProgress
  /** 开始时间（epoch ms），用于 UI 排序与时长展示 */
  startedAt: number
  /** 终态时间（epoch ms）；进行中为 null */
  finishedAt: number | null
  /** 失败/终止原因（已翻译的可展示文案） */
  reason?: string
}

/** 传输事件（订阅回调参数）：任一任务新增/更新/移除时通知 */
export type TransferChangeListener = () => void

/** 页面发起传输时提供的描述信息 */
export interface TransferDescriptor {
  /** 承载页签 key（useTabKey 约定值）；跨页签的外壳级传输传 null */
  tabKey: string | null
  kind: TransferKind
  name: string
}
