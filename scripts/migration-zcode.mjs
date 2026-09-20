/**
 * 只读查询 ZCode 的真实会话与轮次，不调用界面、不修改调度器数据库。
 * 锁恢复依赖成功取锁记录和精确轮次终态；时间、PID 和模型文字不作为释放依据。
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const sameDirectory = (left, right) => typeof left === 'string' && resolve(left).toLowerCase() === resolve(right).toLowerCase()
const terminalTurns = ['completed', 'cancelled', 'error']
const terminalTasks = ['completed', 'cancelled', 'failed', 'error', 'interrupted']
const terminalRuns = ['succeeded', 'cancelled', 'failed', 'interrupted']

/**
 * 默认读取当前用户的 ZCode 数据目录；覆盖变量仅用于独立环境的集成验证。
 * 任一库缺失、版本不兼容或查询异常都停止自动判断，不能降级为超时删锁。
 */
async function withDatabases(action) {
  const home = process.env.MIGRATION_ZCODE_HOME || resolve(homedir(), '.zcode')
  const indexPath = resolve(home, 'v2/tasks-index.sqlite')
  const runtimePath = resolve(home, 'cli/db/db.sqlite')
  if (!existsSync(indexPath) || !existsSync(runtimePath)) throw new Error('缺少 ZCode 会话数据库，不能自动确认身份或终态')
  const { DatabaseSync } = await import('node:sqlite')
  const index = new DatabaseSync(indexPath, { readOnly: true })
  let runtime
  try {
    runtime = new DatabaseSync(runtimePath, { readOnly: true })
    return action(index, runtime)
  } finally { runtime?.close(); index.close() }
}

/**
 * 运行中的统计尚未写入 turn_usage，不能用统计表判定当前身份。
 * 以本次独立启动命令的 running 工具记录关联 message.anchor.turnId，
 * 再交叉核对自动调度、任务、会话及仓库；零个或多个匹配都拒绝猜测。
 * Codex 人工维护可显式传真实 UUID，自动轮不能借此绕过身份核验。
 */
export async function resolveRunnerSession(root, requested) {
  if (/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requested || '')) return { provider: 'manual', sessionId: requested }
  if (requested !== 'auto' && !/^sess_[a-f0-9-]{36}$/i.test(requested || '')) throw new Error('--session 必须为 auto、真实 ZCode sess_UUID 或人工维护会话 UUID')
  return withDatabases((index, runtime) => {
    const candidates = []
    const invocation = `node scripts/migration-runner.mjs ${process.argv.slice(2).join(' ')}`
    const active = index.prepare("SELECT a.run_id, a.session_id, t.workspace_path FROM automation_runs a JOIN tasks t ON t.task_id = a.session_id WHERE a.outcome = 'running' AND t.task_status = 'running'").all()
    for (const row of active) {
      if (!sameDirectory(row.workspace_path, root) || (requested !== 'auto' && requested !== row.session_id)) continue
      const session = runtime.prepare('SELECT directory FROM session WHERE id = ?').get(row.session_id)
      if (!sameDirectory(session?.directory, root)) continue
      const parts = runtime.prepare(`SELECT p.id, p.data, m.id AS message_id, m.data AS message_data
        FROM part p JOIN message m ON m.id = p.message_id AND m.session_id = p.session_id
        WHERE p.session_id = ? AND json_extract(p.data, '$.type') = 'tool'
          AND json_extract(p.data, '$.tool') = 'Bash'
          AND json_extract(p.data, '$.state.status') = 'running'`).all(row.session_id)
      for (const part of parts) {
        const data = JSON.parse(part.data)
        const message = JSON.parse(part.message_data)
        const turnId = message.anchor?.turnId
        if (data.state.input?.command?.trim() !== invocation || !data.callID || message.role !== 'assistant' || !/^turn_[a-f0-9-]{36}$/i.test(turnId || '')) continue
        const usage = runtime.prepare('SELECT status FROM turn_usage WHERE session_id = ? AND turn_id = ?').get(row.session_id, turnId)
        if (usage && usage.status !== 'running') continue
        candidates.push({ provider: 'zcode', sessionId: row.session_id, turnId, automationRunId: row.run_id,
          identitySource: 'running_tool_part', toolPartId: part.id, toolCallId: data.callID, messageId: part.message_id })
      }
    }
    if (candidates.length !== 1) throw new Error(`无法唯一确定当前 ZCode 启动工具调用（匹配 ${candidates.length} 个）；请用独立 Bash 命令执行，不加管道、包装或其他命令，不得伪造 session 名称`)
    return candidates[0]
  })
}

