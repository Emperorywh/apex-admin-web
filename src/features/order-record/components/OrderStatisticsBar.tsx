/**
 * 任务状态统计条（P03）。
 *
 * 旧实现：OrderStatistics 组件 1 秒轮询统计接口 + antd Statistic 展示。
 * 新实现：数据由页面统一获取（useVisiblePolling 约 5 秒可见串行，契约集中配置），
 * 本组件只做纯展示；失败区域清空呈现真实失败态（DoD 6），恢复依赖可见轮询
 * 自动重查——视觉规范：非表格区域不设重试/刷新按钮。
 *
 * 空值纪律（DoD 14 / 规格 11.2）：后端明确返回 0 显示 0；
 * 字段缺失/null 显示「—」（与表格单元格留白规范不同：缺失必须与真实 0 可区分），
 * 不补零、不算可计算指标。
 */

import { useTranslation } from 'react-i18next'
import { Spin } from 'antd'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import type { OrderRecordStateStatisticDto } from '@/services/order-record/order.service.types'
import styles from './OrderStatisticsBar.module.css'

/** 统计指标展示定义：key 对应后端 DTO 字段，title 为中文文案 key */
const STATISTIC_ITEMS: { key: keyof OrderRecordStateStatisticDto; title: string }[] = [
  { key: 'totalNumber', title: '任务总数' },
  { key: 'successNumber', title: '已成功' },
  { key: 'executingNumber', title: '执行中' },
  { key: 'queuingNumber', title: '队列中' },
  { key: 'hangNumber', title: '已挂起' },
  { key: 'cancelNumber', title: '已取消' },
  { key: 'failNumber', title: '已失败' },
]

interface OrderStatisticsBarProps {
  /** 统计数据；null 表示尚未成功加载（区分「真实 0」） */
  statistic: OrderRecordStateStatisticDto | null
  loading: boolean
  /** 最近一次统计加载是否真正失败（取消不算） */
  error: boolean
}

export function OrderStatisticsBar({ statistic, loading, error }: OrderStatisticsBarProps) {
  const { t } = useTranslation('orderRecord')

  // 统计区域独立失败：清空数值区域呈现失败态，不设重试按钮（轮询恢复）；不用旧数据冒充成功
  if (error) {
    return (
      <div className={styles.wrap}>
        <StateBlock variant="offline" minHeight={72} />
      </div>
    )
  }

  return (
    <Spin spinning={loading && statistic === null} size="small">
      <div className={styles.wrap}>
        {STATISTIC_ITEMS.map((item) => {
          // 仅「字段真实存在且为数值」才显示数值；缺失/null 一律「—」，0 是合法值正常显示。
          // 展示层做千分位分组（大数可读性），不改协议数值本身
          const raw = statistic?.[item.key]
          const value = typeof raw === 'number' ? raw.toLocaleString() : '—'
          return (
            <div key={item.key} className={styles.item}>
              <span className={styles.title}>{t(item.title)}</span>
              <span className={styles.value}>{value}</span>
            </div>
          )
        })}
      </div>
    </Spin>
  )
}
