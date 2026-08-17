/**
 * 页面级加载占位（规格 §4.2/§12；视觉 SPEC-UI §8）：路由懒加载 Suspense fallback 与
 * i18n 命名空间预加载期间的统一加载态——居中留白 + 主题色 Spin（尺寸随字号档位缩放）。
 */
import { Spin } from 'antd'
import styles from './PageLoading.module.css'

export function PageLoading() {
  return (
    <div className={styles.pageLoading} role="status" aria-label="页面加载中">
      <Spin size="large" />
    </div>
  )
}
