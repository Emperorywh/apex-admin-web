/**
 * 任务数量统计页签（P33；旧 QuantityStatistics 组件等价迁移）。
 *
 * 数据流：挂载即按默认条件（不限时间/类型/状态/车辆）查询一次（旧 useEffect
 * 同语义）；筛选提交后按新条件重查。图表按任务状态维度分组求和展示（口径见
 * statistics.ts 与标题旁提示），未知状态显示协议原值。
 */

import { useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { ORDER_STATE_OPTIONS } from '@/constants/order/orderDisplayOptions'
import { orderQuantityStatistics } from '@/services/report-order/report-order.service'
import type { OrderQuantityStatisticsParam } from '@/services/report-order/report-order.service.types'
import { sumQuantityByState } from '@/features/analyze-visual/order-statistics/statistics'
import { useStatisticsQuery } from '@/features/analyze-visual/order-statistics/hooks/useStatisticsQuery'
import { OrderStatisticsFilter } from '@/features/analyze-visual/order-statistics/components/OrderStatisticsFilter'
import { StatisticsBarChart } from '@/features/analyze-visual/order-statistics/components/StatisticsBarChart'
import { MetricHint } from '@/features/analyze-visual/order-statistics/components/MetricHint'
import styles from '@/features/analyze-visual/order-statistics/components/StatisticsPanel.module.css'

export function QuantityStatisticsPanel() {
  // report-order 本页私有文案 + orderRecord 复用筛选标签/枚举译文（fallback 顺序查找）
  const { t } = useTranslation(['report-order', 'orderRecord'], { nsMode: 'fallback' })
  const { data, loading, error, run } = useStatisticsQuery(orderQuantityStatistics)

  // 挂载即查询（默认全量口径：时间空串=不限，集合不传=全部）；Activity 页签
  // 隐藏后恢复可见时 effect 重挂会再查一次，符合「重新激活即查」纪律
  useEffect(() => {
    run({ startTime: '', endTime: '' })
  }, [run])

  // 状态协议原值 → 当前语言展示名；未知枚举显示原值（不臆造映射，规格 18.3）
  const resolveStateLabel = useCallback(
    (state: string) => {
      const known = ORDER_STATE_OPTIONS.find((opt) => opt.value === state)
      return t(known ? known.label : state)
    },
    [t],
  )

  // 按状态分组求和（纯计算模块共用）→ 图表类目/数值；t 变化（语言切换）触发重建
  const { categories, values } = useMemo(() => {
    const rows = sumQuantityByState(data ?? [])
    return {
      categories: rows.map((row) => resolveStateLabel(row.orderState)),
      values: rows.map((row) => row.total),
    }
  }, [data, resolveStateLabel])

  // 数量值为整数计数（int64 JSON number 承载），展示不带千分位（旧实现 `${val}` 同语义）
  const formatValue = useCallback((value: number) => String(value), [])

  return (
    <div className={styles.panel}>
      <OrderStatisticsFilter
        withOrderState
        loading={loading}
        onSearch={(param) => run(param as OrderQuantityStatisticsParam)}
      />
      <div className={styles.chartArea}>
        {/* 失败清空远端数据呈现真实失败态：非表格区域不设重试按钮（按钮纪律），
            恢复依赖有限退避自动重查与用户重新查询 */}
        {error ? (
          <StateBlock variant="offline" minHeight={320} />
        ) : (
          <>
            <div className={styles.chartHeader}>
              <span className={styles.chartTitle}>{t('任务数量统计')}</span>
              {/* 口径长文案以完整简中文案为 key（zh-CN key 即文案，zh-CN 下直接展示原文；
                  其余四语言分片按同 key 提供译文），label 为操作短语 */}
              <MetricHint
                label={t('查看统计口径')}
                content={t(
                  '任务数量 = 所选条件下各任务状态的任务数量，图表按状态分组求和展示；数据由订单数量统计接口按任务类型 × 任务状态维度返回，未知状态按协议原值显示。',
                )}
              />
            </div>
            <StatisticsBarChart
              categories={categories}
              values={values}
              seriesName={t('任务数量')}
              formatValue={formatValue}
            />
          </>
        )}
      </div>
    </div>
  )
}
