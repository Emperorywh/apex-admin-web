/**
 * 串行迁移的运行控制入口。
 * 只管理锁、检查点、验收索引和 Git 交付，不执行业务接口、不替代人工审查证据。
 * 锁不设自动过期；进程退出或心跳过旧均不能证明所属 Agent 已结束。
 */
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { probeRunnerEnd, resolveRunnerSession } from './migration-zcode.mjs'

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const statePath = resolve(root, 'docs/migration/RUN_STATE.json')
const lockDir = resolve(root, 'docs/migration/.lock')
const lockPath = resolve(lockDir, 'lock.json')
const [command = 'status', ...args] = process.argv.slice(2)
const options = Object.fromEntries(args.reduce((pairs, arg, index) => {
  if (index % 2 === 0) {
    if (!arg.startsWith('--') || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('参数必须成对：--名称 值')
    pairs.push([arg.slice(2), args[index + 1]])
  }
  return pairs
}, []))
const now = () => new Date().toISOString()
const json = (path) => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const git = (...parameters) => execFileSync('git', parameters, { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const required = (value, message) => { if (!value) throw new Error(message) }
const ids = ['T00', ...Array.from({ length: 43 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`), 'H01', 'H02', 'H03', 'V01']

/**
 * 所有状态、证据、临时文件必须落在本仓库内，禁止路径穿越和符号链接逃逸。
 * 尚不存在的路径逐级回溯至真实父目录；外部 OpenAPI 只允许只读计算指纹。
 */
function localPath(value) {
  required(typeof value === 'string' && value, '缺少仓库内路径')
  const path = resolve(root, value)
  required(path.startsWith(root + sep), '路径必须位于仓库内')
  let parent = path
  while (!existsSync(parent)) parent = dirname(parent)
  const actual = realpathSync(parent)
  required(actual === root || actual.startsWith(root + sep), '路径经链接解析后越界')
  return path
}

/**
 * 同目录唯一临时文件、刷盘后 rename，避免中断留下半份 JSON。
 * 原子替换不等于跨文件事务；RUN_STATE 是状态真相源，TASKS 勾选可由 sync 重建。
 */
function atomicWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID()}.tmp`
  const descriptor = openSync(temp, 'wx')
  try {
    writeFileSync(descriptor, value)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  try { renameSync(temp, path) } finally { if (existsSync(temp)) unlinkSync(temp) }
}
const writeJson = (path, value) => atomicWrite(path, JSON.stringify(value, null, 2) + '\n')
const readState = () => json(statePath)
const owner = () => json(lockPath)

/**
 * 只有持有当前运行标识的调用方可以写入。
 * 短命令再以独占文件互斥，防止同一运行的两个工具调用覆盖检查点。
 */
function withOwner(action) {
  required(options.run && owner().runId === options.run, '未持有当前锁，停止写入')
  required(!existsSync(resolve(lockDir, 'recovery.lock')), '锁正在核验恢复，停止写入')
  const commandLock = resolve(lockDir, 'command.lock')
  const descriptor = openSync(commandLock, 'wx')
  try {
    required(owner().runId === options.run, '锁持有者变化')
    required(!existsSync(resolve(lockDir, 'recovery.lock')), '锁正在核验恢复，停止写入')
    const state = readState()
    required(state.run?.runId === options.run, '锁与 RUN_STATE 不一致；先恢复，不得直接覆盖')
    return action(state)
  } finally {
    closeSync(descriptor)
    unlinkSync(commandLock)
  }
}

/**
 * 固定枚举避免将长篇说明误当机器状态；48 项任务不允许遗漏、重复或隐式改序。
 * 历史勾选迁移为待复核，不代表业务代码需要重做，也不自动取得放行资格。
 */
function validate(state) {
  required(state.schemaVersion === 2 && Number.isInteger(state.revision), '状态版本或修订号无效')
  required(resolve(state.workspace.root) === root, '工作目录不符')
  required(state.queue.length === 48 && new Set(state.queue.map(task => task.id)).size === 48, '队列必须包含 48 个唯一任务')
  required(ids.every(id => state.queue.some(task => task.id === id)), '任务集合不完整')
  for (const task of state.queue) {
    required(['not_started', 'in_progress', 'implemented'].includes(task.implementation), `${task.id} 实施状态无效`)
    required(['not_started', 'pending_review', 'partial', 'passed'].includes(task.verification), `${task.id} 验收状态无效`)
    required(['blocked', 'pending_review', 'ready'].includes(task.gate), `${task.id} 放行状态无效`)
    required(Array.isArray(task.dependencies) && task.dependencies.every(id => ids.includes(id)), `${task.id} 前置不合法`)
    required(task.dependencies.every(id => state.queue.findIndex(item => item.id === id) < state.queue.indexOf(task)), `${task.id} 出现反向实施依赖；跨页补验应单独登记`)
  }
  required(state.currentTaskId === null || ids.includes(state.currentTaskId), '当前任务不存在')
  required(['unverified', 'pending', 'synced', 'blocked'].includes(state.publish.status), '推送状态无效')
  if (state.queue.find(task => task.id === 'V01').verification === 'passed') required(state.queue.every(task => task.verification === 'passed'), 'V01 不能在其他任务仍待验收时宣称整体完成')
}

/**
 * 放行记录是可复核清单，不是简单的 passed 布尔值。
 * 所有 DoD、A/I 与任务卡均逐项给出结果；登记例外只能使用现行规则允许的类别。
 * 文件哈希将证据绑定至实际受检代码；历史文字结论不能冒充本次验证。
 */
function validateEvidence(task) {
  const evidencePath = localPath(task.acceptanceRecord)
  required(evidencePath.startsWith(resolve(root, 'docs/migration/evidence') + sep), '验收记录必须持久化到 evidence')
  const record = json(evidencePath)
  required(record.taskId === task.id && /^[a-f0-9]{40}$/.test(record.codeCommit), `${task.id} 缺少验收提交标识`)
  git('cat-file', '-e', `${record.codeCommit}^{commit}`)
  required(record.codeFiles?.length > 0, `${task.id} 缺少受检代码清单`)
  for (const file of record.codeFiles) required(hash(localPath(file.path)) === file.sha256, `${task.id} 证据对应代码已变化：${file.path}`)
  const expected = ['TASK', ...Array.from({ length: 16 }, (_, i) => `DoD${i + 1}`), ...Array.from({ length: 24 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`), ...Array.from({ length: 8 }, (_, i) => `I${String(i + 1).padStart(2, '0')}`)]
  required(record.items?.length === expected.length && new Set(record.items.map(item => item.id)).size === expected.length, `${task.id} 验收矩阵不完整`)
  for (const id of expected) {
    const item = record.items.find(entry => entry.id === id)
    required(item && ['passed', 'not_applicable', 'deferred'].includes(item.status), `${task.id}/${id} 尚未通过或登记`)
    required(item.reason && item.evidence?.length, `${task.id}/${id} 缺少理由或证据引用`)
    for (const path of item.evidence) required(existsSync(localPath(path)), `${task.id}/${id} 证据不存在：${path}`)
    if (item.status === 'deferred') {
      required(task.verification !== 'passed', `${task.id} 仍有待验收项，不能勾选`)
      required(['cross_page', 'site_acceptance', 'confirmed_api_gap'].includes(item.category) && item.basis && item.resumeCondition && item.owner, `${task.id}/${id} 例外缺少既定依据、解除条件或负责人`)
    }
  }
  required(['scope', 'static', 'readOnly', 'ui', 'sharedConsumers'].every(key => record.releaseChecks?.[key] === 'passed' || (record.releaseChecks?.[key] === 'not_applicable' && record.releaseReasons?.[key])), `${task.id} 实施放行门禁不全`)
  required(task.implementation === 'implemented', `${task.id} 实现未完成不能放行或通过验收`)
}

/**
 * TASKS 只投影最终验收状态；已交付进度保存在结构化队列及任务交接记录。
 * 先落盘真相源，再更新投影；发生中断可重复 sync，不会重复执行业务操作。
 */
function syncTasks(state) {
  const path = resolve(root, 'TASKS.md')
  const original = readFileSync(path, 'utf8')
  const updated = original.replace(/^(- )\[[ x]\]( \*\*(T\d+|P\d+|H\d+|V\d+)\b)/gm, (_, prefix, suffix, id) => `${prefix}[${state.queue.find(task => task.id === id).verification === 'passed' ? 'x' : ' '}]${suffix}`)
  if (updated !== original) atomicWrite(path, updated)
}
function save(state) {
  validate(state)
  state.revision += 1
  state.updatedAt = now()
  writeJson(statePath, state)
  syncTasks(state)
  writeJson(lockPath, { ...owner(), heartbeatAt: now() })
}

/**
 * 未完成任务优先（2026-09-20 用户决策调整）：先完成全部页面实现（V01 除外），
 * 历史任务的验收复核顺延到开发收口后逐项补做，避免复核长期占用轮次拖住尚未复刻的页面。
 * 已明确放行但待现场验收不伪装成最终完成；提交后中断先补推送。
 * 开发依赖按 TASKS §3 口径以「代码/契约已合并（implemented）」判定，不要求前置任务先通过复核；
 * 进入 V01 前仍须先完成顺延的复核并逐项补验，避免最终任务无法更新前项的死锁。
 */
function nextTask(state) {
  const unpublishedCommit = state.publish.status !== 'synced' || state.publish.commit !== git('rev-parse', 'HEAD')
  if (unpublishedCommit) return { taskId: state.publish.taskId || state.lastRun?.taskId || state.currentTaskId || 'T00', purpose: 'delivery' }
  // 开发优先分支：优先恢复 currentTaskId 对应的未完成任务，否则按队列顺序取下一个待开发任务
  const developable = state.queue.find(task => task.id !== 'V01' && (task.implementation === 'not_started' || task.implementation === 'in_progress'))
  if (developable) {
    const current = state.queue.find(task => task.id !== 'V01' && task.id === state.currentTaskId && (task.implementation === 'not_started' || task.implementation === 'in_progress'))
    const target = current || developable
    const unmet = target.dependencies.filter(id => state.queue.find(task => task.id === id).implementation !== 'implemented')
    return { taskId: target.id, purpose: 'implement', unmet }
  }
  // 开发收口后才恢复历史待复核项（每轮一项 audit），复核结论决定放行与验收状态
  const audit = state.queue.find(task => (task.implementation === 'implemented' && task.gate === 'pending_review') || evidenceProblem(task))
  if (audit) return { taskId: audit.id, purpose: 'audit' }
  const current = state.queue.find(task => task.id === state.currentTaskId && task.gate !== 'ready')
  const next = current || state.queue.find(task => task.gate !== 'ready')
  const pending = state.queue.find(task => task.id !== 'V01' && task.verification !== 'passed')
  if (next?.id === 'V01' && pending) return { taskId: pending.id, purpose: 'acceptance' }
  if (next) return { taskId: next.id, purpose: 'implement', unmet: next.dependencies.filter(id => state.queue.find(task => task.id === id).gate !== 'ready') }
  return pending ? { taskId: pending.id, purpose: 'acceptance' } : null
}

/**
 * 对文档及文本证据执行保守的凭据检查，只打印位置而不回显可疑值。
 * 这不能替代人工脱敏审查；截图及未被模式识别的秘密仍须在提交前核对。
 */
function checkDocumentSecrets() {
  const problems = []
  const patterns = [
    /Bearer\s+[A-Za-z0-9_./+=-]{20,}/i,
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /MD5\((?!password\)|密码\)|\[已脱敏\])[^)\r\n]+\)/i,
    /(?:password|密码)\s*[:=：]\s*["'`](?!\[|<|\$|process\.|os\.|环境|示例)[^"'`\r\n]+["'`]/i,
  ]
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (/\.(md|json|py|mjs|ps1)$/.test(entry.name)) {
        readFileSync(path, 'utf8').split(/\r?\n/).forEach((line, index) => {
          if (patterns.some(pattern => pattern.test(line))) problems.push(`${relative(root, path)}:${index + 1}`)
        })
      }
    }
  }
  visit(resolve(root, 'docs/migration'))
  required(problems.length === 0, `文档疑似含凭据，请人工脱敏：${problems.join(', ')}`)
}

/**
 * 公共代码变化会使旧证据过期，转入复核而不是锁死状态修复入口。
 * 只有提升为放行或验收通过时强制验证证据；读取和降级操作始终可用。
 */
function evidenceProblem(task) {
  if (task.gate !== 'ready' && task.verification !== 'passed') return null
  try { validateEvidence(task); return null } catch (error) { return error.message }
}

/**
 * 启动先获取原子目录锁，写入所有权和起始 Git 快照后再允许开发。
 * 不清理既有工作区；推送阻塞和分支偏移必须先恢复。
 */
async function begin(automatic = false) {
  if (automatic) options.run ||= `run-${randomUUID()}`
  required(/^[a-zA-Z0-9_-]{8,100}$/.test(options.run || '') && (options.session || automatic), 'begin 需要唯一 --run 和真实 --session')
  const runner = await resolveRunnerSession(root, options.session || 'auto')
  required(!existsSync(localPath(`docs/migration/evidence/runs/${options.run}.json`)), '运行标识已结束，禁止复用')
  mkdirSync(lockDir)
  let initialized = false
  try {
    writeJson(lockPath, { schemaVersion: 2, runId: options.run, taskId: options.task, owner: runner.sessionId, runner, startedAt: now(), heartbeatAt: now() })
    const state = readState()
    validate(state)
    required(!state.run, 'RUN_STATE 有未结束运行，须核实终止后恢复')
    required(git('branch', '--show-current') === state.workspace.branch, '当前分支与约定分支不符')
    reconcileRemote(state)
    const candidate = nextTask(state)
    if (automatic && !candidate) {
      save(state)
      console.log(JSON.stringify({ action: 'complete', next: null }))
      return
    }
    if (automatic) options.task = candidate?.taskId
    const purpose = options.purpose || candidate?.purpose
    required(candidate && candidate.taskId === options.task, '只能处理 status 给出的下一项')
    required(purpose === candidate.purpose || purpose === 'delivery', '本轮类型不符')
    required(purpose === 'delivery' || !['pending', 'blocked'].includes(state.publish.status), '先用 delivery 轮恢复推送')
    required(purpose !== 'implement' || candidate.unmet.length === 0, `依赖未放行：${candidate.unmet?.join(', ')}`)
    state.run = { runId: options.run, taskId: options.task, purpose, owner: runner.sessionId, runner, startedAt: now(), baseHead: git('rev-parse', 'HEAD'), initialStatus: git('status', '--porcelain=v1'), progress: [], nextSteps: [], blocker: null }
    writeJson(lockPath, { ...owner(), taskId: options.task, purpose })
    if (purpose === 'implement') {
      state.currentTaskId = options.task
      state.queue.find(task => task.id === options.task).implementation = 'in_progress'
    } else if (purpose === 'audit') {
      const task = state.queue.find(task => task.id === options.task)
      task.gate = 'pending_review'
      task.verification = 'pending_review'
    }
    save(state)
    initialized = true
    console.log(JSON.stringify(state.run, null, 2))
  } finally {
    if (!initialized && existsSync(lockPath) && owner().runId === options.run && readState().run?.runId !== options.run) {
      unlinkSync(lockPath)
      rmdirSync(lockDir)
    }
  }
}

/**
 * 回执只描述上次核验的提交，不等于当前 HEAD 的真实交付状态。
 * 领取业务任务前查询远端：已同步则修正回执并在同轮继续，真正未推送才进入交付轮。
 */
function reconcileRemote(state) {
  const head = git('rev-parse', 'HEAD')
  if (state.publish.status === 'synced' && state.publish.commit === head) return
  const remoteHead = git('ls-remote', '--exit-code', state.workspace.remote, `refs/heads/${state.workspace.remoteBranch}`).split(/\s+/)[0]
  if (remoteHead === head) state.publish = { status: 'synced', commit: head, confirmedRemoteHead: remoteHead, checkedAt: now(), error: null }
  else state.publish = { ...state.publish, status: 'pending', commit: head, confirmedRemoteHead: remoteHead, checkedAt: now() }
}

/**
 * 每轮唯一启动入口：核对遗留锁终态、恢复、远端对账、选择并领取一个任务。
 * 预检只做执行控制，不算推进额外业务任务；活动锁和不确定状态仍保持原样。
 */
async function prepare() {
  if (existsSync(lockDir)) {
    required(existsSync(lockPath), '锁目录缺少身份记录，停止自动恢复')
    const previous = owner()
    const proof = await probeRunnerEnd(root, previous)
    if (!proof.ended) {
      console.log(JSON.stringify({ action: 'blocked', lock: previous, reason: proof.reason, next: null }, null, 2))
      return
    }
    await recover(proof)
  }
  await begin(true)
}

/**
 * 推送仅针对当前约定分支的已有提交，调用前由 Agent 审阅提交范围。
 * 网络结果未知先查询远端，不重做提交、不强推、不自动合并；状态回执留待下轮提交。
 */
function publish(state, performPush) {
  required(git('branch', '--show-current') === state.workspace.branch, '推送分支不符')
  const head = git('rev-parse', 'HEAD')
  const remote = state.workspace.remote
  const ref = `refs/heads/${state.workspace.remoteBranch}`
  const remoteHead = git('ls-remote', '--exit-code', remote, ref).split(/\s+/)[0]
  if (remoteHead !== head) {
    git('cat-file', '-e', `${remoteHead}^{commit}`)
    git('merge-base', '--is-ancestor', remoteHead, head)
    required(performPush, '远端尚未包含本地 HEAD，需审阅提交后执行 push')
    required(options.commit === head, 'push 需要 --commit 指定已审阅的完整 HEAD')
    git('push', remote, `HEAD:${ref}`)
  }
  const confirmed = git('ls-remote', '--exit-code', remote, ref).split(/\s+/)[0]
  required(confirmed === head, '远端确认与预期提交不符，保持待推送')
  state.publish = { status: 'synced', taskId: state.run.taskId, commit: head, confirmedRemoteHead: confirmed, checkedAt: now(), error: null }
  save(state)
}

/**
 * 恢复遗留锁必须提供对应运行已终止的外部证据，绝不依据文件年龄自动接管。
 * 将证明和原锁归档后才释放路径；不知道旧运行标识时先人工核实，不能猜测。
 */
async function recover(automaticProof) {
  let proof = automaticProof || json(localPath(options.proof))
  const previous = owner()
  required(proof.runId === previous.runId && proof.ended === true && ['user_confirmation', 'runner_terminal_state'].includes(proof.kind) && proof.reference && proof.checkedAt, '恢复证明不完整或与旧运行不符')
  required(automaticProof || options.run === previous.runId, '恢复必须明确指定旧运行标识')
  if (proof.kind === 'runner_terminal_state') {
    proof = await probeRunnerEnd(root, previous)
    required(proof.ended, `运行终态无法再次确认：${proof.reason}`)
  }
  const recoveryLock = resolve(lockDir, 'recovery.lock')
  const recoveryRunner = await resolveRunnerSession(root, options.session || 'auto')
  /**
   * 恢复命令本身也可能被取消；短恢复锁同样绑定真实会话，不能产生第二种永久遗留锁。
   * 仅在上次恢复者已终止、记录未变化时移除其短锁，活动恢复者仍享有独占权。
   */
  if (existsSync(recoveryLock)) {
    const priorRecovery = json(recoveryLock)
    const priorEnd = await probeRunnerEnd(root, priorRecovery)
    required(priorEnd.ended && json(recoveryLock).runId === priorRecovery.runId, '已有恢复命令仍活动或无法核实终态')
    unlinkSync(recoveryLock)
  }
  const descriptor = openSync(recoveryLock, 'wx')
  writeFileSync(descriptor, JSON.stringify({ runId: `recovery-${randomUUID()}`, runner: recoveryRunner, startedAt: now() }))
  closeSync(descriptor)
  let archive
  try {
    required(owner().runId === previous.runId, '恢复期间锁持有者变化')
    const state = readState()
    required(!state.run || state.run.runId === previous.runId, 'RUN_STATE 指向另一运行，停止恢复')
    const destination = localPath(`docs/migration/evidence/recovery/${previous.runId}.json`)
    if (existsSync(destination)) required(json(destination).previousLock?.runId === previous.runId, '已有恢复记录与原锁不符，需人工对账')
    else writeJson(destination, { proof, previousLock: previous, previousRun: state.run, recordedAt: now() })
    if (state.run) {
      state.lastRun = { ...state.run, endedAt: now(), outcome: 'interrupted', recoveryEvidence: relative(root, destination).replaceAll('\\', '/') }
      state.run = null
      state.revision += 1
      state.updatedAt = now()
      validate(state)
      writeJson(statePath, state)
    }
    required(owner().runId === previous.runId, '恢复期间锁持有者变化')
    archive = localPath(`.run-lock/recovered-${previous.runId}-${randomUUID()}`)
    mkdirSync(dirname(archive), { recursive: true })
    renameSync(lockDir, archive)
    if (!automaticProof) console.log('已保存终止证据并归档旧锁；可在本轮继续 prepare')
  } finally {
    const held = archive && existsSync(archive) ? resolve(archive, 'recovery.lock') : recoveryLock
    if (existsSync(held)) unlinkSync(held)
  }
}

try {
  if (command === 'prepare') await prepare()
  else if (command === 'begin') await begin()
  else if (command === 'recover') await recover()
  else if (command === 'status' || command === 'check') {
    const state = readState()
    validate(state)
    const text = readFileSync(resolve(root, 'TASKS.md'), 'utf8')
    const mismatches = [...text.matchAll(/^- \[([ x])\] \*\*((?:T|P|H|V)\d+)\b/gm)].filter(match => (match[1] === 'x') !== (state.queue.find(task => task.id === match[2]).verification === 'passed')).map(match => match[2])
    if (command === 'check') {
      required(mismatches.length === 0, `TASKS 投影不一致：${mismatches.join(', ')}`)
      for (const task of state.queue) {
        const problem = evidenceProblem(task)
        required(!problem, problem)
      }
      checkDocumentSecrets()
    }
    console.log(JSON.stringify({ revision: state.revision, currentTaskId: state.currentTaskId, run: state.run, lock: existsSync(lockPath) ? owner() : null, next: existsSync(lockDir) || state.run ? null : nextTask(state), remoteRecheckRequired: state.publish.commit !== git('rev-parse', 'HEAD') || state.publish.status !== 'synced', publish: state.publish, taskProjectionMismatches: mismatches, counts: { total: state.queue.length, implemented: state.queue.filter(task => task.implementation === 'implemented').length, accepted: state.queue.filter(task => task.verification === 'passed').length, ready: state.queue.filter(task => task.gate === 'ready').length } }, null, 2))
  } else if (['checkpoint', 'sync', 'end', 'push', 'verify-remote'].includes(command)) withOwner(state => {
    if (command === 'checkpoint') {
      required(Number(options.revision) === state.revision, '修订号已变化，重新读取后再保存')
      const patch = json(localPath(options.file))
      required(Object.keys(patch).every(key => ['task', 'progress', 'nextSteps', 'blocker'].includes(key)), '检查点包含不允许的字段')
      if (patch.task) {
        required(state.run.purpose !== 'delivery', '交付恢复轮不得修改业务任务状态')
        required(Object.keys(patch.task).every(key => ['implementation', 'verification', 'gate', 'acceptanceRecord', 'pendingItems', 'note'].includes(key)), '禁止检查点修改任务身份或依赖')
        Object.assign(state.queue.find(task => task.id === state.run.taskId), patch.task)
        const task = state.queue.find(task => task.id === state.run.taskId)
        if (task.gate === 'ready' || task.verification === 'passed') validateEvidence(task)
      }
      for (const key of ['progress', 'nextSteps', 'blocker']) if (key in patch) state.run[key] = patch[key]
      save(state)
    } else if (command === 'sync') { validate(state); syncTasks(state) }
    else if (command === 'push' || command === 'verify-remote') {
      try { publish(state, command === 'push') } catch (error) {
        state.publish = { status: 'blocked', commit: git('rev-parse', 'HEAD'), checkedAt: now(), error: '远端核验或推送失败；查看工具输出核实，不推断已送达' }
        save(state)
        throw error
      }
    } else {
      required(['completed', 'checkpoint', 'blocked'].includes(options.outcome), 'end 需要 --outcome completed/checkpoint/blocked')
      const record = { ...state.run, endedAt: now(), outcome: options.outcome, endHead: git('rev-parse', 'HEAD'), publish: state.publish }
      writeJson(localPath(`docs/migration/evidence/runs/${state.run.runId}.json`), record)
      state.lastRun = record
      state.run = null
      save(state)
    }
    console.log(`已完成 ${command}，修订号 ${state.revision}`)
  })
  else throw new Error('支持：prepare/status/check/begin/checkpoint/sync/end/verify-remote/push/recover；参数见 TASKS.md §2')
  if (command === 'end') {
    required(owner().runId === options.run && !readState().run, '结束记录未落盘或锁已变化，禁止释放')
    const archive = localPath(`.run-lock/ended-${options.run}-${randomUUID()}`)
    mkdirSync(dirname(archive), { recursive: true })
    renameSync(lockDir, archive)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
