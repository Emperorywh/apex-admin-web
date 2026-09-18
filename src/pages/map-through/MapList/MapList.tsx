/**
 * 地图列表页（P09 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\MapThrough\MapList）：antd Table + 名称/标识搜索
 * + 创建/编辑弹窗 + Popconfirm 删除 + 版本管理弹窗（发布/推送/下载/编辑）
 * + 调度地图（.zip）/车载地图（.bin）导入 + PullModal（拉取，旧实现入口已移除）。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=mapId、
 *   列偏好 map-list:main、内建取消/错误重试）；排序不启用（G09）；
 * - 列结构与旧版逐列核对：地图名称/地图标识(300)/地图状态(120)/当前版本/
 *   楼层(80)/更新人(120)/更新时间/操作(350)；地图状态按旧实现原样
 *   （仅 ENABLED 显示「启用」，其余一律「禁用」）；空值一律留白；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；
 *   旧版仅「确定永久删除当前地图?」一问，控制样板见 P04-P08）；
 * - 版本管理弹窗（发布/推送/下载/编辑导航进 H02）见 VersionModal；
 * - 导入（.zip 调度 / .bin 车载）：扩展名校验 + 传输管理器真实进度
 *   （旧伪进度条废弃，A16）；导入是新增性操作不做破坏性确认（旧实现同）；
 * - 拉取地图入口按 G07 保留禁用说明（downloadMapInfo 未在 OpenAPI，不猜替
 *   语义，也不得用 downloadMap/vehicleDownloadMap 冒充拉取）；
 * - 无权限动作隐藏（按钮码 map-list:add/upload-dispatcher-map/upload-vehicle-map/
 *   update/delete/version 与 map-version:update/publish/download，与旧 §7 一致；
 *   菜单码 map-list:view 挂路由守卫）；
 * - 地图元数据为配置数据不轮询（DoD 7），新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Space, Tooltip } from 'antd'
import { ArrowDownToLine, Car, CloudDownload, Plus, Search as SearchIcon } from 'lucide-react'
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
import {
  deleteMap,
  pageMaps,
  uploadDispatcherMapFile,
  uploadVehicleMapFile,
} from '@/services/map/map-admin.service'
import type { MapInfoDto } from '@/services/map/map-admin.service.types'
import { MapFormModal } from '@/features/map-list/components/MapFormModal'
import { MapUploadButton } from '@/features/map-list/components/MapUploadButton'
import { VersionModal } from '@/features/map-list/components/VersionModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './MapList.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function MapList() {
  const { t } = useTranslation('mapList')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：创建/导入/编辑/删除/版本管理，无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.MAP_LIST_ADD)
  const canUploadDispatcher = hasPerm(PERM_BUTTON.MAP_LIST_UPLOAD_DISPATCHER_MAP)
  const canUploadVehicle = hasPerm(PERM_BUTTON.MAP_LIST_UPLOAD_VEHICLE_MAP)
  const canUpdate = hasPerm(PERM_BUTTON.MAP_LIST_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.MAP_LIST_DELETE)
  const canVersion = hasPerm(PERM_BUTTON.MAP_LIST_VERSION)

  // 页签 scope：传输登记与页内传输过滤都按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()
  const transferTabKey = scope?.scopeKey ?? null

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<MapInfoDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('map-list:main')
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
  const [editTarget, setEditTarget] = useState<MapInfoDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: MapInfoDto) => {
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

  // 版本管理弹窗：当前地图（null=关闭）
  const [versionMapId, setVersionMapId] = useState<string | null>(null)
  const [versionMapName, setVersionMapName] = useState<string | null>(null)

  const openVersions = useCallback((record: MapInfoDto) => {
    setVersionMapId(record.mapId ?? null)
    setVersionMapName(record.mapName ?? null)
  }, [])

  /** 版本弹窗关闭：刷新主列表（发布/推送可能改变当前版本——旧实现同联动） */
  const closeVersions = useCallback(() => {
    setVersionMapId(null)
    setVersionMapName(null)
    reloadList()
  }, [reloadList])

  /* --------------------- 删除地图（confirmCommand 破坏性确认） --------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = mapId）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除地图：按 mapId 定位（协议原样）；确认后删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: MapInfoDto) => {
      const rowId = record.mapId ?? ''
      void confirmCommand({
        title: t('删除地图'),
        targets: [record.mapName ?? ''],
        impact: t('删除影响：该地图及其全部版本数据将被永久删除，且不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteMap({ mapId: record.mapId ?? '' })
          message.success(t('删除地图成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除地图出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* ----------------------------- 本页签在途传输快照 ----------------------------- */

  const tabTransfers = useTransfers(transferTabKey)
  const activeTransfers = tabTransfers.filter(
    (task) => task.phase === 'transferring' || task.phase === 'processing',
  )

  /* --------------------------------- 搜索提交 --------------------------------- */

  /** 提交搜索：记录条件并回首页重新查询（旧实现 onSearch 回首页同语义） */
  const handleSearch = useCallback(() => {
    queryRef.current = searchText.trim()
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [searchText])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<MapInfoDto>[]>(() => {
    return [
      {
        // 地图名称：旧版无固定宽（弹性列）；缺失留白
        accessorKey: 'mapName',
        header: t('地图名称'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 地图标识：旧列宽 300 原样
        accessorKey: 'mapId',
        header: t('地图标识'),
        enableSorting: false,
        size: 300,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 地图状态：旧实现原样——仅 ENABLED 显示「启用」，其余（含缺失）「禁用」
        accessorKey: 'mapState',
        header: t('地图状态'),
        enableSorting: false,
        size: 120,
        cell: (info) => (info.getValue() === 'ENABLED' ? t('启用') : t('禁用')),
      },
      {
        // 当前版本：弹性列；缺失留白
        accessorKey: 'mapVersion',
        header: t('当前版本'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 楼层：旧列宽 80 原样；缺失留白
        accessorKey: 'floor',
        header: t('楼层'),
        enableSorting: false,
        size: 80,
        cell: (info) => {
          const value = info.getValue()
          return value === null || value === undefined ? null : String(value)
        },
      },
      {
        // 更新人：旧列宽 120 原样
        accessorKey: 'updateUser',
        header: t('更新人'),
        enableSorting: false,
        size: 120,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 更新时间：秒级展示统一走 displayDateTime；缺失/不可解析留白
        accessorKey: 'updateTime',
        header: t('更新时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：入口按按钮码控制（无权限隐藏）；删除走破坏性确认
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 350,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === (record.mapId ?? '')
          return (
            <Space size={4}>
              {/* 编辑地图：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除地图：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
              {canDelete ? (
                <Button size="small" danger disabled={pending} onClick={() => handleDelete(record)}>
                  {t('删除')}
                </Button>
              ) : null}
              {/* 版本管理：无权限隐藏；打开当前地图的版本弹窗 */}
              {canVersion ? (
                <Button size="small" onClick={() => openVersions(record)}>
                  {t('版本管理')}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ]
  }, [t, canUpdate, canDelete, canVersion, pendingRowKey, openEdit, openVersions, handleDelete])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：名称/标识搜索框（左，旧实现 Search 同形态）+ 创建/导入按钮组（右，
          均按按钮码显隐）；不设手动刷新按钮，新鲜度由写操作成功后的自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('根据(名称/标识)查询')}
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
          {/* 创建地图：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('创建地图')}
            </Button>
          ) : null}
          {/* 导入调度地图（.zip）：无权限隐藏；类型校验与真实进度在 MapUploadButton */}
          {canUploadDispatcher ? (
            <MapUploadButton
              accept=".zip"
              buttonText={t('导入调度地图')}
              icon={<ArrowDownToLine size={14} />}
              uploadFn={uploadDispatcherMapFile}
              successText={t('上传地图成功，请前往版本管理中发布该地图')}
              errorTextKey="上传地图出错：{{msg}}"
              onSucceeded={reloadList}
            />
          ) : null}
          {/* 导入车载地图（.bin）：无权限隐藏；同上 */}
          {canUploadVehicle ? (
            <MapUploadButton
              accept=".bin"
              buttonText={t('导入车载地图')}
              icon={<Car size={14} />}
              uploadFn={uploadVehicleMapFile}
              successText={t('上传车载地图成功')}
              errorTextKey="上传车载地图出错：{{msg}}"
              onSucceeded={reloadList}
            />
          ) : null}
          {/* 拉取地图（G07 缺口）：旧 PullModal 的 downloadMapInfo 未出现在 OpenAPI，
              后端契约未核实——入口保留禁用并说明原因，不猜替 downloadMap 语义 */}
          <Tooltip title={t('地图拉取接口暂未在服务契约中提供，入口保留待后端确认后开放')}>
            <Button icon={<CloudDownload size={14} />} disabled>
              {t('拉取地图')}
            </Button>
          </Tooltip>
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
            return pageMaps(
              {
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
          getRowId={stringFieldRowId('mapId')}
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
      <MapFormModal
        open={formOpen}
        editTarget={editTarget}
        onClose={closeForm}
        onSucceeded={handleFormSucceeded}
      />

      {/* 版本管理弹窗：发布/推送/下载/编辑导航；关闭时刷新主列表（旧实现同联动） */}
      <VersionModal
        open={versionMapId !== null}
        mapId={versionMapId}
        mapName={versionMapName}
        onClose={closeVersions}
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
