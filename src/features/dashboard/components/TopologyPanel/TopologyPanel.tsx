/**
 * 资源拓扑面板：健康评分环 + 服务健康清单 + 区域拓扑画布（复刻设计稿）。
 */

import { useTranslation } from 'react-i18next'
import { Dropdown } from 'antd'
import { ChevronDown, Expand } from 'lucide-react'
import type { TopologyPanelModel } from '@/types/dashboard/dashboard.types'
import styles from '@/features/dashboard/components/TopologyPanel/TopologyPanel.module.css'

interface TopologyPanelProps {
  model: TopologyPanelModel
}

/** 中心节点与区域节点的连线（viewBox 420x252） */
const REGION_LINES = [
  { from: [217, 126], to: [120, 58] },
  { from: [217, 126], to: [330, 58] },
  { from: [217, 126], to: [120, 186] },
  { from: [217, 126], to: [344, 186] },
] as const

export function TopologyPanel({ model }: TopologyPanelProps) {
  const { t } = useTranslation('dashboard')

  return (
    <div className="ds-card ds-card-p">
      <div className={styles.head}>
        <div className="ds-card-title">{t('资源拓扑')}</div>
        <div className={styles.actions}>
          <Dropdown
            trigger={['click']}
            menu={{ items: [{ key: 'logic', label: t('视图：逻辑拓扑') }, { key: 'physical', label: t('视图：物理拓扑') }] }}
          >
            <button type="button" className="ds-control">
              <span>{t('视图：逻辑拓扑')}</span>
              <ChevronDown size={14} />
            </button>
          </Dropdown>
          <button type="button" className="ds-control ds-icon-btn" title={t('全屏查看')}>
            <Expand size={15} />
          </button>
        </div>
      </div>
      <div className={styles.body}>
        <div>
          <div className={styles.scoreRing} role="img" aria-label={`${t('健康评分')} ${model.score}`}>
            <div className={styles.scoreCenter}>
              <small>{t('健康评分')}</small>
              <strong>{model.score}</strong>
              <span>{t(model.scoreLabel)}</span>
            </div>
          </div>
          <div className={styles.healthList}>
            {model.healthItems.map((item) => (
              <div key={item.id} className={styles.healthItem}>
                <span>
                  <i className={styles.greenDot} />
                  {t(item.name)}
                </span>
                <b>{item.ready}</b>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.canvas}>
          <div className={styles.mapDots} />
          <svg className={styles.svg} viewBox="0 0 420 252" aria-hidden="true">
            <defs>
              <filter id="topologyGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#2f7fff" floodOpacity="0.22" />
              </filter>
              <linearGradient id="topologyGradCenter" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#56a0ff" />
                <stop offset="100%" stopColor="#1f6eff" />
              </linearGradient>
            </defs>
            {REGION_LINES.map((line) => (
              <line
                key={`${line.to[0]}-${line.to[1]}`}
                x1={line.from[0]}
                y1={line.from[1]}
                x2={line.to[0]}
                y2={line.to[1]}
                stroke="#2f7fff"
                strokeWidth="2.1"
              />
            ))}
            <g filter="url(#topologyGlow)">
              <circle cx="217" cy="126" r="33" fill="url(#topologyGradCenter)" stroke="#76afff" strokeWidth="2" />
            </g>
            <rect x="205" y="116" width="24" height="20" rx="4" fill="rgba(255,255,255,.96)" />
            <line x1="210" y1="121" x2="224" y2="121" stroke="#2f7fff" strokeWidth="1.8" />
            <line x1="210" y1="126" x2="220" y2="126" stroke="#2f7fff" strokeWidth="1.8" />
            <line x1="210" y1="131" x2="218" y2="131" stroke="#2f7fff" strokeWidth="1.8" />
            {model.regions.map((region) => (
              <g key={region.id}>
                <circle cx={region.x} cy={region.y} r="21" fill="rgba(255,255,255,.97)" stroke="#2f7fff" strokeWidth="2" />
                <rect x={region.x - 9} y={region.y - 8} width="18" height="14" rx="2.5" fill="#2f7fff" opacity="0.95" />
                <rect x={region.x - 5} y={region.y - 4} width="4" height="3" rx="1" fill="#fff" />
                <rect x={region.x + 1} y={region.y - 4} width="4" height="3" rx="1" fill="#fff" />
                <text x={region.x - 19} y={region.y + 32} className={styles.nodeTitle}>
                  {t(region.name)}
                </text>
                <text x={region.x - 14} y={region.y + 52} className={styles.nodeSub}>
                  {t(region.sub)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}
