/**
 * 实时告警滚动列表（P34 私有组件；旧 RealtimeDashboard/RealtimeAlertList 等价迁移
 * + 合并首页导航契约）。
 *
 * 与旧实现的对应与差异：
 * - 行内容：级别 Tag（严重=红/重要=橙；未知级别按协议原值展示不臆译）、
 *   来源（sourceName 优先回退 sourceKey）、描述、发生时间、持续时长逐项同构；
 * - 描述译文回退链：当前语言 → zh_CN → en_US → 原文（resolveAlertDescription 纯函数）；
 * - 空值纪律：描述/发生时间/时长缺失一律留白（AGENTS §3），不用「--」占位；
 * - 差异（D29 合并首页导航契约，旧系统无）：来源为车辆且有权限时点击跳
 *   /vehicle-info（P39）；关联订单有权限时点击跳 /order-info（P38）。
 *   导航回调由页面宿主组装（features 域之间禁止互导，P05 完整详情同模式）；
 *   目标页面尚未交付（P36 故障告警页）时不提供入口，仅登记契约。
 * - 失败态不在本组件内：列表失败由页面以 StateBlock 呈现（本组件只渲染数据）。
 */

import { Tag, theme } from 'antd'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { formatDurationMs, resolveAlertDescription } from '@/features/dashboard/realtime'
import type { OpenAlertItem } from '@/features/dashboard/realtime'
import styles from '@/features/dashboard/components/OpenAlertList.module.css'

interface OpenAlertListProps {
  /** 未关闭告警列表（已映射展示形态） */
  items: OpenAlertItem[]
  /** 当前语言（描述译文回退链入参） */
  locale: string
  /** 级别 → 已翻译文案（FATAL/WARNING；未知级别不查表直接显示原值） */
  levelLabels: Record<string, string>
  /** 车辆详情导航回调（页面按权限组装；不传则来源显示纯文本） */
  onOpenVehicle?: (vehicleKey: string) => void
  /** 任务详情导航回调（页面按权限组装；不传则订单名显示纯文本） */
  onOpenOrder?: (orderKey: string) => void
}

export function OpenAlertList({
  items,
  locale,
  levelLabels,
  onOpenVehicle,
  onOpenOrder,
}: OpenAlertListProps) {
  // 分隔线/次要文字取 antd token：随明暗主题切换（不另维护一套明暗常量）
  const { token } = theme.useToken()

  return (
    <div className={styles.scroll} style={{ borderColor: token.colorBorderSecondary }}>
      {items.map((item) => {
        // 级别文案：仅协议两级查表翻译，未知级别按协议原值展示（不臆造语义）
        const levelKey = item.level === 'FATAL' || item.level === 'WARNING' ? item.level : null
        const levelText = levelKey ? levelLabels[levelKey] : item.level
        // 来源可导航：有回调且来源标识非空（页面已按 VEHICLE 来源 + 权限过滤）
        const vehicleClickable = Boolean(onOpenVehicle && item.sourceKey)
        const orderClickable = Boolean(onOpenOrder && item.orderKey)
        return (
          <div
            key={item.id || `${item.sourceKey}-${item.occurredAt}`}
            className={styles.row}
            style={{ borderColor: token.colorBorderSecondary }}
          >
            <div className={styles.mainLine}>
              {/* 级别 Tag：颜色 + 文字双通道表达（不只靠颜色，规格 7） */}
              <Tag color={item.level === 'FATAL' ? 'error' : 'warning'} style={{ marginInlineEnd: 0 }}>
                {levelText}
              </Tag>
              {vehicleClickable ? (
                <button
                  type="button"
                  className={styles.linkBtn}
                  style={{ color: token.colorLink }}
                  onClick={() => onOpenVehicle?.(item.sourceKey)}
                >
                  {item.sourceName}
                </button>
              ) : (
                <span className={styles.source}>{item.sourceName}</span>
              )}
              <span className={styles.time} style={{ color: token.colorTextSecondary }}>
                {displayDateTime(item.occurredAt)}
              </span>
              {/* 持续时长接口不下发，按当前时刻现算；缺失留白 */}
              <span className={styles.duration} style={{ color: token.colorTextSecondary }}>
                {item.durationMs === null ? '' : formatDurationMs(item.durationMs)}
              </span>
            </div>
            <div className={styles.descLine}>
              <span className={styles.desc} style={{ color: token.colorTextSecondary }}>
                {resolveAlertDescription(item, locale)}
              </span>
              {orderClickable ? (
                <button
                  type="button"
                  className={styles.linkBtn}
                  style={{ color: token.colorLink }}
                  onClick={() => onOpenOrder?.(item.orderKey)}
                >
                  {item.orderName || item.orderKey}
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
