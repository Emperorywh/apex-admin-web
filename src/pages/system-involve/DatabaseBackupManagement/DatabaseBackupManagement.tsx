/**
 * 数据库备份管理页（P30 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\SystemInvolve\DatabaseBackupManagement）等价迁移：
 * - 两级数据：备份数据库下拉（getDataBases 无参 → 库名数组，页面加载即查、
 *   默认选中第一个、allowClear；清空仅更新选中、不触发重查——旧版 effect
 *   判空跳过同语义）+ 备份文件列表（getDataBaseBackupFiles?database= 全集
 *   返回无分页参数）；
 * - 备份文件列表迁移为 ApexTableReact request 模式：库切换时 reload 重查，
 *   request 回调内客户端切片分页、rowCount=全集长度（不虚构服务端分页语义，
 *   P25 同款）；失败态由表格内建承载（错误+重试仅在表格内部，按钮纪律）；
 * - 列结构旧版逐列核对：文件名（弹性，悬浮完整值）/文件大小（fileSizeReadable
 *   后端预格式化串，缺失留白）/创建时间（displayDateTime 秒级展示转换，不改
 *   协议值；缺失留白）/路径（悬浮完整值）/操作（下载按钮）；
 * - 下载：旧版 a 标签 GET 原生下载（不可观测、无失败处理）升级为请求层
 *   GET Blob 通道 + 真实接收进度弹窗（TransferProgressModal 复用 P25：已知
 *   总字节显示百分比/剩余时间，未知走马灯仅显示已接收）+ 传输管理器登记
 *   （切页继续、关页提示、真实取消、取消二次确认）；错误 JSON/HTML 不落为
 *   伪文件（DoD 9）；文件名 content-disposition 优先、回退行记录文件名
 *   （旧版 a.download 同语义）；旧版伴随提示「浏览器即将开始下载…」随形态
 *   升级移除（新形态有真实进度与完成反馈，差异登记）；
 * - 权限：菜单码 system:database-backup:view 挂路由守卫（旧 .umirc.ts 漏写
 *   access 但权限清单真实存在，规格 5.12-12 核对收敛，不当公开页）；下载按钮
 *   码 system:database-backup:download 条件渲染隐藏（操作列保留空列，旧 §7.2）；
 * - 页面不轮询（旧版同语义，配置型只读列表）；无手动刷新按钮（按钮纪律），
 *   库切换即重查；不提供创建备份/恢复数据库入口（交付边界：旧版亦无）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Select, Space, Tooltip, Typography } from 'antd'
import { Download, Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import type {
  ApexColumnDef,
  ApexTableInstance,
  ApexTableRef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
} from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { stringFieldRowId } from '@/utils/table/rowId'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { beginTransfer } from '@/services/transfer/transferManager'
import {
  downloadDataBaseBackupFile,
  getDataBases,
  getDataBaseBackupFiles,
} from '@/services/system/database-backup/database-backup.service'
import type { BackupFileRecord } from '@/services/system/database-backup/database-backup.service.types'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import TransferProgressModal from '@/features/system-version/components/TransferProgressModal'
import { useTransferSpeed } from '@/features/system-version/hooks/useTransferSpeed'
import styles from './DatabaseBackupManagement.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function DatabaseBackupManagement() {
  // fallback 顺序：本页私有文案 → common；无前缀 key（AGENTS 6）
  const { t } = useTranslation(['database-backup', 'common'], { nsMode: 'fallback' })
  const { message, modal } = App.useApp()
  const apexLocale = useApexLocale()
  // 页签作用域：传输登记按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()

  // 下载按钮码（无权限条件渲染隐藏、操作列保留空列；root 短路全开）
  const { hasPerm } = usePermission()
  const canDownload = hasPerm(PERM_BUTTON.SYSTEM_DATABASE_BACKUP_DOWNLOAD)

  /* ------------------------------- 表格实例引用 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<BackupFileRecord>>(null)

  /* ------------------------------- 库列表与选中 ------------------------------- */

  /** 备份数据库选项（旧版 string[] 原样下发，label=value=库名） */
  const [databaseOptions, setDatabaseOptions] = useState<string[]>([])
  /** 当前选中库名（undefined=未选中/已清空） */
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(undefined)
  // request 回调经 ref 读当前库（闭包不随渲染重建，reload 即取最新值）
  const selectedDatabaseRef = useRef<string | undefined>(undefined)

  /** 库选择变化：更新引用与受控值；仅非空时重查文件列表（旧版 effect 判空同语义） */
  const handleDatabaseChange = useCallback((value?: string) => {
    selectedDatabaseRef.current = value
    setSelectedDatabase(value)
    if (value) {
      tableApiRef.current?.reload()
    }
  }, [])

  /**
   * 页面加载查询库列表：默认选中第一个并重查文件列表（旧版同语义——默认选中
   * 触发 effect 首查；此处经 handleDatabaseChange 统一走 reload 链路）。失败
   * message 如实反馈（页面级数据块无表格承载，不设重试按钮——按钮纪律），不
   * 伪造选项。
   */
  useEffect(() => {
    const controller = new AbortController()
    getDataBases({ signal: controller.signal })
      .then((list) => {
        const names = list ?? []
        setDatabaseOptions(names)
        if (names.length > 0) {
          handleDatabaseChange(names[0])
        }
      })
      .catch((error: unknown) => {
        if (!isCancelledError(error)) {
          void message.error(t('查询备份数据库出错：{{msg}}', { msg: apiErrorMessage(error) }))
        }
      })
    return () => controller.abort()
    // handleDatabaseChange 为稳定 useCallback；message/t 随语言变化重查无意义，仅告警依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('database-backup:main')
  const [prefSlices, setPrefSlices] = useState<ColumnPrefSlices>({})
  const prefSlicesRef = useRef<ColumnPrefSlices>({})

  useEffect(() => {
    if (!prefs || !tableInstanceRef.current) return
    try {
      const slices = prefs.load({
        columns: tableInstanceRef.current.getAllLeafColumns(),
        initialState: {},
      })
      const loaded: ColumnPrefSlices = {
        columnOrder: slices.columnOrder,
        columnVisibility: slices.columnVisibility,
        columnSizing: slices.columnSizing,
        columnPinning: slices.columnPinning,
      }
      setPrefSlices(loaded)
      prefSlicesRef.current = loaded
    } catch {
      // 偏好读取失败不阻塞表格：以默认布局运行
    }
  }, [prefs])

  /**
   * 列偏好持久化（P03 实证约束）：
   * - 受控切片必须同步更新，否则下一帧按旧值渲染回弹用户改动；
   * - save 是整体替换语义，必须传合并后的完整四切片（面板一次确认连发四类回调）。
   */
  const persistPrefs = useCallback(
    (patch: ColumnPrefSlices) => {
      const merged = { ...prefSlicesRef.current, ...patch }
      prefSlicesRef.current = merged
      setPrefSlices(merged)
      if (!prefs) return
      try {
        prefs.save(merged)
      } catch {
        // 保存失败静默：偏好是增强能力，不阻塞业务操作
      }
    },
    [prefs],
  )

  // 操作列默认钉右（P14–P25 同款；无已保存偏好时生效，用户保存的偏好优先）
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

  /* --------------------- 下载备份文件（真实进度弹窗，替代旧 a 标签直下） --------------------- */

  const [downloading, setDownloading] = useState(false)
  // 下载进度弹窗状态：真实接收字节/总字节（未知走马灯）
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadLoaded, setDownloadLoaded] = useState(0)
  const [downloadTotal, setDownloadTotal] = useState<number | null>(null)
  const { speedMBps, etaSeconds, sample: sampleSpeed, reset: resetSpeed } = useTransferSpeed()
  // 在途传输句柄：取消确认后经其 cancel() 中止请求并按 aborted 收尾登记
  const activeTransferRef = useRef<ReturnType<typeof beginTransfer> | null>(null)

  /**
   * 下载备份文件：GET Blob 通道 + 真实接收进度；错误 JSON/HTML 不落为伪文件
   * （DoD 9）。文件名 content-disposition 优先，回退行记录文件名（旧版
   * a.download 同语义）。
   */
  const handleDownload = useCallback(
    (record: BackupFileRecord) => {
      const database = selectedDatabaseRef.current
      const fileName = record.fileName ?? ''
      if (!downloading) {
        if (!database || !fileName) {
          // 库被清空后表格仍持有旧数据的极端时序防御（旧版同款警告语义）
          message.warning(t('请先选择数据库'))
          return
        }
        setDownloading(true)
        resetSpeed()
        setDownloadLoaded(0)
        setDownloadTotal(null)
        setDownloadOpen(true)
        const transfer = beginTransfer({
          tabKey: scope?.scopeKey ?? null,
          kind: 'download',
          // 传输登记名用真实文件名（协议值不翻译；服务端头优先，成功后按其落盘）
          name: fileName,
        })
        activeTransferRef.current = transfer
        downloadDataBaseBackupFile(
          { database, backupFileName: fileName },
          (event) => {
            // 真实接收进度上报：total 缺失即不确定进度（走马灯，不伪造百分比）
            const nextTotal = event.total ?? null
            setDownloadLoaded(event.loaded)
            setDownloadTotal(nextTotal)
            transfer.setProgress(event.loaded, nextTotal)
            sampleSpeed(event.loaded, nextTotal)
          },
          { signal: transfer.signal },
        )
          .then(({ blob, filename }) => {
            setDownloadOpen(false)
            // 媒体类型粗校验：JSON/HTML 说明是异常网关/业务错误响应，不保存为伪文件
            if (blob.type.includes('json') || blob.type.includes('html')) {
              const reason = t('下载备份文件出错：{{msg}}', { msg: blob.type })
              transfer.fail(reason)
              message.error(reason)
              return
            }
            // 文件名：服务端 content-disposition 优先（RFC 5987 已在服务层解析），
            // 取不到回退行文件名（旧实现 a.download 同语义）；保存后释放对象 URL
            const safeName = filename || fileName
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = safeName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
            transfer.succeed()
            message.success(t('备份文件下载完成'))
          })
          .catch((error: unknown) => {
            setDownloadOpen(false)
            if (!isCancelledError(error)) {
              const reason = t('下载备份文件出错：{{msg}}', { msg: apiErrorMessage(error) })
              transfer.fail(reason)
              message.error(reason)
            } else {
              // 主动取消：info 级提示（非错误），传输登记按取消语义收尾
              transfer.fail(t('已取消下载'))
              message.info(t('已取消下载'))
            }
          })
          .finally(() => {
            setDownloading(false)
          })
        }
    },
    [downloading, message, resetSpeed, sampleSpeed, scope, t],
  )

  /** 取消下载：二次确认后中止接收（已接收部分丢弃，可重新点击下载） */
  const handleDownloadCancel = useCallback(() => {
    modal.confirm({
      title: t('确认取消下载？'),
      content: t('已下载的部分将被丢弃，可重新点击下载。'),
      okText: t('取消下载'),
      okButtonProps: { danger: true },
      cancelText: t('继续下载'),
      onOk: () => {
        // 经传输管理器真实中止在途请求（signal abort → 请求层取消语义）
        activeTransferRef.current?.cancel()
      },
    })
  }, [modal, t])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<BackupFileRecord>[]>(() => {
    return [
      {
        // 文件名：旧版弹性列；悬浮显示完整值、单元格内单行省略；缺失留白
        accessorKey: 'fileName',
        header: t('文件名'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          return (
            <Tooltip title={text} placement="topLeft">
              <Typography.Text style={{ maxWidth: '100%' }} ellipsis>
                {text}
              </Typography.Text>
            </Tooltip>
          )
        },
      },
      {
        // 文件大小：旧版 width 150；后端预格式化可读串原样展示，缺失留白
        accessorKey: 'fileSizeReadable',
        header: t('文件大小'),
        enableSorting: false,
        size: 150,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          return text === null || text === undefined || text === '' ? null : text
        },
      },
      {
        // 创建时间：旧版 width 200；秒级展示转换（displayDateTime，缺失留白），
        // 列宽按 19 字符时间串实测 ≥160 起步（AGENTS 第 1 节）
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 200,
        cell: (info) => {
          const text = displayDateTime(info.getValue() as string | null | undefined)
          return text === '' ? null : text
        },
      },
      {
        // 路径：旧版 width 600；悬浮显示完整路径、单元格内单行省略；缺失留白
        accessorKey: 'filePath',
        header: t('路径'),
        enableSorting: false,
        size: 600,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          return (
            <Tooltip title={text} placement="topLeft">
              <Typography.Text style={{ maxWidth: 580 }} ellipsis>
                {text}
              </Typography.Text>
            </Tooltip>
          )
        },
      },
      {
        // 操作列：旧版 width 120 单项下载（无权限隐藏、保留空列）；默认钉右
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 120,
        cell: ({ row }) => {
          const record = row.original
          return canDownload ? (
            <Button
              size="small"
              type="link"
              icon={<Download size={12} />}
              disabled={downloading}
              onClick={() => handleDownload(record)}
            >
              {t('下载')}
            </Button>
          ) : null
        },
      },
    ]
  }, [t, canDownload, downloading, handleDownload])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/*
       * 库选择行（旧版 search_bar 等价）：左标签 + Select 300px + allowClear。
       * 清空仅更新选中不重查（旧版 effect 判空跳过同语义）；无手动刷新按钮，
       * 库切换即重查（按钮纪律）。
       */}
      <div className={styles.toolbar}>
        <Space size={8}>
          <span className={styles.databaseLabel}>
            <Database size={14} strokeWidth={2} /> {t('备份数据库：')}
          </span>
          <Select
            style={{ width: 300 }}
            placeholder={t('请选择备份数据库')}
            value={selectedDatabase}
            onChange={handleDatabaseChange}
            options={databaseOptions.map((db) => ({ label: db, value: db }))}
            allowClear
          />
        </Space>
      </div>

      {/* 备份文件列表：Apex request 模式——getDataBaseBackupFiles 无分页参数（全集
          返回），回调内客户端切片分页，rowCount=全集长度；未选库时不发请求（旧版
          同语义：无选中即空表）；错误/取消/加载态由表格内建承载 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageIndex, pageSize, signal } = params
            const database = selectedDatabaseRef.current
            if (!database) {
              // 未选中库：空结果（不虚构请求；旧版未选中时表格为空同语义）
              return Promise.resolve({ data: [], rowCount: 0 })
            }
            return getDataBaseBackupFiles({ database }, { signal }).then((rows) => {
              const all = rows ?? []
              // 全集切片：零基 pageIndex 直接乘 pageSize（无服务端分页，不虚构语义）
              const start = pageIndex * pageSize
              return {
                data: all.slice(start, start + pageSize),
                rowCount: all.length,
              }
            })
          }}
          getRowId={stringFieldRowId('fileName')}
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100, 200] }}
          columnSettingsEnabled
          height="100%"
          state={{
            columnOrder: prefSlices.columnOrder,
            columnVisibility: prefSlices.columnVisibility,
            columnSizing: prefSlices.columnSizing,
            columnPinning: prefSlices.columnPinning ?? defaultPinning,
          }}
          onColumnOrderChange={(updater) =>
            persistPrefs({ columnOrder: resolveUpdater(updater, prefSlices.columnOrder ?? []) })
          }
          onColumnVisibilityChange={(updater) =>
            persistPrefs({ columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}) })
          }
          onColumnSizingChange={(updater) =>
            persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
          }
          onColumnPinningChange={(updater) =>
            persistPrefs({ columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? defaultPinning) })
          }
        />
      </div>

      {/* 下载进度弹窗：真实接收进度（已知总字节显示百分比/剩余时间，未知走马灯），
          取消经二次确认中止——替代旧 a 标签直下的不可观测下载 */}
      <TransferProgressModal
        open={downloadOpen}
        title={t('正在下载备份文件')}
        phase="transferring"
        loaded={downloadLoaded}
        total={downloadTotal}
        speedMBps={speedMBps}
        etaText={
          Number.isFinite(etaSeconds) && etaSeconds > 0
            ? `${t('剩余')} ${etaSeconds < 60 ? t('{{n}} 秒', { n: Math.ceil(etaSeconds) }) : t('{{n}} 分', { n: Math.ceil(etaSeconds / 60) })}`
            : ''
        }
        statusText={t('备份文件下载中，请勿关闭页面...')}
        cancelLabel={t('取消下载')}
        onCancel={handleDownloadCancel}
      />
    </div>
  )
}

/**
 * TanStack Updater 解析：回调可能收到值或函数（旧值 → 新值）。
 * 列偏好持久化只需要最终值，这里以当前受控切片为旧值统一折叠。
 */
function resolveUpdater<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater
}
