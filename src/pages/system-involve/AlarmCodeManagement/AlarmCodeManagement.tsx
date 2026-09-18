/**
 * 告警码管理页（P08 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\SystemInvolve\AlarmCodeManagement）：antd Table +
 * 告警码搜索 + 新增/编辑弹窗（多语言行）+ Popconfirm 删除 + 文件上传（全量覆盖）
 * + 文件下载。本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID、列偏好、
 *   内建取消/错误重试）；排序不启用（G09：旧页面无排序，后端未声明全量排序）；
 * - 列结构与旧版逐列核对：告警码/告警描述/创建时间左对齐、操作列在末
 *   （编辑/删除/按按钮码显隐）；空值一律留白（不写「—」占位）；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；
 *   旧版仅「确定删除当前车辆告警码吗?」一问，控制样板见 P05/P04/P06/P07）；
 * - 上传（全量覆盖）：类型校验 → confirmCommand 破坏性确认 → 经传输管理器
 *   登记（切页继续、关页提示、真实字节进度，A15/A16/规格 10）；按钮 loading
 *   与页内进度行同时呈现；G05 媒体类型按旧实现 multipart/字段 file 适配；
 * - 下载：POST Blob 通道经传输管理器登记；JSON/HTML 响应不保存为伪文件
 *   （DoD 9）；文件名 content-disposition 优先、本地默认名兜底；资源释放；
 * - 新增/编辑弹窗草稿保留（AlarmCodeFormModal 常挂，A13/DoD 7）；
 * - 无权限动作隐藏（按钮码 vehicle-alarm-code:add/upload/download/update/delete，
 *   与旧 §7 一致；菜单码 vehicle-alarm-code:view 后端权限树真实下发，MENU id=27）；
 * - 普通 CRUD 配置数据不轮询（DoD 7），新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Space, Tooltip, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { Download, Lightbulb, Plus, Search as SearchIcon, UploadCloud } from 'lucide-react'
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
import { useTransfers } from '@/hooks/useTransfers'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { beginTransfer } from '@/services/transfer/transferManager'
import {
  deleteAlarmCode,
  downloadAlarmCodeFile,
  pageAlarmCodes,
  uploadAlarmCodeFile,
} from '@/services/vehicle/vehicle-alarm-code.service'
import type { AlarmCodeRecord, AlarmCodeRecordDto } from '@/services/vehicle/vehicle-alarm-code.service.types'
import { AlarmCodeFormModal } from '@/features/vehicle-alarm-code/components/AlarmCodeFormModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './AlarmCodeManagement.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/**
 * 告警描述单元格（旧实现 AlarmDescCell 等价迁移）：
 * 跟随当前界面语言展示对应记录（匹配不到回退简体中文，再回退第一条）；
 * 描述行展示"是什么告警"，处理建议行（金色提示）展示"怎么处理"，无则留白。
 * uiLocale 由页面按 i18n 语言换算传入（zh-CN → zh_CN），语言切换即重渲染。
 */
function AlarmDescCell({ records, uiLocale }: { records?: AlarmCodeRecordDto[]; uiLocale: string }) {
  // 无任何语言记录时留白（空值展示纪律，不用「—」占位）
  if (!records || records.length === 0) return null
  const record =
    records.find((item) => item?.locale === uiLocale) ??
    records.find((item) => item?.locale === 'zh_CN') ??
    records[0]
  const desc = record?.desc ?? ''
  const hint = record?.hint?.trim() ?? ''
  return (
    <div>
      {desc ? (
        <Tooltip title={desc} placement="topLeft">
          <span className={styles.descText}>{desc}</span>
        </Tooltip>
      ) : null}
      {/* 处理建议行：轻量金色提示（旧实现同语义），无则不渲染不占位 */}
      {hint ? (
        <div className={styles.hintLine}>
          <Lightbulb size={12} className={styles.hintIcon} />
          <span>{hint}</span>
        </div>
      ) : null}
    </div>
  )
}

