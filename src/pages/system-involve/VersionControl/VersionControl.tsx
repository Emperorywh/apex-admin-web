/**
 * 版本管理页（P25 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\SystemInvolve\VersionControl）：antd Table
 * （分页关闭、全集约 10 条）+ 重启程序/更新版本包工具行 + 行内 下载/回滚/删除
 * + FakeProgressModal 伪进度下载弹窗。本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式：getSystemVersions 无分页参数
 *   （全集返回、旧页面同为全量渲染），request 回调内做客户端切片分页，
 *   rowCount=全集长度（不虚构服务端分页语义）；列偏好 system-version:main、
 *   内建取消/错误重试；排序不启用（G09：接口无排序参数）；
 * - 列结构与旧版逐列核对：版本类型（Tag：CURRENT 绿 / BACKUP 灰 / PENDING 金；
 *   未知枚举灰色 Tag 显示协议原值，缺失留白）/ 提交描述 / Git标签 / BuildId /
 *   提交信息 / 提交时间 / 构建时间（秒级 displayDateTime 展示转换，不改协议值）；
 *   空值一律留白（不写「—」占位）；
 * - 下载：移除旧 FakeProgressModal 伪进度（任务卡明确），改为真实接收进度弹窗
 *   （已知总字节显示百分比，未知走马灯仅显示已接收 MB），经传输管理器登记
 *   （切页继续、关页提示、真实取消）；错误 JSON/HTML 不保存为伪文件（DoD 9）；
 * - 回滚/删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；
 *   旧版回滚为 Modal.confirm 两问、删除为 Popconfirm 一问，按 DoD 8 统一升级，
 *   控制样板见 P04–P23）；重启同走 confirmCommand；
 * - 重启/回滚成功（code=200，后端先响应后重启）：成功反馈后派发 sessionExpired，
 *   由会话守卫统一跳登录页（旧版清 token+replace /login 同语义）；失败/断连
 *   如实呈现错误、不宣布成功、不自动重试（DoD 8：命令接受 ≠ 完成，恢复后由
 *   用户重新登录核实状态，不重放命令）；
 * - 无手动刷新按钮（按钮纪律）：删除/上传成功后自动 reload，重启/回滚后经
 *   重新登录回跳本页即重新查询；
 * - 无权限动作隐藏（按钮码 system:version:restart/upload/rollback/download/
 *   delete，与旧 §7 一致；菜单码 system:version:view 挂路由守卫）；
 * - 配置型只读列表不轮询（DoD 7）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Space, Tag, Tooltip, Typography } from 'antd'
import { Download, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
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
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { beginTransfer } from '@/services/transfer/transferManager'
import { sessionExpired } from '@/store/slices/authSlice'
import {
  deletePendingJar,
  downloadSystemVersionJar,
  getSystemVersions,
  restartSystem,
  rollbackSystemVersion,
} from '@/services/system/system-version/system-version.service'
import type { SystemVersionDto } from '@/services/system/system-version/system-version.service.types'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import VersionUploadButton from '@/features/system-version/components/VersionUploadButton'
import TransferProgressModal from '@/features/system-version/components/TransferProgressModal'
import { useTransferSpeed } from '@/features/system-version/hooks/useTransferSpeed'
import styles from './VersionControl.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 版本类型枚举 → Tag 颜色（旧实现同款：CURRENT 绿 / PENDING 金 / 其余灰） */
function versionTypeColor(type: SystemVersionDto['type']): string {
  if (type === 'CURRENT') return 'green'
  if (type === 'PENDING') return 'gold'
  // BACKUP 与未知枚举保持视觉中性（未知枚举仍显示协议原值，不臆造中文）
  return 'default'
}

