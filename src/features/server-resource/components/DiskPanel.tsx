/**
 * 磁盘分区列表（P40，旧 DiskList.tsx 等价迁移 + 双主题化）。
 *
 *   - 每行：严重程度状态点 + 挂载路径/设备名 + 使用率 + 渐变进度条 + 用量明细；
 *   - 进度条宽度带 CSS transition，轮询更新时平滑变化（按挂载路径作 key 稳定复用行）；
 *   - 行悬停时通过 onTip 上抛悬浮提示（使用率 / 已用·总量 / 空闲）；
 *   - 使用率缺失（normRate → null）时该行数值显示「--」、进度条隐藏，
 *     不显示虚假 0%（任务卡专项验收）；容量字段缺失留白；
 *   - disks 为 null（失败降级/未加载）或空数组（真实无分区）都展示空态文案。
 */
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiskInfoDto } from '@/services/server-resource/server-resource.service.types'
import type { TipRow } from '../resourcePolicy'
import { hexA, normRate, sevOf } from '../resourcePolicy'
import styles from './DiskPanel.module.css'

export interface DiskPanelProps {
  /** 磁盘分区列表；null 表示无数据（失败降级/未加载） */
  disks: DiskInfoDto[] | null
  onTip: (x: number, y: number, title: string, rows: TipRow[]) => void
  onTipHide: () => void
}

export function DiskPanel({ disks, onTip, onTipHide }: DiskPanelProps) {
  const { t } = useTranslation('server-resource')

  if (!disks || disks.length === 0) {
    return (
      <div className={styles.diskList}>
        <div className={styles.diskEmpty}>{t('暂无磁盘数据')}</div>
      </div>
    )
  }

  return (
    <div className={styles.diskList}>
      {disks.map((d, idx) => {
        const rate = normRate(d.usageRate)
        const sev = rate === null ? null : sevOf(rate)
        const title = `${d.device ?? ''}  ${d.mountPath ?? ''}`.trim() || t('磁盘分区')
        const handleMove = (e: MouseEvent) =>
          onTip(e.clientX, e.clientY, title, [
            {
              color: sev ? sev.c : '#8a93a6',
              name: t('使用率'),
              value: rate === null ? '--' : `${rate.toFixed(1)} %`,
            },
            { color: '#3987e5', name: t('已用 / 总量'), value: `${d.used ?? ''} / ${d.total ?? ''}` },
            { color: '#199e70', name: t('空闲'), value: d.free ?? '' },
          ])
        return (
          <div
            className={styles.diskRow}
            key={d.mountPath || d.device || idx}
            onMouseMove={handleMove}
            onMouseLeave={onTipHide}
          >
            <div className={styles.rowTop}>
              {/* 状态点：缺失时中性灰（不冒充正常档） */}
              <span
                className={styles.rowDot}
                style={
                  sev
                    ? { background: sev.dot, boxShadow: `0 0 6px ${sev.dot}` }
                    : { background: 'var(--app-text-4)' }
                }
              />
              <span className={styles.rowName}>{d.mountPath || d.device || ''}</span>
              {/* 设备名与挂载路径相同时不重复展示 */}
              <span className={styles.rowDev}>{d.device && d.device !== d.mountPath ? d.device : ''}</span>
              <span className={styles.rowPct}>{rate === null ? '--' : `${rate.toFixed(1)} %`}</span>
            </div>
            <div className={styles.rowBar}>
              <div
                className={styles.rowFill}
                style={{
                  width: rate === null ? 0 : `${rate}%`,
                  visibility: rate === null ? 'hidden' : 'visible',
                  background: sev
                    ? `linear-gradient(90deg, ${hexA(sev.c, 0.8)}, ${sev.c})`
                    : undefined,
                  boxShadow: sev ? `0 0 8px ${hexA(sev.c, 0.5)}` : undefined,
                }}
              />
            </div>
            <div className={styles.rowSub}>
              {/* 容量字段缺失留白（空值纪律），不显示「—」占位 */}
              {t('已用 {{used}} / 共 {{total}} · 空闲 {{free}}', {
                used: d.used ?? '',
                total: d.total ?? '',
                free: d.free ?? '',
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
