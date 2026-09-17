/**
 * 设备控制 / 破坏性写操作的统一结果语义类型（T00.7，迁移规格 9 / A14 / A15）。
 *
 * 三态依据（规格 9 写操作纪律）：
 * - 后端"命令已接受"不等于设备动作完成，展示阶段必须与接口实际语义一致；
 * - 超时/断连不能直接认定失败或成功，先查实际状态，再由用户决定是否重试；
 * - 没有状态查询能力时明确"无法确认"，禁止自动补发命令。
 */

/**
 * 单条命令的结果语义：
 * - accepted：后端已接受命令（HTTP/业务码成功），但动作完成与否待核实；
 * - completed：通过真实状态查询或业务响应确认动作已完成；
 * - unknown：超时/断连/响应不含结论，当前无法确认（显示未知，不判成败）。
 */
export type CommandOutcome = 'accepted' | 'completed' | 'unknown'

/** 逐项批量结果的单项记录：id 为目标业务标识，outcome 为该项真实结果 */
export interface BatchItemOutcome {
  id: string
  outcome: CommandOutcome | 'failed'
}

/** 批量结果归纳：三项计数只来自真实逐项响应，缺项不得补齐 */
export interface BatchOutcomeSummary {
  succeeded: number
  failed: number
  unknown: number
  /** 提交目标总数（= 三项计数之和；供"有目标未返回结果"的检测） */
  total: number
}
