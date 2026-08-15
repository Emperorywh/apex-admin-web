/**
 * 全局进度条（规格 §7.4-8）：
 * 读取 app slice 的 loadingCount，请求进行中显示顶部进度条；
 * 计数归零后按 GLOBAL_PROGRESS_HIDE_DELAY_MS 延迟收起，期间计数回升则取消收起，
 * 避免短促请求导致进度条闪烁。请求的计数与去重由请求层负责，本组件只消费数字。
 */
import { GLOBAL_PROGRESS_HIDE_DELAY_MS } from '@/constants/app.constants'
import { appI18n, COMMON_NAMESPACE } from '@/i18n/i18n'
import type { RootState } from '@/store/store'
import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import styles from './GlobalProgress.module.css'

export function GlobalProgress() {
  const loadingCount = useSelector((state: RootState) => state.app.loadingCount)
  const [visible, setVisible] = useState(loadingCount > 0)

  useEffect(() => {
    if (loadingCount > 0) {
      setVisible(true)
      return
    }
    // 归零后延迟收起：延迟窗口内计数回升会重跑本 effect 并取消定时器（规格 §7.4-8）
    const hideTimer = window.setTimeout(() => {
      setVisible(false)
    }, GLOBAL_PROGRESS_HIDE_DELAY_MS)
    return () => {
      window.clearTimeout(hideTimer)
    }
  }, [loadingCount])

  if (!visible) {
    return null
  }
  return (
    <div className={styles.progressBar} role="progressbar" aria-label={appI18n.t('加载中', { ns: COMMON_NAMESPACE })}>
      <div className={styles.indicator} />
    </div>
  )
}
