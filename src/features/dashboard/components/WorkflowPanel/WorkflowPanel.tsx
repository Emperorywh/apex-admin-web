/**
 * 任务编排面板：订单履约流程图（复刻设计稿 workflow SVG 画布 + 状态节点 + 图例）。
 */

import { useTranslation } from 'react-i18next'
import type { WorkflowPanelModel } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/WorkflowPanel/WorkflowPanel.module.css'

interface WorkflowPanelProps {
  model: WorkflowPanelModel
}

/** 节点状态 → 样式类 */
const STATE_CLASS = {
  done: styles.nodeDone,
  running: styles.nodeRunning,
  pending: styles.nodePending,
} as const

/** 节点状态 → 图例圆点色 */
const STATE_DOT = {
  done: '#18ad68',
  running: '#2f7fff',
  pending: '#93a0b5',
} as const

export function WorkflowPanel({ model }: WorkflowPanelProps) {
  const { t } = useTranslation('dashboard')

  return (
    <div className="ds-card ds-card-p">
      <div className={styles.panelHead}>
        <div className={styles.titleGroup}>
          <div className="ds-card-title">{t('任务编排 / 订单履约流程')}</div>
          <div className="ds-card-sub">
            {t('流程')}：{t(model.version)}
          </div>
        </div>
        <div className={styles.tinyMeta}>
          <div>
            <strong>{t('已运行')}</strong>
            <span>{model.runningFor}</span>
          </div>
          <div>
            <strong>{t('性能指数')}</strong>
            <div className={styles.progressBar}>
              <b style={{ width: `${model.performancePercent}%` }} />
            </div>
          </div>
          <div>
            <strong>{t('全链路')}</strong>
            <span>{model.chainPercent}</span>
          </div>
        </div>
      </div>

      <div className={styles.workflow}>
        <div className={styles.labels}>
          {model.stageLabels.map((label) => (
            <div key={label}>{t(label)}</div>
          ))}
        </div>
        <div className={styles.nodeRow}>
          <div className={styles.start}>{t('开始')}</div>
          <svg className={styles.svg} viewBox="0 0 640 148" preserveAspectRatio="none" aria-hidden="true">
            {model.edges.map((edge) => (
              <path key={edge.path} d={edge.path} stroke={edge.color} strokeWidth={2} fill="none" />
            ))}
            {model.dots.map((dot) => (
              <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r={3.2} fill={dot.color} />
            ))}
          </svg>
          {model.nodes.map((node) => (
            <div
              key={node.id}
              className={`${styles.node} ${STATE_CLASS[node.state]}`}
              style={{ left: node.left, top: node.top }}
            >
              <div className={styles.nodeName}>{t(node.name)}</div>
              <div className={styles.nodeVolume}>{node.volume}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.legendRow}>
        <div className={styles.legend}>
          {(['done', 'running', 'pending'] as const).map((state) => (
            <span key={state}>
              <i style={{ background: STATE_DOT[state] }} />
              {t(
                state === 'done' ? '已完成' : state === 'running' ? '运行中' : '等待中',
              )}
            </span>
          ))}
          <span>
            <i style={{ background: '#e5484d' }} />
            {t('异常')}
          </span>
        </div>
      </div>
    </div>
  )
}