/**
 * 兼容旧锁：从工具数据库寻找实际执行成功的 begin，核对输出 runId、任务和开始时间。
 * 只检查工具部分，不将聊天中提到相同运行标识的文本误认成锁归属证明。
 */
function legacyBinding(runtime, root, lock) {
  const matches = []
  const parts = runtime.prepare("SELECT p.id, p.session_id, p.data, s.directory FROM part p JOIN session s ON s.id = p.session_id WHERE json_extract(p.data, '$.type') = 'tool' AND instr(p.data, ?) > 0").all(lock.runId)
  for (const part of parts) {
    if (!sameDirectory(part.directory, root)) continue
    const data = JSON.parse(part.data)
    if (data.state?.status !== 'completed' || !/^\s*node scripts\/migration-runner\.mjs begin\s/.test(data.state.input?.command || '')) continue
    let output
    try { output = JSON.parse(data.state.output) } catch { continue }
    const startDifference = Math.abs(Date.parse(output.startedAt) - Date.parse(lock.startedAt))
    if (output.runId !== lock.runId || output.taskId !== lock.taskId || !Number.isFinite(startDifference) || startDifference > 5000) continue
    const usage = runtime.prepare("SELECT turn_id FROM tool_usage WHERE session_id = ? AND tool_call_id = ? AND status = 'completed'").get(part.session_id, data.callID)
    if (usage?.turn_id) matches.push({ provider: 'zcode', sessionId: part.session_id, turnId: usage.turn_id, beginPartId: part.id })
  }
  if (matches.length !== 1) throw new Error('旧锁缺少唯一的成功 begin 工具记录，仍需人工核实')
  return matches[0]
}

/**
 * 同时核对精确轮次、当前会话、自动调度结果及尚未结束的工具/排队输入。
 * 会话被再次唤醒时保持锁；恢复时再次调用本方法，不能使用陈旧探测结果。
 */
export async function probeRunnerEnd(root, lock) {
  try {
    return await withDatabases((index, runtime) => {
      const binding = lock.runner?.provider === 'zcode' ? lock.runner : legacyBinding(runtime, root, lock)
      const task = index.prepare('SELECT task_id, task_status, workspace_path, updated_at FROM tasks WHERE task_id = ?').get(binding.sessionId)
      if (!task || !sameDirectory(task.workspace_path, root)) throw new Error('会话与仓库不匹配')
      const turn = runtime.prepare('SELECT turn_id, status, started_at, completed_at FROM turn_usage WHERE session_id = ? AND turn_id = ?').get(binding.sessionId, binding.turnId)
      const automation = binding.automationRunId
        ? index.prepare('SELECT run_id, outcome, updated_at FROM automation_runs WHERE run_id = ? AND session_id = ?').get(binding.automationRunId, binding.sessionId)
        : index.prepare('SELECT run_id, outcome, updated_at FROM automation_runs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1').get(binding.sessionId)
      const activeTurns = runtime.prepare("SELECT count(*) AS n FROM turn_usage WHERE session_id = ? AND status = 'running'").get(binding.sessionId).n
      const activeTools = runtime.prepare("SELECT count(*) AS n FROM tool_usage WHERE session_id = ? AND status = 'running'").get(binding.sessionId).n
      // 工具统计同样可能延迟落库，恢复时还必须检查实时工具记录。
      // 统计中旧轮已结束，但会话重新执行了工具时，仍不得释放锁。
      const activeParts = runtime.prepare("SELECT count(*) AS n FROM part WHERE session_id = ? AND json_extract(data, '$.type') = 'tool' AND json_extract(data, '$.state.status') IN ('running', 'pending')").get(binding.sessionId).n
      const queuedInputs = runtime.prepare("SELECT count(*) AS n FROM session_input WHERE session_id = ? AND status = 'admitted'").get(binding.sessionId).n
      const ended = !!turn?.completed_at && terminalTurns.includes(turn.status) && terminalTasks.includes(task.task_status) && terminalRuns.includes(automation?.outcome) && activeTurns === 0 && activeTools === 0 && activeParts === 0 && queuedInputs === 0
      return {
        runId: lock.runId, ended, kind: 'runner_terminal_state', checkedAt: new Date().toISOString(),
        reference: 'ZCode 只读 tasks-index.sqlite + CLI db.sqlite：精确取锁轮次、会话、调度终态和活动检查',
        binding, turn, taskStatus: task.task_status, taskUpdatedAt: task.updated_at, automation,
        activeTurns, activeTools, activeParts, queuedInputs,
        reason: ended ? '持锁轮次已终止且会话没有活动或排队执行' : '持锁会话仍活动、等待输入或终态证据不完整',
      }
    })
  } catch (error) {
    return { runId: lock.runId, ended: false, reason: error.message }
  }
}
