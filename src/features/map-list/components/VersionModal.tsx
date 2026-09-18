/**
 * 地图版本管理弹窗（P09）：真实 pageMapInfoVersions/publishMapInfoVersion/
 * downloadMap/pushMapInfoVersion 接入（旧 VersionModal 等价迁移）。
 *
 * 交互与契约要点：
 * - 版本表为 ApexTableReact request 模式（服务端分页/内建取消/错误重试；
 *   G09：旧页面无排序，不开放排序）；弹窗销毁重建（destroyOnHidden），
 *   每次打开按当前地图重新加载（旧实现重置搜索与分页同语义）；
 * - 搜索版本号/备注：输入防抖 300ms 自动查询、清空立即重置（旧实现同节奏）；
 * - 列结构逐列核对旧版：版本号/是否发布/备注/来源版本/创建人/创建时间/操作；
 *   「是否发布」按 currentMapInfoVersion truthy（旧实现同依据）；
 *   发布按钮禁用依据 = currentMapInfoVersion（联验实证下发）并旧字段 published
 *   （新后端不下发，保留兼容），见操作列注释；
 * - 发布升级 confirmCommand 破坏性确认（列明目标版本与"替换当前线上地图数据"
 *   影响；旧版 Popconfirm 一问，控制样板见 P04-P08）；行级防连点；
 * - 推送入口打开 PushVersionModal（二层弹窗，旧实现同嵌套）；
 * - 下载经传输管理器登记（真实进度/切页继续/关页提示）；JSON/HTML 响应不保存
 *   为伪文件（DoD 9）；文件名 content-disposition 优先、本地默认名兜底；
 * - 编辑导航进入 H02 暂缓说明页（/map-through/map-nest-modify，携带
 *   mapId+mapVersionId 查询参数，旧实现同目标；不携入完整编辑器，A02/A17）；
 * - 无手动刷新按钮（按钮纪律）：发布/推送成功后自动刷新当前页。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { App, Button, Input, Modal, Space, Tag } from 'antd'
import { Download, Edit3, Search as SearchIcon, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import type { ApexColumnDef, ApexTableInstance, ApexTableRef } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { usePermission } from '@/hooks/usePermission'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { useTransfers } from '@/hooks/useTransfers'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { beginTransfer } from '@/services/transfer/transferManager'
import {
  downloadMapFile,
  pageMapVersions,
  publishMapVersion,
} from '@/services/map/map-admin.service'
import type { MapVersionDto } from '@/services/map/map-admin.service.types'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import { PushVersionModal } from './PushVersionModal'
import styles from './VersionModal.module.css'

interface VersionModalProps {
  open: boolean
  /** 当前地图 id（版本按地图隔离） */
  mapId: string | null
  /** 当前地图名称（弹窗标题展示） */
  mapName: string | null
  /** 关闭回调（父页面负责刷新主列表——旧实现同语义） */
  onClose: () => void
}

