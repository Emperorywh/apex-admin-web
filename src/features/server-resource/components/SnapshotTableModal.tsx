/**
 * 实时数据表格弹窗（P40，旧 DataTableOverlay 等价迁移）。
 *
 * 当前快照的表格等价呈现：以表格列出 CPU / 内存 / JVM / 各磁盘分区。
 * 与旧实现的差异（登记 tasks/P40.md）：
 * - 旧实现为自绘 HTML table 浮层——按 A07（全部表格统一 ApexTableReact，
 *   禁止自绘 table 替代）改为 antd Modal + ApexTableReact data 模式
 *   （真实完整小集合快照，DoD 5 的 data 模式形态）；
 * - 旧实现 Escape/点遮罩关闭、打开时焦点管理由 antd Modal 等价提供；
 * - 数值缺失（不可计算）：当前值留白（不显示 0，也不显示「—」——
 *   表格单元格空值纪律）；快照为 null（失败降级）时表格为空，仅底部展示数据源状态。
 */
import { useMemo } from 'react'
import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import type { ApexColumnDef } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import type { ServerResourceSnapshotDto } from '@/services/server-resource/server-resource.service.types'
import { normRate, sevOf } from '../resourcePolicy'
import styles from './SnapshotTableModal.module.css'

export interface SnapshotTableModalProps {
  open: boolean
  /** 当前快照；null 表示失败降级/未加载（表格为空） */
  snapshot: ServerResourceSnapshotDto | null
  /** 最近一次成功采集的毫秒时间戳；null 表示尚未成功过 */
  lastSuccessAt: number | null
  /** 数据源说明文案（已翻译：实时接口 / 连接失败） */
  sourceText: string
  onClose: () => void
}

/** 表格行：指标 / 当前值 / 详情 */
interface SnapshotRow {
  /** 稳定行 ID：指标标识（快照行集合固定，不随语言变化） */
  key: string
  metric: string
  current: string
  detail: string
}

export function SnapshotTableModal({
  open,
  snapshot,
  lastSuccessAt,
  sourceText,
  onClose,
}: SnapshotTableModalProps) {
  const { t, i18n } = useTranslation('server-resource')
  const apexLocale = useApexLocale()

  // 组装表格行（依赖 snapshot 与语言；缺失值留白，不补 0）
  const rows = useMemo<SnapshotRow[]>(() => {
    if (!snapshot) return []
    const cpu = normRate(snapshot.systemCpuLoad)
    const mem = normRate(snapshot.systemMemoryUsageRate)
    const jvm = normRate(snapshot.jvmHeapUsageRate)
    const pct = (v: number | null) => (v === null ? '' : `${v.toFixed(1)} %`)
    const list: SnapshotRow[] = [
      {
        key: 'cpu',
        metric: t('CPU 使用率'),
        current: pct(cpu),
        detail: t('{{cores}} 逻辑核心 · 状态 {{status}}', {
          cores: snapshot.cpuCores ?? '',
          // 使用率缺失时状态无从判定，留白（不冒充「正常」）
          status: cpu === null ? '' : t(sevOf(cpu).t),
        }),
      },
      {
        key: 'mem',
        metric: t('系统内存使用率'),
        current: pct(mem),
        detail: t('总 {{total}} · 已用 {{used}} · 空闲 {{free}}', {
          total: snapshot.systemMemoryTotal ?? '',
          used: snapshot.systemMemoryUsed ?? '',
          free: snapshot.systemMemoryFree ?? '',
        }),
      },
      {
        key: 'jvm',
        metric: t('JVM 堆使用率'),
        current: pct(jvm),
        detail: t('最大 {{max}} · 已用 {{used}} · 状态 {{status}}', {
          max: snapshot.jvmHeapMax ?? '',
          used: snapshot.jvmHeapUsed ?? '',
          status: jvm === null ? '' : t(sevOf(jvm).t),
        }),
      },
    ]
    for (const d of snapshot.disks ?? []) {
      const rate = normRate(d.usageRate)
      list.push({
        key: `disk-${d.mountPath || d.device || list.length}`,
        metric: t('磁盘 {{name}}', { name: d.mountPath || d.device || '' }),
        current: pct(rate),
        detail: t('设备 {{device}} · 总 {{total}} · 已用 {{used}} · 空闲 {{free}}', {
          device: d.device ?? '',
          total: d.total ?? '',
          used: d.used ?? '',
          free: d.free ?? '',
        }),
      })
    }
    return list
  }, [snapshot, t])

  // 三列固定小表：不启用排序/列设置（等价旧浮层表格能力）
  const columns = useMemo<ApexColumnDef<SnapshotRow>[]>(
    () => [
      {
        accessorKey: 'metric',
        header: t('指标'),
        enableSorting: false,
        size: 190,
        meta: { apex: { align: 'start' } },
      },
      {
        accessorKey: 'current',
        header: t('当前值'),
        enableSorting: false,
        size: 110,
        meta: { apex: { align: 'end' } },
      },
      {
        accessorKey: 'detail',
        header: t('详情'),
        enableSorting: false,
        size: 320,
        meta: { apex: { align: 'start' } },
      },
    ],
    [t],
  )

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('实时数据表格')}
      footer={null}
      width={760}
      destroyOnHidden
    >
      <div className={styles.tableWrap}>
        <ApexTableReact
          columns={columns}
          data={rows}
          getRowId={(row) => row.key}
          locale={apexLocale}
          pagination={false}
          height="100%"
        />
      </div>
      <div className={styles.modalFoot}>
        {lastSuccessAt
          ? t('最近更新：{{time}} · 数据源：{{source}}', {
              time: new Date(lastSuccessAt).toLocaleString(i18n.language, { hour12: false }),
              source: sourceText,
            })
          : ''}
      </div>
    </Modal>
  )
}
