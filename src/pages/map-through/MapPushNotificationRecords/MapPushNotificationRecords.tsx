/**
 * 地图推送记录页（P12 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\MapThrough\MapPushNotificationRecords）：antd Table +
 * 手动刷新按钮 + 主表（一次推送批次一行）+ 展开行子表（车辆子记录，前端筛选分页）+
 * 记录级/子记录级「重新推送」「取消推送」（Popconfirm 一问）。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=id
 *   （int64 主键，stringFieldRowId 收敛字符串）、列偏好 map-push-record:main、
 *   内建取消/错误重试）；接口仅有分页参数，不支持筛选与排序（G09）；
 * - 列结构与旧版逐列核对：地图名称 170/地图版本 150/推送SLAM底图 120（是/否）/
 *   推送结果（子记录状态计数 Tag 汇总，弹性）/创建时间 170/操作 250（钉右）；
 *   空值一律留白（旧「-」占位废弃）；
 * - 推送状态异步演进（P09 推送命令受理后由后端推进），本页是命令状态追踪页：
 *   接入 useVisiblePolling 约 5 秒可见串行轮询（页签激活且文档可见才刷新，
 *   后台保留快照、恢复即查、失败退避——A12/D14，P05 控制样板同款）；
 *   旧版手动刷新按钮按按钮纪律废弃（新鲜度=可见轮询+写后自动刷新）；
 * - 重新推送/取消推送（记录级整批、子记录级单台）升级 confirmCommand 命令确认
 *   （列明对象车辆与影响 + 「提交≠完成」固定附注；旧版仅 Popconfirm 一问）；
 *   命令受理成功提示按受理语义呈现，最终状态以重新查询为准（A14/A15）；
 *   仅等待/推送中的子记录存在未完成推送可取消，整批取消仅在该批存在可取消
 *   子记录时开放入口（旧实现同边界）；命令超时/失败不自动补发，
 *   状态核实依赖本页轮询的真实记录，无任何本地伪造状态；
 * - 无权限动作隐藏（按钮码 map-push-record:re-push，重推与取消共用同一按钮码
 *   ——后端未提供取消专用码，旧实现同边界；菜单码 map-push-record:view 挂路由守卫）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Space, Tag } from 'antd'
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
import { useVisiblePolling } from '@/hooks/useVisiblePolling'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import {
  cancelPushMap,
  pageMapPushRecords,
  rePushMap,
} from '@/services/map-push-record/map-push-record.service'
import type {
  MapPushRecordDto,
  MapPushState,
  MapPushSubRecordDto,
} from '@/services/map-push-record/map-push-record.service.types'
import MapPushSubRecordTable from '@/features/map-push-record/components/MapPushSubRecordTable'
import { isSubRecordCancellable } from '@/features/map-push-record/utils/pushState'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './MapPushNotificationRecords.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 推送状态 → antd Tag 语义色（主表「推送结果」计数 Tag 与子表共用一套语义） */
const STATE_COLOR: Record<MapPushState, string> = {
  WAITING: 'orange',
  RUNNING: 'processing',
  FAILED: 'error',
  SUCCEEDED: 'success',
  CANCELLED: 'default',
}

/** 状态 → 界面文案 key（中文 key 即文案；未知枚举不经此表，显示协议原值） */
const STATE_LABEL_KEY: Record<MapPushState, string> = {
  WAITING: '等待',
  RUNNING: '推送中',
  FAILED: '失败',
  SUCCEEDED: '成功',
  CANCELLED: '已取消',
}

