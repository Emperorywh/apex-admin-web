/**
 * 【临时验证探针，不入生产】T011 会话任务层隔离验证页。
 * 提交前从 src 与路由移除，副本留存 docs/migration/evidence/T011/probe/。
 *
 * 覆盖场景：
 * - W1 慢写入成功 / W2 丢回执待确认 / W3 业务失败 / W4 停止等待 / W5 旧会话迟到
 * - T1 上传成功（onSuccess 后处理）/ T2 服务端处理不误判停滞 / T3 上传中取消
 * - T4 上传停滞中止 / T5 上传业务失败 / T6 网关 HTML 不可判读
 * - 任务记录跨导航保留（原页恢复订阅）
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Space, Table, Typography } from 'antd'
import { login } from '@/services/auth/auth.service'
import { legacyPost } from '@/services/request/legacy/legacyRequest'
import {
  dismissWriteTask,
  startTransferTask,
  stopWaitingForWrite,
  submitWriteTask,
  useSessionTasksSnapshot,
} from '@/services/session-tasks'
import type { TransferTaskRecord, WriteTaskRecord } from '@/services/session-tasks'

const TAB_KEY = 'dev/task-probe'

const WRITE_URL = '/fms/v1/dev/write'
const UPLOAD_URL = '/fms/v1/dev/upload'

function makeBlobForm(name: string, sizeMb: number): FormData {
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(sizeMb * 1024 * 1024)], { type: 'application/zip' }), name)
  return formData
}

/** 供自动化读取页面事件日志（window 镜像，SPA 导航后仍在） */
function returnLogsMirror(): void {
  const holder = window as unknown as { __t11Logs?: string[] }
  holder.__t11Logs = holder.__t11Logs ?? []
}

/** 每次渲染把当前快照镜像到 window，供自动化任意时刻采样任务状态 */
function renderSnapshotMirror(snapshot: ReturnType<typeof useSessionTasksSnapshot>): void {
  ;(window as unknown as { __t11Last?: unknown }).__t11Last = {
    writes: snapshot.writes.map((w) => ({
      id: w.id,
      detail: w.detail,
      status: w.status,
      unknownReason: w.unknownReason,
      biz: w.error?.bizMessage,
      submittedAt: w.submittedAt,
      finishedAt: w.finishedAt,
    })),
    transfers: snapshot.transfers.map((tr) => ({
      id: tr.id,
      name: tr.name,
      status: tr.status,
      phase: tr.phase,
      percent: tr.percent,
      loaded: tr.loaded,
      total: tr.total,
      lengthComputable: tr.lengthComputable,
      resultUnknown: tr.resultUnknown,
      error: tr.error?.title,
    })),
  }
}

