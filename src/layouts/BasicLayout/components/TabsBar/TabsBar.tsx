/**
 * 页签栏占位（规格 §11.1/§9）：本任务只提供稳定挂载点与容器样式——侧边与顶部
 * 双布局共用同一挂载位置，随外壳持久存在、布局热切换不重挂载；
 * 页签交互、Activity 缓存与 LRU、页签 aria 语义归 TASK-011 在本容器内实现。
 */
import styles from './TabsBar.module.css'

export function TabsBar() {
  return <div className={styles.tabsBar} data-region="tabs-bar" />
}