export function VersionModal({ open, mapId, mapName, onClose }: VersionModalProps) {
  const { t } = useTranslation('mapList')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()
  const navigate = useNavigate()

  // 弹窗内按钮仍挂按钮码（旧实现 §7.7 同边界）：编辑/发布/下载；推送入口旧实现无码
  const { hasPerm } = usePermission()
  const canUpdate = hasPerm(PERM_BUTTON.MAP_VERSION_UPDATE)
  const canPublish = hasPerm(PERM_BUTTON.MAP_VERSION_PUBLISH)
  const canDownload = hasPerm(PERM_BUTTON.MAP_VERSION_DOWNLOAD)

  // 页签 scope：下载传输按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()
  const transferTabKey = scope?.scopeKey ?? null

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<MapVersionDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')
  // 防抖句柄：输入停止 300ms 后自动查询（旧实现 useDebounceFn 同节奏）
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // 推送弹窗：当前推送的版本 id（null=关闭）
  const [pushVersionId, setPushVersionId] = useState<number | null>(null)

  // 行级操作防连点：同一版本只允许一个在途命令（行 ID = String(id)）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  // 卸载时清理防抖定时器
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  /** 搜索提交：回首页重新查询（防抖等待中的输入立即生效） */
  const submitSearch = useCallback((value: string) => {
    clearTimeout(debounceRef.current)
    queryRef.current = value
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /** 输入变更：清空立即重置；其余防抖 300ms 自动查询（旧实现同节奏） */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchText(value)
      if (!value) {
        submitSearch('')
        return
      }
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => submitSearch(value), 300)
    },
    [submitSearch],
  )

  /* ------------------------------- 发布版本 ------------------------------- */

  /** 发布版本：确认（列明目标与影响）→ 命令提交 → 刷新当前页 */
  const handlePublish = useCallback(
    (record: MapVersionDto) => {
      const rowId = String(record.id)
      void confirmCommand({
        title: t('发布版本'),
        targets: [record.mapVersion ?? ''],
        impact: t('发布后将替换当前线上地图数据'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await publishMapVersion({ mapVersionId: record.id as number })
          message.success(t('发布版本成功'))
          tableApiRef.current?.reload()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('发布版本出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, t],
  )

  /* ------------------------- 编辑版本（进入 H02 暂缓页） ------------------------- */

  /** 编辑版本：先关弹窗再导航（旧实现同顺序），目标为暂缓说明页并携带定位参数 */
  const handleEdit = useCallback(
    (record: MapVersionDto) => {
      onClose()
      navigate(
        `/map-through/map-nest-modify?mapId=${encodeURIComponent(record.mapId ?? '')}&mapVersionId=${record.id ?? ''}`,
      )
    },
    [navigate, onClose],
  )

  /* ------------------------------- 下载版本文件 ------------------------------- */

  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  /** 下载版本压缩包：经传输管理器登记；错误 JSON 不落为伪文件（DoD 9），资源释放 */
  const handleDownload = useCallback(
    (record: MapVersionDto) => {
      const rowId = String(record.id)
      if (downloadingKey !== null) return
      setDownloadingKey(rowId)
      const transfer = beginTransfer({
        tabKey: transferTabKey,
        kind: 'download',
        name: `${record.mapName || t('地图')}_${record.mapVersion || t('未知版本')}.zip`,
      })
      downloadMapFile(record.id as number, { signal: transfer.signal })
        .then(({ blob, filename }) => {
          // 媒体类型粗校验：JSON/HTML 说明是异常网关/业务错误响应，不保存为伪文件
          if (blob.type.includes('json') || blob.type.includes('html')) {
            transfer.fail(t('下载地图文件出错：{{msg}}', { msg: t('响应不是有效的地图文件') }))
            message.error(t('下载地图文件出错：{{msg}}', { msg: t('响应不是有效的地图文件') }))
            return
          }
          // 文件名：服务端 content-disposition 优先（RFC 5987 已在服务层解析），
          // 取不到回退「地图名_版本号.zip」（旧实现同语义）
          const safeName =
            filename || `${record.mapName || t('地图')}_${record.mapVersion || t('未知版本')}.zip`
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = safeName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          transfer.succeed()
        })
        .catch((error: unknown) => {
          if (!isCancelledError(error)) {
            const reason = t('下载地图文件出错：{{msg}}', { msg: apiErrorMessage(error) })
            transfer.fail(reason)
            message.error(reason)
          } else {
            // 主动取消仅代表本机终止等待：按「结果待确认」语义标记失败说明
            transfer.fail(t('下载地图文件失败'))
          }
        })
        .finally(() => setDownloadingKey(null))
    },
    [downloadingKey, message, t, transferTabKey],
  )

  // 本页签在途传输快照：弹窗内进度行呈现（切页继续传输，返回仍可见）
  const tabTransfers = useTransfers(transferTabKey)
  const activeTransfers = tabTransfers.filter(
    (task) => task.phase === 'transferring' || task.phase === 'processing',
  )

  /* --------------------------------- 版本表列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<MapVersionDto>[]>(() => {
    return [
      {
        // 版本号：旧列宽 260 原样；缺失留白
        accessorKey: 'mapVersion',
        header: t('版本号'),
        enableSorting: false,
        size: 260,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 是否发布：currentMapInfoVersion truthy（旧实现同依据），Tag 绿/灰
        id: 'publishedFlag',
        header: t('是否发布'),
        enableSorting: false,
        size: 100,
        accessorFn: () => '',
        cell: ({ row }) =>
          row.original.currentMapInfoVersion ? (
            <Tag color="green">{t('是')}</Tag>
          ) : (
            <Tag color="default">{t('否')}</Tag>
          ),
      },
      {
        // 备注：缺失留白
        accessorKey: 'mapRemark',
        header: t('备注'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 来源版本：缺失留白
        accessorKey: 'parentMapVersion',
        header: t('来源版本'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 创建人：旧列宽 100 原样
        accessorKey: 'createUser',
        header: t('创建人'),
        enableSorting: false,
        size: 100,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 创建时间：秒级展示统一走 displayDateTime；缺失/不可解析留白
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：编辑/发布/下载按按钮码显隐；推送入口旧实现无码（全员可见）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 280,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === String(record.id)
          return (
            <Space size={4}>
              {/* 编辑版本：无权限隐藏；进入 H02 暂缓说明页（不携入完整编辑器） */}
              {canUpdate ? (
                <Button size="small" type="primary" icon={<Edit3 size={12} />} onClick={() => handleEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 发布版本：无权限隐藏；已发布或在途时禁用。禁用依据并用两字段：
                  currentMapInfoVersion（OpenAPI 声明 boolean，联验实证真实下发，
                  true=当前线上版本）+ published（旧后端字段，新后端不下发，保留前向兼容）；
                  联验实证（2026-09-19）：仅依赖 published 会使已发布版本仍可再发布 */}
              {canPublish ? (
                <Button
                  size="small"
                  loading={pending}
                  disabled={pending || !!record.published || !!record.currentMapInfoVersion}
                  onClick={() => handlePublish(record)}
                >
                  {t('发布')}
                </Button>
              ) : null}
              {/* 推送版本：二层弹窗（旧实现同嵌套）；同版本在途命令时禁用 */}
              <Button
                size="small"
                icon={<Send size={12} />}
                disabled={pending}
                onClick={() => setPushVersionId(record.id as number)}
              >
                {t('推送')}
              </Button>
              {/* 下载版本：无权限隐藏；在途防连点 */}
              {canDownload ? (
                <Button
                  size="small"
                  icon={<Download size={12} />}
                  loading={downloadingKey === String(record.id)}
                  onClick={() => handleDownload(record)}
                >
                  {t('下载')}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ]
  }, [t, canUpdate, canPublish, canDownload, pendingRowKey, downloadingKey, handlePublish, handleEdit, handleDownload])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <Modal
      title={`${t('版本管理')} - ${mapName ?? ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width="80vw"
      maskClosable
    >
      <div className={styles.content}>
        {/* 紧凑搜索栏：输入防抖自动查询（旧实现同节奏）；不设手动刷新按钮 */}
        <div className={styles.searchBar}>
          <Input
            size="small"
            style={{ width: 220 }}
            placeholder={t('搜索版本号/备注')}
            allowClear
            value={searchText}
            onChange={(event) => handleSearchChange(event.target.value)}
            onPressEnter={() => submitSearch(searchText)}
            suffix={
              <SearchIcon
                size={14}
                style={{ cursor: 'pointer', color: 'var(--app-text-2)' }}
                onClick={() => submitSearch(searchText)}
              />
            }
          />
        </div>

        {/* 本页签在途传输进度行：真实进度（下载压缩包可能较大） */}
        {activeTransfers.length > 0 ? (
          <div className={styles.transferLines}>
            {activeTransfers.map((task) => (
              <div key={task.id} className={styles.transferLine}>
                {task.phase === 'processing'
                  ? t('传输完成，等待服务器处理：{{name}}', { name: task.name })
                  : task.progress.total !== null && task.progress.total > 0
                    ? t('正在传输 {{name}}：{{percent}}%', {
                        name: task.name,
                        percent: Math.min(100, Math.round((task.progress.loaded / task.progress.total) * 100)),
                      })
                    : t('正在传输 {{name}}：已传输 {{loaded}} 字节', { name: task.name, loaded: task.progress.loaded })}
              </div>
            ))}
          </div>
        ) : null}

        {/* 版本表：Apex request 模式（服务端分页/取消/错误重试内建） */}
        <div className={styles.tableWrap}>
          <ApexTableReact
            ref={tableApiRef}
            tableRef={tableInstanceRef}
            columns={columns}
            request={(params) => {
              const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
              return pageMapVersions(
                {
                  mapId: mapId ?? '',
                  pageNo,
                  pageSize,
                  ...(queryRef.current ? { query: queryRef.current } : {}),
                },
                { signal: params.signal },
              ).then((page) => ({
                // rowCount 取真实 total；未知总数不由前端补 0（DoD 5）
                data: page.records ?? [],
                rowCount: page.total ?? 0,
              }))
            }}
            getRowId={stringFieldRowId('id')}
            locale={apexLocale}
            pagination={{ pageSizeOptions: [10, 20, 50] }}
            height="100%"
          />
        </div>

        {/* 推送版本弹窗（二层）：成功后刷新版本列表（旧实现同联动） */}
        <PushVersionModal
          open={pushVersionId !== null}
          mapVersionId={pushVersionId}
          onClose={() => setPushVersionId(null)}
          onSucceeded={() => tableApiRef.current?.reload()}
        />
      </div>
    </Modal>
  )
}