export default function TaskProbe() {
  const { t } = useTranslation('common')
  const snapshot = useSessionTasksSnapshot()
  const [logs, setLogs] = useState<string[]>([])
  const [pendingStopId, setPendingStopId] = useState<string | null>(null)

  const pushLog = (line: string): void => {
    // 日志镜像进 window：SPA 导航（切页/进全屏）后组件重挂载、state 重置，
    // 而 window 存活——回执在隐藏期间到达的证据由此保留
    const logsMirror = (window as unknown as { __t11Logs?: string[] })
    logsMirror.__t11Logs = logsMirror.__t11Logs ?? []
    logsMirror.__t11Logs.push(`${new Date().toLocaleTimeString()} ${line}`)
    setLogs((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 40))
  }

  returnLogsMirror()
  renderSnapshotMirror(snapshot)

  const submitWrite = (tag: string, delay: number, options?: { fail?: boolean; onSuccess?: () => void }): void => {
    const handle = submitWriteTask({
      tabKey: TAB_KEY,
      actionKey: `dev.write.${tag}`,
      detail: `写入场景 ${tag}`,
      run: (ctx) =>
        legacyPost(`${WRITE_URL}?tag=${tag}&delay=${delay}${options?.fail ? '&fail=1' : ''}`, { at: Date.now() }, { signal: ctx.signal }),
      onSuccess: () => {
        pushLog(`W[${tag}] onSuccess 后处理已触发`)
        options?.onSuccess?.()
      },
    })
    pushLog(`W[${tag}] 提交 id=${handle.id}`)
    if (tag === 'w4') setPendingStopId(handle.id)
    void handle.settled.then((record) => pushLog(`W[${tag}] 落定 ${record ? record.status : '记录已清除'}`))
  }

  const submitTransfer = (tag: string, query: string, sizeMb: number, stallTimeoutMs?: number): void => {
    const handle = startTransferTask({
      tabKey: TAB_KEY,
      kind: 'dev',
      name: `${tag}.zip`,
      url: `${UPLOAD_URL}?tag=${tag}&${query}`,
      formData: makeBlobForm(`${tag}.zip`, sizeMb),
      stallTimeoutMs,
      onSuccess: () => pushLog(`T[${tag}] onSuccess 后处理已触发`),
    })
    pushLog(`T[${tag}] 提交 id=${handle.id}`)
    if (tag === 't3') {
      // 800ms 后取消：此时字节已在发送/已发出（服务端 delay=8000 未回）
      setTimeout(() => {
        import('@/services/session-tasks').then((mod) => {
          mod.cancelTransferTask(handle.id)
          pushLog(`T[t3] 已请求取消`)
        })
      }, 800)
    }
    void handle.settled.then((record) => pushLog(`T[${tag}] 落定 ${record ? `${record.status}${record.resultUnknown ? '(结果待确认)' : ''}` : '记录已清除'}`))
  }

  const writeColumns = [
    { title: 'detail', dataIndex: 'detail' },
    { title: 'status', dataIndex: 'status' },
    { title: 'unknown', dataIndex: 'unknownReason' },
    { title: 'biz', dataIndex: ['error', 'bizMessage'], render: (v: string | undefined) => v ?? '-' },
    { title: 't', dataIndex: 'submittedAt', render: (v: number, r: WriteTaskRecord) => `${new Date(v).toLocaleTimeString()}${r.finishedAt ? `→${new Date(r.finishedAt).toLocaleTimeString()}` : ''}` },
  ]
  const transferColumns = [
    { title: 'name', dataIndex: 'name' },
    { title: 'status', dataIndex: 'status' },
    { title: 'phase', dataIndex: 'phase' },
    { title: '%', dataIndex: 'percent', render: (v: number | null) => (v === null ? '-' : v.toFixed(0)) },
    { title: 'loaded/total', render: (_: unknown, r: TransferTaskRecord) => `${(r.loaded / 1048576).toFixed(1)}MB / ${r.lengthComputable ? `${(r.total / 1048576).toFixed(1)}MB` : '?'}` },
    { title: 'unknown?', dataIndex: 'resultUnknown', render: (v: boolean) => (v ? '待确认' : '-') },
    { title: 'err', dataIndex: ['error', 'title'], render: (v: string | undefined) => v ?? '-' },
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={4}>T011 会话任务探针</Typography.Title>
      <Space wrap>
        <Button onClick={() => submitWrite('w1', 3000)}>W1 慢写入 3s</Button>
        <Button onClick={() => submitWrite('w2', 20000)}>W2 丢回执 20s</Button>
        <Button onClick={() => submitWrite('w3', 500, { fail: true })}>W3 业务失败</Button>
        <Button onClick={() => submitWrite('w4', 8000)}>W4 停止等待目标</Button>
        <Button
          disabled={pendingStopId === null}
          onClick={() => {
            if (pendingStopId) stopWaitingForWrite(pendingStopId)
            pushLog(`W4 停止等待已请求`)
            setPendingStopId(null)
          }}
        >
          W4 停止等待
        </Button>
        <Button onClick={() => submitWrite('w5', 6000)}>W5 迟到目标</Button>
        <Button
          onClick={() => {
            void login({ username: 'root', password: 'root' }).then(() => pushLog('会话已切换（epoch+1，记录应被清空）'))
          }}
        >
          切换会话
        </Button>
      </Space>
      <Space wrap>
        <Button onClick={() => submitTransfer('t1', 'mode=ok&delay=0', 6)}>T1 上传成功 6MB</Button>
        <Button onClick={() => submitTransfer('t2', 'mode=ok&delay=5000', 6, 1500)}>T2 处理中5s(停滞1.5s)</Button>
        <Button onClick={() => submitTransfer('t3', 'mode=ok&delay=8000', 30)}>T3 上传后取消 30MB</Button>
        <Button onClick={() => submitTransfer('t4', 'stallMid=1', 30, 1500)}>T4 停滞中止</Button>
        <Button onClick={() => submitTransfer('t5', 'mode=fail&delay=300', 2)}>T5 业务失败</Button>
        <Button onClick={() => submitTransfer('t6', 'mode=html&delay=300', 2)}>T6 网关HTML</Button>
        <Button
          onClick={() => {
            snapshot.writes.forEach((w) => dismissWriteTask(w.id))
            pushLog('已清除全部写入记录')
          }}
        >
          清写入记录
        </Button>
      </Space>
      <Typography.Text strong>写入任务（快照 {snapshot.writes.length} 条）</Typography.Text>
      <Table size="small" rowKey="id" columns={writeColumns} dataSource={snapshot.writes} pagination={false} />
      <Typography.Text strong>传输任务（快照 {snapshot.transfers.length} 条）</Typography.Text>
      <Table size="small" rowKey="id" columns={transferColumns} dataSource={snapshot.transfers} pagination={false} />
      <Typography.Text strong>页面事件日志</Typography.Text>
      <pre style={{ fontSize: 12, maxHeight: 240, overflow: 'auto', margin: 0 }}>{logs.join('\n')}</pre>
      <Typography.Text type="secondary">{t('调度系统')}</Typography.Text>
    </div>
  )
}
