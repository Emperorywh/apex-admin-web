/**
 * 任务效率统计页签（P33；旧 EfficiencyStatistics 组件等价迁移）。
 *
 * 数据流与数量页签一致；差异：
 * - 筛选无任务状态字段（OpenAPI OrderEfficiencyStatisticsParam 契约无 orderStates）；
 * - 图表为三值柱：各任务类型平均总时间/执行时间/等待时间（秒）之和（口径为
 *   「各类型平均值合计」，非整体平均——statistics.ts 与标题旁提示说明）；
 * - 柱顶与悬浮数值按秒转「X时X分X秒」展示（旧 formatSecondsToTime 同语义），
 *   y 轴单位标注「时间（秒）」（协议单位，展示格式化不改协议数值）。
 */

import { useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { orderEfficiencyStatistics } from '@/services/report-order/report-order.service'
import { sumEfficiencyAverages, formatDuration } from '@/features/analyze-visual/order-statistics/statistics'
import { useStatisticsQuery } from '@/features/analyze-visual/order-statistics/hooks/useStatisticsQuery'
import { OrderStatisticsFilter } from '@/features/analyze-visual/order-statistics/components/OrderStatisticsFilter'
import { StatisticsBarChart } from '@/features/analyze-visual/order-statistics/components/StatisticsBarChart'
import { MetricHint } from '@/features/analyze-visual/order-statistics/components/MetricHint'
import styles from '@/features/analyze-visual/order-statistics/components/StatisticsPanel.module.css'

export function EfficiencyStatisticsPanel() {
  // report-order 本页私有文案 + orderRecord 复用筛选标签译文（fallback 顺序查找）
  const { t } = useTranslation(['report-order', 'orderRecord'], { nsMode: 'fallback' })
  const { data, loading, error, run } = useStatisticsQuery(orderEfficiencyStatistics)

  // 挂载即按默认条件查询（与旧 useEffect(handleQuery) 同语义）
  useEffect(() => {
    run({ startTime: '', endTime: '' })
  }, [run])

  // 三值求和（纯计算模块共用）；t 变化（语言切换）触发图表重建
  const summary = useMemo(() => sumEfficiencyAverages(data ?? []), [data])

  // x 轴类目：三个耗时口径（当前语言）；顺序与旧实现一致（总/执行/等待）
  const categories = useMemo(
    () => [t('平均总时间'), t('平均执行时间'), t('平均等待时间')],
    [t],
  )
  const values = useMemo(
    () => [summary.averageTime, summary.averageExecutionTime, summary.averageWaitTime],
    [summary],
  )

  // 秒 → 「X时X分X秒」（单元词经 t 翻译，语言切换后重建；0 与负数显示「0秒」）
  const formatValue = useCallback((value: number) => formatDuration(value, t), [t])

  return (
    <div className={styles.panel}>
      <OrderStatisticsFilter
        withOrderState={false}
        loading={loading}
        onSearch={(param) =>
          run({
            startTime: param.startTime,
            endTime: param.endTime,
            orderTypes: param.orderTypes,
            vehicleKeys: param.vehicleKeys,
          })
        }
      />
      <div className={styles.chartArea}>
        {error ? (
          <StateBlock variant="offline" minHeight={320} />
        ) : (
          <>
            <div className={styles.chartHeader}>
              <span className={styles.chartTitle}>{t('任务效率统计')}</span>
              {/* 口径长文案以完整简中文案为 key（zh-CN key 即文案）；说明各类型
                  平均值合计口径与协议字段，与 statistics.ts 计算口径一致 */}
              <MetricHint
                label={t('查看统计口径')}
                content={t(
                  '三个柱值分别为各任务类型平均总时间、平均执行时间、平均等待时间（秒）之和（接口字段 orderAverageTime / orderAverageExecutionTime / orderAverageWaitTime）；口径为各类型平均值合计，与旧系统一致，不等于全部订单的整体平均。',
                )}
              />
            </div>
            <StatisticsBarChart
              categories={categories}
              values={values}
              seriesName={t('时间')}
              yAxisName={t('时间（秒）')}
              formatValue={formatValue}
              colorCount={3}
            />
          </>
        )}
      </div>
    </div>
  )
}
