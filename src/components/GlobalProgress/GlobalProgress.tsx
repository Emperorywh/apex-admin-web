/**
 * 全局导航进度条：Data Router navigation 非 idle 时延迟显示，避免快速导航闪烁。
 */

import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router'
import styles from '@/components/GlobalProgress/GlobalProgress.module.css'

/** 全局进度条延迟显示时间（毫秒）；短于该值的导航不显示，避免闪烁 */
const GLOBAL_PROGRESS_DELAY_MS = 120

export function GlobalProgress() {
  const navigation = useNavigation()
  const busy = navigation.state !== 'idle'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!busy) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), GLOBAL_PROGRESS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [busy])

  if (!visible) return null
  return <div className={styles.bar} role="progressbar" aria-label="页面加载中" />
}
