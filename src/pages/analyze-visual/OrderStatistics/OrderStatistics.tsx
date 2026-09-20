/**
 * 任务统计页（P33 整页交付；旧 AnalyzeVisual/OrderStatistics 等价迁移）。
 *
 * 旧实现：antd Tabs 双页签——「任务数量统计」（POST orderQuantityStatistics）
 * 与「任务效率统计」（POST orderEfficiencyStatistics），各带筛选表单 + ECharts
 * 柱状图。新实现保持同一业务结构：
 * - 双页签懒挂载（旧 Tabs 默认行为同语义）：数量/效率筛选与数据互不干扰；
 * - 接口为查询性质 POST（统计报表查询，无副作用），可安全重查/自动恢复；
 * - 页面骨架仅做容器与页签，业务在各面板组件（features 私有模块）。
 *
 * 范围说明（D24 历史页面纪律的例外登记）：旧 .umirc.ts 中该路由处于注释状态
 * （不可达），规格 3.3 与 TASKS P33 明确将其列为迁移项（用户决策优先），
 * 权限码沿用旧 PERM 定义 statistics:order:view，事实与依据登记交接记录。
 */

import { Tabs } from 'antd'
import { useTranslation } from 'react-i18next'
import { QuantityStatisticsPanel } from '@/features/analyze-visual/order-statistics/components/QuantityStatisticsPanel'
import { EfficiencyStatisticsPanel } from '@/features/analyze-visual/order-statistics/components/EfficiencyStatisticsPanel'
import styles from './OrderStatistics.module.css'

export default function OrderStatistics() {
  // report-order 本页私有文案 + orderRecord 复用筛选标签/枚举译文（fallback 顺序查找）
  const { t } = useTranslation(['report-order', 'orderRecord'], { nsMode: 'fallback' })

  return (
    <div className={styles.page}>
      <Tabs
        defaultActiveKey="quantity"
        className={styles.tabs}
        items={[
          {
            key: 'quantity',
            label: t('任务数量统计'),
            children: <QuantityStatisticsPanel />,
          },
          {
            key: 'efficiency',
            label: t('任务效率统计'),
            children: <EfficiencyStatisticsPanel />,
          },
        ]}
      />
    </div>
  )
}