export default function VersionControl() {
  const { t } = useTranslation('systemVersion')
  const { message, modal } = App.useApp()
  const dispatch = useDispatch()
  const apexLocale = useApexLocale()
  // 页签作用域：传输登记按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()

  // 按钮码权限（与旧实现 §7 一致）：重启/下载/回滚/删除，无权限隐藏
  const { hasPerm } = usePermission()
  const canRestart = hasPerm(PERM_BUTTON.SYSTEM_VERSION_RESTART)
  const canDownload = hasPerm(PERM_BUTTON.SYSTEM_VERSION_DOWNLOAD)
  const canRollback = hasPerm(PERM_BUTTON.SYSTEM_VERSION_ROLLBACK)
  const canDelete = hasPerm(PERM_BUTTON.SYSTEM_VERSION_DELETE)

  /* ------------------------------- 列表与表格状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<SystemVersionDto>>(null)

  /** 操作后统一刷新列表（写操作成功的主刷新入口；重启/回滚经重新登录回跳自动查询） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('system-version:main')
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

  // 操作列默认钉右（P14–P23 同款；无已保存偏好时生效，用户保存的偏好优先）
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

  /* --------------------- 重启系统（破坏性系统命令，confirmCommand） --------------------- */

  // 防连点：重启命令在途期间禁用入口
  const [restarting, setRestarting] = useState(false)

  /**
   * 重启系统：确认（列明危险影响）→ 发送 → code=200 视为命令受理成功
   * （后端先响应后重启），成功反馈后清会话跳登录；失败/断连如实呈现、
   * 不宣布成功、不自动重试（DoD 8：恢复后由用户重新登录核实状态）。
   */
  const handleRestart = useCallback(() => {
    void confirmCommand({
      title: t('确认重启程序?'),
      impact: t('重启前请确认是否具备重启条件！（危险操作）'),
      danger: true,
    }).then(async (confirmed) => {
      if (!confirmed) return
      setRestarting(true)
      try {
        await restartSystem()
        message.success(t('重启程序成功'))
        // 会话随系统重启失效：派发后由 BasicLayout 会话守卫统一跳登录页
        // （旧版清 accessInfo + replace /login 同语义；重新登录回跳本页即恢复查询）
        dispatch(sessionExpired())
      } catch (error) {
        if (!isCancelledError(error)) {
          // 断连/失败不宣布成功：如实呈现错误原文，命令不自动重放
          message.error(t('重启程序出错：{{msg}}', { msg: apiErrorMessage(error) }))
        }
      } finally {
        setRestarting(false)
      }
    })
  }, [dispatch, message, t])

  /* --------------------- 回滚版本（破坏性系统命令，confirmCommand） --------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = gitBuildId）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 回滚到指定构建版本：确认后发送；进行中全局 loading（旧实现同语义），成功后清会话跳登录 */
  const handleRollback = useCallback(
    (record: SystemVersionDto) => {
      const buildId = record.gitBuildId ?? ''
      if (!buildId) return
      void confirmCommand({
        title: t('确认回滚到当前版本?'),
        targets: [buildId],
        impact: t('回滚前请确认是否具备回滚条件！（危险操作）'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(buildId)
        // 进行中不自动关闭的全局 loading（旧实现 message.loading 同语义）
        const hideLoading = message.loading(t('正在回滚版本，请稍候...'), 0)
        try {
          await rollbackSystemVersion({ buildId })
          hideLoading()
          message.success(t('回滚版本成功'))
          dispatch(sessionExpired())
        } catch (error) {
          hideLoading()
          if (!isCancelledError(error)) {
            message.error(t('回滚版本出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [dispatch, message, t],
  )

  /* --------------------- 删除待升级版本（confirmCommand 破坏性确认） --------------------- */

  /** 删除待升级 jar：按 buildId 定位；确认后删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: SystemVersionDto) => {
      const buildId = record.gitBuildId ?? ''
      if (!buildId) return
      void confirmCommand({
        title: t('确认删除该待升级版本?'),
        targets: [buildId],
        impact: t('删除影响：该待升级版本包将被删除，且不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(buildId)
        try {
          await deletePendingJar({ buildId })
          message.success(t('删除待升级版本成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除待升级版本出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* --------------------- 下载版本包（真实进度弹窗，替代旧伪进度） --------------------- */

  const [downloading, setDownloading] = useState(false)
  // 下载进度弹窗状态：真实接收字节/总字节（未知走马灯）
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadLoaded, setDownloadLoaded] = useState(0)
  const [downloadTotal, setDownloadTotal] = useState<number | null>(null)
  const { speedMBps, etaSeconds, sample: sampleSpeed, reset: resetSpeed } = useTransferSpeed()
  // 下载取消控制器（确认后中止本次接收）
  const downloadAbortRef = useRef<AbortController | null>(null)

  /** 下载版本包：POST Blob 通道 + 真实接收进度；错误 JSON/HTML 不落为伪文件（DoD 9） */
  const handleDownload = useCallback(
    (record: SystemVersionDto) => {
      const buildId = record.gitBuildId ?? ''
      if (!buildId || downloading) return
      setDownloading(true)
      resetSpeed()
      setDownloadLoaded(0)
      setDownloadTotal(null)
      setDownloadOpen(true)
      const transfer = beginTransfer({
        tabKey: scope?.scopeKey ?? null,
        kind: 'download',
        // 传输登记名用原始构建标识命名（协议标识不翻译）
        name: `${buildId}.jar`,
      })
      downloadSystemVersionJar(
        { buildId },
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
            const reason = t('下载版本包出错：{{msg}}', { msg: blob.type })
            transfer.fail(reason)
            message.error(reason)
            return
          }
          // 文件名：服务端 content-disposition 优先（RFC 5987 已在服务层解析），
          // 取不到回退 buildId.jar（旧实现同语义）；保存后释放对象 URL
          const safeName = filename || `${buildId}.jar`
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = safeName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          transfer.succeed()
          message.success(t('版本包下载完成'))
        })
        .catch((error: unknown) => {
          setDownloadOpen(false)
          if (!isCancelledError(error)) {
            const reason = t('下载版本包出错：{{msg}}', { msg: apiErrorMessage(error) })
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
        downloadAbortRef.current?.abort()
      },
    })
  }, [modal, t])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<SystemVersionDto>[]>(() => {
    return [
      {
        // 版本类型：彩色 Tag（CURRENT 绿 / BACKUP 灰 / PENDING 金）；未知枚举灰色
        // Tag 显示协议原值，缺失留白（旧实现 map[type] || type || "-" 的等价收敛：
        // 空值留白纪律替代「-」占位）
        accessorKey: 'type',
        header: t('版本类型'),
        enableSorting: false,
        cell: (info) => {
          const type = info.getValue() as SystemVersionDto['type']
          if (type === null || type === undefined || type === '') return null
          const text =
            type === 'CURRENT'
              ? t('当前版本')
              : type === 'BACKUP'
                ? t('备份版本')
                : type === 'PENDING'
                  ? t('待升级')
                  : String(type)
          return <Tag color={versionTypeColor(type)}>{text}</Tag>
        },
      },
      {
        // 提交描述：旧版 width 200，悬浮显示完整值、单元格内单行省略
        accessorKey: 'gitCommitIdDescribe',
        header: t('提交描述'),
        enableSorting: false,
        size: 200,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          return (
            <Tooltip title={text} placement="topLeft">
              <Typography.Text style={{ maxWidth: 200 }} ellipsis>
                {text}
              </Typography.Text>
            </Tooltip>
          )
        },
      },
      {
        // Git标签：旧版弹性列；缺失留白
        accessorKey: 'gitTags',
        header: t('Git标签'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // BuildId：旧版 width 180，悬浮显示完整值；同时是回滚/删除/下载的定位键
        accessorKey: 'gitBuildId',
        header: 'BuildId',
        enableSorting: false,
        size: 180,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          return (
            <Tooltip title={text} placement="topLeft">
              <Typography.Text style={{ maxWidth: 180 }} ellipsis>
                {text}
              </Typography.Text>
            </Tooltip>
          )
        },
      },
      {
        // 提交信息：旧版 width 300，悬浮显示完整内容、单元格内单行省略
        accessorKey: 'gitCommitMessageFull',
        header: t('提交信息'),
        enableSorting: false,
        size: 300,
        cell: (info) => {
          const text = info.getValue() as string | null | undefined
          if (text === null || text === undefined || text === '') return null
          return (
            <Tooltip title={text} placement="topLeft">
              <Typography.Text style={{ maxWidth: 280 }} ellipsis>
                {text}
              </Typography.Text>
            </Tooltip>
          )
        },
      },
      {
        // 提交时间：秒级展示转换（displayDateTime，缺失留白）；列宽按 19 字符时间串
        // 实测 ≥160 起步取 170（AGENTS 第 1 节）
        accessorKey: 'gitCommitTime',
        header: t('提交时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => {
          const text = displayDateTime(info.getValue() as string | null | undefined)
          return text === '' ? null : text
        },
      },
      {
        // 构建时间：同提交时间口径
        accessorKey: 'gitBuildTime',
        header: t('构建时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => {
          const text = displayDateTime(info.getValue() as string | null | undefined)
          return text === '' ? null : text
        },
      },
      {
        // 操作列：旧版 width 280 fixed right（兼容五语言按钮宽度，旧注释同款考量）；
        // 入口按按钮码与行类型控制（回滚仅 BACKUP 行、删除仅 PENDING 行，旧实现同款）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 280,
        cell: ({ row }) => {
          const record = row.original
          const buildId = record.gitBuildId ?? ''
          const pending = pendingRowKey !== null && pendingRowKey === buildId
          return (
            <Space size={4}>
              {/* 下载版本包：无权限隐藏 */}
              {canDownload ? (
                <Button
                  size="small"
                  icon={<Download size={12} />}
                  disabled={pending}
                  onClick={() => handleDownload(record)}
                >
                  {t('下载')}
                </Button>
              ) : null}
              {/* 回滚：仅备份版本行 + 无权限隐藏；破坏性确认后发送 */}
              {record.type === 'BACKUP' && canRollback ? (
                <Button
                  size="small"
                  type="primary"
                  danger
                  disabled={pending}
                  onClick={() => handleRollback(record)}
                >
                  {t('回滚')}
                </Button>
              ) : null}
              {/* 删除：仅待升级行 + 无权限隐藏；破坏性确认后删除 */}
              {record.type === 'PENDING' && canDelete ? (
                <Button size="small" danger disabled={pending} onClick={() => handleDelete(record)}>
                  {t('删除')}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ]
  }, [t, canDelete, canDownload, canRollback, handleDelete, handleDownload, handleRollback, pendingRowKey])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：右侧按钮组（旧实现 search 区按钮靠右同形态）；重启程序 danger 主色；
          无手动刷新按钮，删除/上传成功后自动刷新，重启/回滚经重新登录回跳恢复 */}
      <div className={styles.toolbar}>
        <Space wrap size={8}>
          {/* 重启程序：无权限隐藏；危险操作确认后发送 */}
          {canRestart ? (
            <Button
              type="primary"
              danger
              icon={<RotateCw size={14} />}
              loading={restarting}
              onClick={handleRestart}
            >
              {t('重启程序')}
            </Button>
          ) : null}
          {/* 更新版本包：入口权限由页面控制（system:version:upload），上传语义见组件 */}
          {hasPerm(PERM_BUTTON.SYSTEM_VERSION_UPLOAD) ? (
            <VersionUploadButton onSucceeded={reloadList} />
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式——getSystemVersions 无分页参数（全集返回），回调内
          客户端切片分页，rowCount=全集长度；错误/取消/加载态由表格内建承载 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageIndex, pageSize, signal } = params
            return getSystemVersions({ signal }).then((rows) => {
              const all = rows ?? []
              // 全集切片：零基 pageIndex 直接乘 pageSize（无服务端分页，不虚构语义）
              const start = pageIndex * pageSize
              return {
                data: all.slice(start, start + pageSize),
                rowCount: all.length,
              }
            })
          }}
          getRowId={stringFieldRowId('gitBuildId')}
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
          取消经二次确认中止——替代旧 FakeProgressModal 伪进度条 */}
      <TransferProgressModal
        open={downloadOpen}
        title={t('正在下载版本包')}
        phase="transferring"
        loaded={downloadLoaded}
        total={downloadTotal}
        speedMBps={speedMBps}
        etaText={
          Number.isFinite(etaSeconds) && etaSeconds > 0
            ? `${t('剩余')} ${etaSeconds < 60 ? t('{{n}} 秒', { n: Math.ceil(etaSeconds) }) : t('{{n}} 分', { n: Math.ceil(etaSeconds / 60) })}`
            : ''
        }
        statusText={t('版本包下载中，请勿关闭页面...')}
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
