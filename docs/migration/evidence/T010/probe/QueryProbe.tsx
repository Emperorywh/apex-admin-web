/**
 * 【验证探针，仅复现用，不在 src 中】T010 查询控制器探针（2026-09-16 验收收尾轮实际使用版本）：
 * 双实例（独立链路）：A 带 1 秒轮询、B 不轮询——B 仅在挂载与可见性恢复时
 * 各发一次请求，使"恢复立即请求"（V03b）与"关闭/隐藏中止在途"（V04、document 分支）
 * 的时间线证据无歧义。复现时以 /query-probe 临时路由挂回（提交前从 src 移除）。
 */

import { useState } from 'react'
import { legacyGet } from '@/services/request/legacy/legacyRequest'
import { PAGE_POLLING, usePageQuery } from '@/hooks/page-query'
import type { PagePollingPolicy } from '@/hooks/page-query'

interface QueryEcho {
  tag: string
  servedAt: string
}

interface ProbeParams {
  tag: string
  delay: number
  fail: number
}

/** 探针实例：polling 缺省即不轮询；fetch 会计入局部计数，用于目视断言请求发起时机 */
function ProbeInstance({
  id,
  initial,
  polling,
}: {
  id: string
  initial: ProbeParams
  polling?: PagePollingPolicy
}) {
  const [params, setParams] = useState<ProbeParams>(initial)
  const [issued, setIssued] = useState(0)

  const page = usePageQuery<ProbeParams, QueryEcho>({
    fetcher: (p, { signal }) => {
      setIssued((n) => n + 1)
      return legacyGet<QueryEcho>('/fms/v1/dev/query', { ...p }, { signal })
    },
    params,
    polling,
  })

  return (
    <section
      data-probe={id}
      style={{ border: '1px solid #888', padding: 12, margin: 12, maxWidth: 560, fontFamily: 'monospace' }}
    >
      <h3>实例 {id}{polling ? '（轮询）' : '（不轮询）'}</h3>
      <div>
        tag:
        <input
          value={params.tag}
          onChange={(event) => setParams((prev) => ({ ...prev, tag: event.target.value }))}
        />
        delay(ms):
        <input
          type="number"
          value={params.delay}
          onChange={(event) => setParams((prev) => ({ ...prev, delay: Number(event.target.value) }))}
        />
        <button onClick={() => setParams((prev) => ({ ...prev, fail: prev.fail ? 0 : 1 }))}>
          {params.fail ? '恢复成功' : '注入失败'}
        </button>
      </div>
      <ul>
        <li>data.tag: {page.data?.tag ?? 'null'}</li>
        <li>data.servedAt: {page.data?.servedAt ?? '-'}</li>
        <li>loading: {String(page.loading)}｜refreshing: {String(page.refreshing)}</li>
        <li>failureCount: {page.failureCount}</li>
        <li>error: {page.error?.title ?? '-'}</li>
        <li>issued(发起计数): {issued}</li>
      </ul>
    </section>
  )
}

export default function QueryProbe() {
  return (
    <div style={{ padding: 16 }}>
      <h2>T010 查询探针（临时页面）</h2>
      <ProbeInstance id="A" initial={{ tag: 'A0', delay: 0, fail: 0 }} polling={PAGE_POLLING.taskRecords} />
      <ProbeInstance id="B" initial={{ tag: 'B0', delay: 0, fail: 0 }} />
    </div>
  )
}