export default function AlarmCodeManagement() {
  const { t, i18n } = useTranslation('vehicleAlarmCode')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：新增/上传/下载/编辑/删除告警码，无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_ADD)
  const canUpload = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_UPLOAD)
  const canDownload = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_DOWNLOAD)
  const canUpdate = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.VEHICLE_ALARM_CODE_DELETE)

  // 页签 scope：传输登记与页内传输过滤都按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()
  const transferTabKey = scope?.scopeKey ?? null

  // 告警描述单元格的界面语言（i18n 语言码换算为后端 locale，如 zh-CN → zh_CN）
  const uiLocale = i18n.language.replace('-', '_')

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<AlarmCodeRecord>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const alarmCodeRef = useRef<string>('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('alarm-code:main')
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

  /* ------------------------------ 弹窗状态（先于列定义） ------------------------------ */

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AlarmCodeRecord | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: AlarmCodeRecord) => {
    setEditTarget(record)
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
  }, [])

  /** 表单提交成功：清编辑目标、刷新列表 */
  const handleFormSucceeded = useCallback(() => {
    setEditTarget(null)
    setFormOpen(false)
    reloadList()
  }, [reloadList])

  /* --------------------- 删除告警码（confirmCommand 破坏性确认） --------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = String(id)）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除告警码：按告警码字符串定位（协议原样，非 id）；确认后删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: AlarmCodeRecord) => {
      const rowId = String(record.id)
      void confirmCommand({
        title: t('删除车辆告警码'),
        targets: [record.alarmCode ?? ''],
        impact: t('删除影响：该告警码将从系统移除，车辆上报告警时将不再展示其描述与处理建议'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteAlarmCode({ alarmCode: record.alarmCode ?? '' })
          message.success(t('删除车辆告警码成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除车辆告警码出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* ------------------------- 上传告警码文件（全量覆盖，A15/A16） ------------------------- */

  // 上传防连点：传输期间禁用上传按钮（旧实现 loading 同语义）
  const [uploading, setUploading] = useState(false)

  /** 执行上传：经传输管理器登记（切页继续、关页提示、真实字节进度） */
  const doUpload = useCallback(
    (file: File) => {
      setUploading(true)
      const transfer = beginTransfer({
        tabKey: scope?.scopeKey ?? null,
        kind: 'upload',
        name: file.name,
      })
      uploadAlarmCodeFile(
        file,
        // 真实字节进度上报：total 缺失即不确定进度（不伪造百分比，规格 10.5）
        (event) => transfer.setProgress(event.loaded, event.total ?? null),
        { signal: transfer.signal },
      )
        .then(() => {
          transfer.succeed()
          message.success(t('上传车辆告警码文件成功'))
          reloadList()
        })
        .catch((error: unknown) => {
          if (!isCancelledError(error)) {
            const reason = t('上传车辆告警码文件出错：{{msg}}', { msg: apiErrorMessage(error) })
            transfer.fail(reason)
            message.error(reason)
          } else {
            // 主动取消仅代表本机终止等待：按「结果待确认」语义标记失败说明
            transfer.fail(t('上传车辆告警码文件失败'))
          }
        })
        .finally(() => setUploading(false))
    },
    [message, reloadList, scope, t],
  )

  /** 上传前：校验文件类型，并经破坏性确认（全量覆盖）后手动上传 */
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!isExcel) {
      message.warning(t('仅支持 .xlsx / .xls 格式的文件'))
      return Upload.LIST_IGNORE
    }
    void confirmCommand({
      title: t('上传将全量覆盖'),
      impact: t('上传后将用文件内容覆盖当前所有车辆告警码，是否继续？'),
      danger: true,
      okLabel: t('继续上传'),
    }).then((confirmed) => {
      if (!confirmed) return
      doUpload(file)
    })
    // 返回 false 阻止 antd 自动上传，由 doUpload 手动调用接口
    return false
  }

  /* ----------------------------- 下载告警码文件（A16） ----------------------------- */

  // 下载防连点：在途期间禁用下载按钮（避免重复触发整文件下载）
  const [downloading, setDownloading] = useState(false)

  /** 下载告警码文件：POST Blob 通道；错误 JSON 不落为伪文件（DoD 9），资源释放 */
  const handleDownload = useCallback(() => {
    if (downloading) return
    setDownloading(true)
    const transfer = beginTransfer({
      tabKey: scope?.scopeKey ?? null,
      kind: 'download',
      name: t('车辆告警码.xlsx'),
    })
    downloadAlarmCodeFile({ signal: transfer.signal })
      .then(({ blob, filename }) => {
        // 媒体类型粗校验：JSON/HTML 说明是异常网关/业务错误响应，不保存为伪文件
        if (blob.type.includes('json') || blob.type.includes('html')) {
          transfer.fail(t('下载车辆告警码文件失败'))
          message.error(t('下载车辆告警码文件失败'))
          return
        }
        // 文件名：服务端 content-disposition 优先（RFC 5987 已在服务层解析），
        // 取不到回退本地默认名（旧实现同语义）
        const safeName = filename || t('车辆告警码.xlsx')
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = safeName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        transfer.succeed()
        message.success(t('下载车辆告警码文件成功'))
      })
      .catch((error: unknown) => {
        if (!isCancelledError(error)) {
          const reason = t('下载车辆告警码文件出错：{{msg}}', { msg: apiErrorMessage(error) })
          transfer.fail(reason)
          message.error(reason)
        } else {
          transfer.fail(t('下载车辆告警码文件失败'))
        }
      })
      .finally(() => setDownloading(false))
  }, [downloading, message, scope, t])

  // 本页签在途传输快照：页内进度行呈现（切页继续，回页可见；关页前有确认提示）
  const tabTransfers = useTransfers(transferTabKey)
  const activeTransfers = tabTransfers.filter(
    (task) => task.phase === 'transferring' || task.phase === 'processing',
  )

  /* --------------------------------- 搜索提交 --------------------------------- */

  /** 提交搜索：记录条件并回首页重新查询（旧实现 onSearch 回首页同语义） */
  const handleSearch = useCallback(() => {
    alarmCodeRef.current = searchText.trim()
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [searchText])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<AlarmCodeRecord>[]>(() => {
    return [
      {
        // 告警码：旧列宽 300 原样；缺失留白
        accessorKey: 'alarmCode',
        header: t('告警码'),
        enableSorting: false,
        size: 300,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 告警描述：多语言记录跟随界面语言展示（描述行 + 金色建议行）
        id: 'alarmCodeRecords',
        header: t('告警描述'),
        enableSorting: false,
        size: 420,
        accessorFn: () => '',
        cell: ({ row }) => <AlarmDescCell records={row.original.alarmCodeRecords} uiLocale={uiLocale} />,
      },
      {
        // 创建时间：秒级展示统一走 displayDateTime；缺失/不可解析留白
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 180,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：入口按按钮码控制（无权限隐藏）；删除走破坏性确认
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 180,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === String(record.id)
          return (
            <Space size={4}>
              {/* 编辑告警码：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除告警码：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
              {canDelete ? (
                <Button size="small" danger disabled={pending} onClick={() => handleDelete(record)}>
                  {t('删除')}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ]
  }, [t, uiLocale, canUpdate, canDelete, pendingRowKey, openEdit, handleDelete])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：告警码搜索框（左，旧实现 Search 同形态）+ 新增/上传/下载按钮组（右，
          均按按钮码显隐）；不设手动刷新按钮，新鲜度由写操作成功后的自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('请输入告警码查询')}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button type="primary" icon={<SearchIcon size={14} />} onClick={handleSearch}>
            {t('查询')}
          </Button>
        </div>
        <Space wrap size={8}>
          {/* 新增告警码：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus />} onClick={openCreate}>
              {t('新增告警码')}
            </Button>
          ) : null}
          {/* 上传告警码文件（全量覆盖）：无权限隐藏；类型校验与确认在 beforeUpload */}
          {canUpload ? (
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={beforeUpload} disabled={uploading}>
              <Button type="primary" icon={<UploadCloud size={14} />} loading={uploading}>
                {t('上传告警码文件')}
              </Button>
            </Upload>
          ) : null}
          {/* 下载告警码文件：无权限隐藏；在途防连点 */}
          {canDownload ? (
            <Button icon={<Download size={14} />} loading={downloading} onClick={handleDownload}>
              {t('下载告警码文件')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 本页签在途传输进度行：真实字节进度（切页继续传输，返回本页仍可见） */}
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

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建） */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageAlarmCodes(
              {
                pageNo,
                pageSize,
                ...(alarmCodeRef.current ? { alarmCode: alarmCodeRef.current } : {}),
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
          pagination={{ pageSizeOptions: [10, 20, 50, 100, 200] }}
          columnSettingsEnabled
          height="100%"
          state={{
            columnOrder: prefSlices.columnOrder,
            columnVisibility: prefSlices.columnVisibility,
            columnSizing: prefSlices.columnSizing,
            columnPinning: prefSlices.columnPinning,
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
            persistPrefs({ columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? { start: [], end: [] }) })
          }
        />
      </div>

      {/* 新增/编辑弹窗：常挂保留草稿（新增模式）；编辑目标变化时重填 */}
      <AlarmCodeFormModal
        open={formOpen}
        editTarget={editTarget}
        onClose={closeForm}
        onSucceeded={handleFormSucceeded}
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
