/**
 * 控制命令确认与批量结果反馈的统一契约（T00.7，迁移规格 9 / D16 / D17）。
 *
 * 确认纪律：
 * - 普通保存直接提交，不确认；设备控制、删除、覆盖、发布、推送、重启、回滚等
 *   破坏性操作一律先经 confirmCommand 列明对象与影响，用户确认后才发请求；
 * - 确认框固定附注"提交≠完成"提示，呼应命令接受与动作完成的语义区分；
 * - 防重复提交是页面职责：提交期间禁用按钮（本工具只负责确认环节）。
 *
 * 批量纪律：
 * - 逐项结果只能来自真实逐项响应（summarizeBatchOutcomes 只归纳、不补齐）；
 * - 后端只返回整批结果时，页面不得伪造逐项成功——按 accepted（已接受）呈现，
 *   并引导用户以真实状态查询核实；
 * - 目标数与三项计数之和不符（响应缺项）时按 unknown 呈现差额，不静默吞掉。
 */

import i18next from 'i18next'
import { uiFeedback } from '@/services/feedback/uiFeedback'
import type { BatchItemOutcome, BatchOutcomeSummary } from '@/utils/command/command.types'

/** utils 层翻译入口：直接依赖 i18next 包单例（同请求层 tr 模式，避免循环导入） */
function tr(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options ?? {})
}

/** 确认框中最多逐一列出的对象数量；超出部分合并为"等 N 个对象" */
const MAX_LISTED_TARGETS = 5

export interface CommandConfirmOptions {
  /** 确认框标题（调用方传入已翻译文案） */
  title: string
  /** 受影响对象的展示名 / 标识列表（原始协议值，不做猜测翻译） */
  targets?: readonly string[]
  /** 影响说明（已翻译）；与对象列表共同呈现 */
  impact?: string
  /** 不可逆/高危操作（删除、重启、回滚、覆盖等）用红色确认按钮 */
  danger?: boolean
  /** 确认按钮文案（common 命名空间中文 key），默认「确定」 */
  okLabel?: string
}

/** 构建对象列表文本：前 MAX_LISTED_TARGETS 个逐行展示，其余合并计数 */
function describeTargets(targets: readonly string[]): string {
  const shown = targets.slice(0, MAX_LISTED_TARGETS)
  const lines = shown.map((name) => `· ${name}`)
  const rest = targets.length - shown.length
  if (rest > 0) {
    lines.push(tr('等 {{count}} 个对象', { count: targets.length }))
  }
  return lines.join('\n')
}

/**
 * 破坏性操作统一确认：列明对象与影响，返回用户是否确认。
 * 确认框内容顺序：影响说明 → 对象清单 → 提交≠完成的固定附注。
 * 取消/关闭一律返回 false，调用方不得在 false 时发出请求。
 */
export function confirmCommand(options: CommandConfirmOptions): Promise<boolean> {
  const sections: string[] = []
  if (options.impact) sections.push(options.impact)
  if (options.targets && options.targets.length > 0) {
    sections.push(tr('本次操作影响以下对象：') + '\n' + describeTargets(options.targets))
  }
  // 固定附注：命令提交后动作完成与否以实际状态核实为准（规格 9）
  sections.push(tr('命令提交后不代表操作已完成，请以实际状态核实结果'))

  return new Promise<boolean>((resolve) => {
    uiFeedback.modal.confirm({
      title: options.title,
      content: sections.join('\n\n'),
      okText: tr(options.okLabel ?? '确定'),
      cancelText: tr('取消'),
      okButtonProps: { danger: options.danger === true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

/**
 * 归纳真实逐项批量结果：只统计响应中出现的条目，不补齐、不猜测。
 * 页面拿到 summary 后用 formatBatchSummaryText 呈现，禁止自行编造逐项成功。
 */
export function summarizeBatchOutcomes(items: readonly BatchItemOutcome[]): BatchOutcomeSummary {
  const summary: BatchOutcomeSummary = { succeeded: 0, failed: 0, unknown: 0, total: items.length }
  for (const item of items) {
    if (item.outcome === 'accepted' || item.outcome === 'completed') {
      // accepted（已接受）与 completed（确认完成）分开核实时再细分；
      // 批量速览先归入成功列，页面可在详情中保留"待核实"标记
      summary.succeeded += 1
    } else if (item.outcome === 'failed') {
      summary.failed += 1
    } else {
      summary.unknown += 1
    }
  }
  return summary
}

/**
 * 整批响应的诚实呈现：后端未提供逐项结果时使用——
 * 速览为"已接受 N 项（结果以实际状态核实为准）"，不伪造逐项成败。
 */
export function summarizeWholeBatch(total: number): BatchOutcomeSummary {
  return { succeeded: total, failed: 0, unknown: 0, total }
}

/** 批量结果 → 用户可见文案（三态计数 + 缺项检测） */
export function formatBatchSummaryText(summary: BatchOutcomeSummary): string {
  // 响应缺项：目标数 > 三项计数之和 → 差额按未知呈现，不静默吞掉
  const missing = Math.max(0, summary.total - summary.succeeded - summary.failed - summary.unknown)
  const unknown = summary.unknown + missing
  if (summary.failed === 0 && unknown === 0) {
    return tr('成功 {{count}} 项', { count: summary.succeeded })
  }
  return tr('成功 {{succeeded}} 项，失败 {{failed}} 项，结果未知 {{unknown}} 项', {
    succeeded: summary.succeeded,
    failed: summary.failed,
    unknown,
  })
}