export default function MapPushNotificationRecords() {
  const { t } = useTranslation('mapPushRecord')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 操作按钮权限：重新推送与取消推送共用同一按钮码（后端暂无取消专用码，旧实现同边界）
  const { hasPerm } = usePermission()
  const canOperate = hasPerm(PERM_BUTTON.MAP_PUSH_RECORD_RE_PUSH)

  /* --------------------------------- 列表与刷新 --------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<MapPushRecordDto>>(null)

  /** 操作后统一刷新列表（写操作成功的主刷新入口；轮询复用同一入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  // 推送状态由后端异步推进（命令受理 ≠ 子记录终态），状态核实依赖持续重查：
  // 可见时约 5 秒串行轮询，后台保留快照、恢复即查、失败退避（A12/D14）
  useVisiblePolling({
    refresh: async () => {
      reloadList()
    },
  })

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('map-push-record:main')
  const [prefSlices, setPrefSlices] = useState<ColumnPrefSlices>({})
  const prefSlicesRef = useRef<ColumnPrefSlices>({})

  // 操作列默认钉右（旧实现 fixed:'right' 同语义）；用户保存过列偏好后以偏好为准
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

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

  /* ------------------------- 命令在途状态（行级防连点） ------------------------- */

  // 记录级命令在途的记录行 ID：同一批次行只允许一个在途命令（重推/取消互斥）
  const [pendingRecordKey, setPendingRecordKey] = useState<string | null>(null)
  // 子记录级命令在途的子记录行 ID：与记录级分开维护，避免两处按钮互相误禁用
  const [pendingSubKey, setPendingSubKey] = useState<string | null>(null)

  /**
   * 统一执行重推/取消命令（确认框、防连点、请求、反馈由页面层收敛）：
   * - 请求成功按「受理」语义提示（命令提交 ≠ 推送完成，最终状态以重新查询为准）；
   * - 失败如实透传后端 message；主动取消（页签关闭等）静默；
   * - 命令失败/超时不自动补发——状态核实完全依赖本页轮询的真实记录。
   */
  const runCommand = useCallback(
    async (
      kind: 'rePush' | 'cancelPush',
      params: { mapPushRecordId: number; mapPushSubRecordIds?: number[] },
    ) => {
      const request = kind === 'rePush' ? rePushMap : cancelPushMap
      try {
        await request(params)
        message.success(kind === 'rePush' ? t('已发起重新推送') : t('已发起取消推送'))
        reloadList()
      } catch (error) {
        if (!isCancelledError(error)) {
          const fallback = kind === 'rePush' ? '重新推送出错：{{msg}}' : '取消推送出错：{{msg}}'
          message.error(t(fallback, { msg: apiErrorMessage(error) }))
        }
      }
    },
    [message, reloadList, t],
  )

  /** 记录级重新推送：确认对象=该批次全部子记录车辆（后端对全部车辆重推） */
  const handleRecordRePush = useCallback(
    (record: MapPushRecordDto) => {
      const rowId = String(record.id ?? '')
      const subs = record.mapPushSubRecords ?? []
      void confirmCommand({
        title: t('重新推送'),
        targets: subs.map((sub) => sub.vehicleName ?? sub.vehicleKey ?? ''),
        impact: t(
          '重新推送影响：将对该批次下全部车辆重新推送地图 {{mapName}}（{{mapVersion}}），推送结果以列表状态为准',
          { mapName: record.mapName ?? '', mapVersion: record.mapVersion ?? '' },
        ),
      }).then(async (confirmed) => {
        if (!confirmed || record.id === undefined || record.id === null) return
        setPendingRecordKey(rowId)
        try {
          await runCommand('rePush', { mapPushRecordId: record.id })
        } finally {
          setPendingRecordKey(null)
        }
      })
    },
    [t, runCommand],
  )

  /** 记录级取消推送：确认对象=该批次仍在等待/推送中的车辆（已结束的推送不参与取消） */
  const handleRecordCancelPush = useCallback(
    (record: MapPushRecordDto) => {
      const rowId = String(record.id ?? '')
      const cancellable = (record.mapPushSubRecords ?? []).filter((sub) =>
        isSubRecordCancellable(sub.mapPushState),
      )
      void confirmCommand({
        title: t('取消推送'),
        targets: cancellable.map((sub) => sub.vehicleName ?? sub.vehicleKey ?? ''),
        impact: t('取消推送影响：将取消该批次下未完成的地图推送，已完成的推送结果不受影响'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed || record.id === undefined || record.id === null) return
        setPendingRecordKey(rowId)
        try {
          await runCommand('cancelPush', { mapPushRecordId: record.id })
        } finally {
          setPendingRecordKey(null)
        }
      })
    },
    [t, runCommand],
  )

  /** 子记录级重推：确认对象=单台车辆 */
  const handleSubRePush = useCallback(
    (sub: MapPushSubRecordDto) => {
      const rowId = String(sub.id ?? '')
      void confirmCommand({
        title: t('重推'),
        targets: [sub.vehicleName ?? sub.vehicleKey ?? ''],
        impact: t('重推影响：将向该车辆重新推送地图，推送结果以列表状态为准'),
      }).then(async (confirmed) => {
        if (
          !confirmed ||
          sub.mapPushRecordId === undefined ||
          sub.mapPushRecordId === null ||
          sub.id === undefined ||
          sub.id === null
        )
          return
        setPendingSubKey(rowId)
        try {
          await runCommand('rePush', {
            mapPushRecordId: sub.mapPushRecordId,
            mapPushSubRecordIds: [sub.id],
          })
        } finally {
          setPendingSubKey(null)
        }
      })
    },
    [t, runCommand],
  )

  /** 子记录级取消推送：确认对象=单台车辆（仅等待/推送中入口可见） */
  const handleSubCancelPush = useCallback(
    (sub: MapPushSubRecordDto) => {
      const rowId = String(sub.id ?? '')
      void confirmCommand({
        title: t('取消推送'),
        targets: [sub.vehicleName ?? sub.vehicleKey ?? ''],
        impact: t('取消推送影响：将取消该车辆未完成的地图推送，已完成的推送结果不受影响'),
        danger: true,
      }).then(async (confirmed) => {
        if (
          !confirmed ||
          sub.mapPushRecordId === undefined ||
          sub.mapPushRecordId === null ||
          sub.id === undefined ||
          sub.id === null
        )
          return
        setPendingSubKey(rowId)
        try {
          await runCommand('cancelPush', {
            mapPushRecordId: sub.mapPushRecordId,
            mapPushSubRecordIds: [sub.id],
          })
        } finally {
          setPendingSubKey(null)
        }
      })
    },
    [t, runCommand],
  )

  /* --------------------- 主表「推送结果」列：子记录状态计数汇总 --------------------- */

  /**
   * 按状态汇总该批次下各子记录计数（旧实现同形态 Tag 列表）；
   * 未知枚举按协议原值归入 default 灰 Tag（不猜语义、不丢弃）；
   * 无子记录留白（旧「-」占位按空值纪律废弃）。
   */
  const renderStateSummary = useCallback(
    (subs: MapPushSubRecordDto[] | undefined) => {
      if (!subs || subs.length === 0) return null
      const counts = new Map<string, number>()
      subs.forEach((sub) => {
        const key = sub.mapPushState ?? ''
        counts.set(key, (counts.get(key) ?? 0) + 1)
      })
      return (
        <Space size={[4, 4]} wrap>
          {[...counts.entries()].map(([state, count]) => {
            const known =
              state !== '' && Object.prototype.hasOwnProperty.call(STATE_LABEL_KEY, state)
            const label = known ? t(STATE_LABEL_KEY[state as MapPushState]) : state
            return (
              <Tag
                key={state || 'unknown'}
                color={known ? STATE_COLOR[state as MapPushState] : 'default'}
              >
                {label} {count}
              </Tag>
            )
          })}
        </Space>
      )
    },
    [t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<MapPushRecordDto>[]>(() => {
    return [
      {
        // 地图名称：旧版 170；缺失留白
        accessorKey: 'mapName',
        header: t('地图名称'),
        enableSorting: false,
        size: 170,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 地图版本：旧版 150（版本串如 V1784014836012 较长）；缺失留白
        accessorKey: 'mapVersion',
        header: t('地图版本'),
        enableSorting: false,
        size: 150,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 推送SLAM底图：旧版 120；boolean 明确 false 显示「否」，缺失留白（false ≠ 缺失）
        accessorKey: 'enabledPushSlamMap',
        header: t('推送SLAM底图'),
        enableSorting: false,
        size: 120,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined) return null
          return value ? t('是') : t('否')
        },
      },
      {
        // 推送结果：子记录状态计数 Tag 汇总（弹性列；无子记录留白）
        accessorKey: 'mapPushSubRecords',
        header: t('推送结果'),
        enableSorting: false,
        cell: ({ row }) => renderStateSummary(row.original.mapPushSubRecords),
      },
      {
        // 创建时间：旧版 170；秒级展示统一走 displayDateTime；缺失/不可解析留白
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：重新推送（primary）+ 取消推送（danger link）；入口按按钮码控制，
        // 无权限隐藏；整批取消仅在该批存在等待/推送中子记录时开放（旧实现同边界）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 250,
        cell: ({ row }) => {
          const record = row.original
          const rowId = String(record.id ?? '')
          const pending = pendingRecordKey !== null && pendingRecordKey === rowId
          if (!canOperate) return null
          const hasCancellable = (record.mapPushSubRecords ?? []).some((sub) =>
            isSubRecordCancellable(sub.mapPushState),
          )
          return (
            <Space size={4}>
              <Button
                type="primary"
                size="small"
                disabled={pending}
                onClick={() => handleRecordRePush(record)}
              >
                {t('重新推送')}
              </Button>
              {hasCancellable ? (
                <Button
                  type="link"
                  size="small"
                  danger
                  disabled={pending}
                  onClick={() => handleRecordCancelPush(record)}
                >
                  {t('取消推送')}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ]
  }, [
    t,
    canOperate,
    pendingRecordKey,
    handleRecordRePush,
    handleRecordCancelPush,
    renderStateSummary,
  ])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；
          展开行显示该批次车辆子记录子表（含前端筛选分页与行级重推/取消），
          无子记录的行不展示展开箭头（旧实现同边界）。
          本页无筛选参数（接口仅分页）、无新增类入口（推送发起在 P09 地图列表），
          不设工具行与手动刷新按钮（按钮纪律），新鲜度由可见轮询+写后刷新保证 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageMapPushRecords({ pageNo, pageSize }, { signal: params.signal }).then(
              (page) => ({
                // rowCount 取真实 total；未知总数不由前端补 0（DoD 5）
                data: page.records ?? [],
                rowCount: page.total ?? 0,
              }),
            )
          }}
          getRowId={stringFieldRowId('id')}
          expandable={{
            expandedRowRender: (record) => (
              // 子表组件自带筛选/分页/操作；确认与请求统一在页面层处理
              <MapPushSubRecordTable
                subs={record.mapPushSubRecords ?? []}
                canOperate={canOperate}
                pendingSubKey={pendingSubKey}
                onRePush={handleSubRePush}
                onCancelPush={handleSubCancelPush}
              />
            ),
            rowExpandable: (record) => (record.mapPushSubRecords?.length ?? 0) > 0,
          }}
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
            persistPrefs({
              columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}),
            })
          }
          onColumnSizingChange={(updater) =>
            persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
          }
          onColumnPinningChange={(updater) =>
            persistPrefs({
              columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? defaultPinning),
            })
          }
        />
      </div>
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
