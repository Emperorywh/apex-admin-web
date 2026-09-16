/**
 * 【临时验证页，提交前移除】T010 查询控制器探针：
 * 双实例（独立链路）+ 1 秒轮询 + 可控 tag/delay/fail，用于采集
 * 慢请求竞态、连续失败、隐藏/恢复与关闭销毁的请求时间线。
 * 源码副本保留在 docs/migration/evidence/T010/probe/ 供复现。
 */

import { useState } from 'react'
import { legacyGet } from '@/services/request/legacy/legacyRequest'
import { PAGE_POLLING, usePageQuery } from '@/hooks/page-query'

interface QueryEcho {
  tag: string
  servedAt: string
}

interface ProbeParams {
  tag: string
  delay: number
  fail: number
}

/** 探针实例：把 fetch 会计入局部计数，用于目视断言“在途 + 定时器”不堆叠 */
function ProbeInstance({ id, initial }: { id: string; initial: ProbeParams }) {
  const [params, setParams] = useState<ProbeParams>(initial)
  const [issued, setIssued] = useState(0)

  const page = usePageQuery<ProbeParams, QueryEcho>({
    fetcher: (p, { signal }) => {
      setIssued((n) => n + 1)
      return legacyGet<QueryEcho>('/fms/v1/dev/query', { ...p }, { signal })
    },
    params,
    polling: PAGE_POLLING.taskRecords,
  })

  return (
    <section
      data-probe={id}
      style={{ border: '1px solid #888', padding: 12, margin: 12, maxWidth: 560, fontFamily: 'monospace' }}
    >
      <h3>实例 {id}</h3>
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
      <ProbeInstance id="A" initial={{ tag: 'A0', delay: 0, fail: 0 }} />
      <ProbeInstance id="B" initial={{ tag: 'B0', delay: 0, fail: 0 }} />
    </div>
  )
}
