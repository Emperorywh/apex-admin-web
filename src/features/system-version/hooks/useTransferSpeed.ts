/**
 * 传输速度/剩余时间采样 hook（P25；上传与下载进度弹窗共用）。
 *
 * 旧实现同款算法：3 秒滑动窗口样本计算平滑速度（MB/s）与剩余秒数；
 * 仅 total 可信（非空且 >0）时计算剩余时间，速度 <=0 或总长未知时不产出
 * 有效 ETA（展示层显示空串），不伪造估算。
 *
 * 采样频率控制：axios 进度事件已较高频，窗口样本量天然受限（3 秒），
 * 不再额外节流；样本序列存 ref，不触发渲染——速度/剩余时间通过 state
 * 返回，仅在数值变化时驱动进度弹窗重绘。
 */

import { useCallback, useRef, useState } from 'react'

export interface TransferSpeedSampling {
  /** 当前平滑速度 MB/s（窗口样本不足时为 0） */
  speedMBps: number
  /** 剩余秒数（速度 <=0 或总长未知时为 0，展示层按空串处理） */
  etaSeconds: number
  /** 采样入口：每次传输进度回调时调用 */
  sample: (loaded: number, total: number | null) => void
  /** 重置（每次传输开始前调用） */
  reset: () => void
}

export function useTransferSpeed(): TransferSpeedSampling {
  const [speedMBps, setSpeedMBps] = useState(0)
  const [etaSeconds, setEtaSeconds] = useState(0)
  // 速度采样序列（仅保留最近 3 秒），存 ref 避免高频进度事件触发渲染
  const samplesRef = useRef<{ loaded: number; ts: number }[]>([])

  const sample = useCallback((loaded: number, total: number | null) => {
    const now = Date.now()
    const samples = samplesRef.current
    samples.push({ loaded, ts: now })
    // 滑动窗口：丢弃 3 秒之前的样本
    const cutoff = now - 3000
    while (samples.length > 1 && samples[0].ts < cutoff) {
      samples.shift()
    }
    const first = samples[0]
    const dtSeconds = (now - first.ts) / 1000
    if (samples.length >= 2 && dtSeconds > 0) {
      const bytesPerSec = (loaded - first.loaded) / dtSeconds
      setSpeedMBps(bytesPerSec / 1024 / 1024)
      setEtaSeconds(
        bytesPerSec > 0 && total !== null && total > 0 ? (total - loaded) / bytesPerSec : 0,
      )
    }
  }, [])

  const reset = useCallback(() => {
    samplesRef.current = []
    setSpeedMBps(0)
    setEtaSeconds(0)
  }, [])

  return { speedMBps, etaSeconds, sample, reset }
}
