/**
 * 页面会话验证探针（T013 临时页）：验证草稿登记/解除、轻量状态跨重建恢复、
 * 写入任务保护（执行中/待确认）与容量准入。提交前移除，副本存
 * docs/migration/evidence/T013/probe/。
 *
 * 注意：可控 Promise 写入仅用于隔离验证任务控制器的保护判定，
 * 不是业务 mock；提交后仍走真实 submitWriteTask 状态机与离开协调器。
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { App, Button, Space, Typography } from 'antd'
import {
  submitWriteTask,
  stopWaitingForWrite,
  useTabWriteTasks,
} from '@/services/session-tasks'
import { usePageSession, useTabDrafts } from '@/services/page-session'
import {
  collectTabProtections,
  requestCloseTabs,
} from '@/services/page-session/leaveGuard'

const { Title, Text } = Typography

/** 可控写入的放行函数：点击「放行写入」时任务落定成功 */
let releaseControlledWrite: (() => void) | null = null

export default function PageSessionProbe() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const session = usePageSession()
  const drafts = useTabDrafts(session.tabKey)
  const tasks = useTabWriteTasks(session.tabKey)
  /** 实例挂载时读取一次轻量状态：重建后此处非 undefined 即证明恢复成功 */
  const [restoredLight] = useState<string | undefined>(() => {
    const value = session.getLightState<string>('probe-input')
    return value === undefined ? undefined : String(value)
  })
  const [inputValue, setInputValue] = useState('')
  /** 实例标记：同页签重复激活应保持不变；变化即发生了重挂载（LRU 淘汰/刷新） */
  const [instanceId] = useState(() => Math.random().toString(36).slice(2, 8))
  const searchParams = new URLSearchParams(window.location.search)

  /* 便捷开关：?dirty=1 挂载即置脏（构造批量受保护页签用，正式页面必须由用户动作触发） */
  useEffect(() => {
    if (searchParams.get('dirty') === '1' && session.tabKey !== null) {
      session.setDirty('form', `探针草稿 ${searchParams.get('case') ?? ''}`.trim())
    }
    // 仅挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty = drafts.length > 0

  const openMoreTabs = async (count: number, withDirty: boolean) => {
    const caseNumber = Date.now().toString(36)
    for (let i = 0; i < count; i += 1) {
      // 逐个带间隔导航：每个地址生成独立页签（默认「路径+search」身份）
      navigate(`/dev/page-session-probe?case=${caseNumber}-${i}${withDirty ? '&dirty=1' : ''}`)
      await new Promise((resolve) => setTimeout(resolve, 80))
    }
    void message.info(`已发起打开 ${count} 个探针页签`)
  }

  const startControlledWrite = () => {
    if (session.tabKey === null) return
    submitWriteTask({
      tabKey: session.tabKey,
      actionKey: 'probe.controlled-write',
      detail: '探针可控写入（验证离开保护）',
      run: (ctx) =>
        new Promise((resolve) => {
          // 可控 Promise：仅探针验证任务控制器的保护判定；被停止等待/关闭
          // （signal 中止）时放弃放行资格，不模拟业务结果
          const release = () => resolve({ success: true })
          releaseControlledWrite = release
          ctx.signal.addEventListener('abort', () => {
            if (releaseControlledWrite === release) releaseControlledWrite = null
          })
        }),
    })
  }

  const protectionSummary = collectTabProtections(
    // 全页签 + 会话级：仅用于探针展示保护覆盖面
    [...(session.tabKey !== null ? [session.tabKey] : []), null],
  )

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <Title level={4}>页面会话探针（T013 验证用）</Title>
      <Text code>tabKey: {session.tabKey ?? 'null'} ｜ 实例标记: {instanceId}</Text>

      <section>
        <Title level={5}>1. 草稿（V01/V02）</Title>
        <Space wrap>
          <Button onClick={() => session.setDirty('form', '验证表单草稿')}>置脏</Button>
          <Button onClick={() => session.clearDirty('form')} disabled={!dirty}>
            解除草稿（模拟保存/重置）
          </Button>
          <Button danger onClick={() => session.tabKey !== null && void requestCloseTabs([session.tabKey])}>
            请求关闭本页签（走协调器）
          </Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type={dirty ? 'danger' : 'secondary'}>
            {dirty ? `已登记草稿：${drafts.map((d) => d.label).join('、')}（构成保护条件）` : '无草稿（无稿初始值不误标为脏）'}
          </Text>
        </div>
      </section>

      <section>
        <Title level={5}>2. 轻量状态（V06 跨 LRU 重建恢复）</Title>
        <Space wrap>
          <input
            value={inputValue}
            placeholder="输入任意标记值"
            onChange={(event) => setInputValue(event.target.value)}
          />
          <Button onClick={() => session.setLightState('probe-input', inputValue)}>保存轻量状态</Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type={restoredLight === undefined ? 'secondary' : 'success'}>
            {restoredLight === undefined
              ? '本实例挂载时无轻量状态（首次挂载或已被刷新清除）'
              : `本实例挂载时恢复自轻量状态：${restoredLight}`}
          </Text>
        </div>
      </section>

      <section>
        <Title level={5}>3. 写入任务保护（V02/V03 离开确认）</Title>
        <Space wrap>
          <Button onClick={startControlledWrite}>发起可控写入（保持执行中）</Button>
          <Button onClick={() => releaseControlledWrite?.()}>放行写入（落定成功）</Button>
          {tasks.filter((task) => task.status === 'running' || task.status === 'queued').map((task) => (
            <Button
              key={task.id}
              onClick={() => stopWaitingForWrite(task.id)}
            >
              停止等待 {task.id.slice(-4)}（转待确认）
            </Button>
          ))}
        </Space>
        <ul style={{ marginTop: 8 }}>
          {tasks.map((task) => (
            <li key={task.id}>
              <Text>
                {task.detail} · {task.status}
                {task.unknownReason ? `（${task.unknownReason}）` : ''}
              </Text>
            </li>
          ))}
          {tasks.length === 0 && <Text type="secondary">本页签暂无任务记录</Text>}
        </ul>
      </section>

      <section>
        <Title level={5}>4. 容量准入（V04）</Title>
        <Space wrap>
          <Button onClick={() => void openMoreTabs(10, false)}>打开 10 个干净探针页签</Button>
          <Button onClick={() => void openMoreTabs(10, true)}>打开 10 个带草稿探针页签</Button>
          <Button onClick={() => void openMoreTabs(1, false)}>打开 1 个干净探针页签</Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            当前保护条目：{protectionSummary.length === 0 ? '无' : protectionSummary.map((p) => p.tabKey ?? '会话级').join('；')}
          </Text>
        </div>
      </section>
    </div>
  )
}
