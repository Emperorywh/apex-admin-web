/**
 * 车辆分组页（P04 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\VehicleDeploy\VehicleGroup）：antd Table +
 * 搜索框 + 新增/编辑弹窗（Transfer 穿梭框）+ Popconfirm 删除。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID、列偏好、
 *   内建取消/错误重试）；排序不启用（G09：旧页面无排序，后端未声明全量排序）；
 * - 组内车辆沿用旧实现展开行形态（expandable 内 Tag 列表，组内无车不可展开）；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；
 *   旧版仅「确认删除此项?」一问，控制样板见 P05）；
 * - 新增/编辑弹窗草稿保留（GroupFormModal 常挂，A13/DoD 7）；
 * - 无权限动作隐藏（按钮码 VEHICLE_GROUP_ADD/UPDATE/DELETE，与旧 §7 一致）；
 * - 普通 CRUD 配置数据不轮询（DoD 7：仅实时页按需轮询），新鲜度由写操作
 *   成功后的自动刷新保证；无手动刷新按钮（按钮纪律）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Space, Tag, Tooltip } from 'antd'
import { Plus } from 'lucide-react'
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
import { useTranslation } from 'react-i18next'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import {
  deleteVehicleGroup,
  pageVehicleGroups,
} from '@/services/vehicle/vehicle-group.service'
import type { VehicleGroupRecordDto } from '@/services/vehicle/vehicle-group.service.types'
import { GroupFormModal } from '@/features/vehicle-group/components/GroupFormModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './VehicleGroup.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function VehicleGroup() {
  const { t } = useTranslation('vehicleGroup')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：新增/编辑/删除分组，动作触发型无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.VEHICLE_GROUP_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.VEHICLE_GROUP_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.VEHICLE_GROUP_DELETE)

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<VehicleGroupRecordDto>>(null)

  // 筛选条件经 ref 供 request 回调读取最新值（避免闭包捕获旧筛选）
  const queryRef = useRef<string>('')
  const [queryText, setQueryText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('vehicle-group:main')
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
  const [editTarget, setEditTarget] = useState<VehicleGroupRecordDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: VehicleGroupRecordDto) => {
    setEditTarget(record)
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
  }, [])

  /** 表单提交成功：清编辑目标、刷新列表（组内车辆变化随之反映） */
  const handleFormSucceeded = useCallback(() => {
    setEditTarget(null)
    setFormOpen(false)
    reloadList()
  }, [reloadList])

  /* ------------------------------- 删除分组（破坏性确认） ------------------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 展示名（名称 + 标识），确认框列明对象用 */
  const describeTarget = useCallback(
    (record: VehicleGroupRecordDto) =>
      `${record.agvGroupName ?? ''}（${record.agvGroupKey ?? ''}）`,
    [],
  )

  /** 删除分组：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: VehicleGroupRecordDto) => {
      const groupKey = record.agvGroupKey ?? ''
      void confirmCommand({
        title: t('删除车辆分组'),
        targets: [describeTarget(record)],
        impact: t('删除影响：车辆分组将从系统移除，请确认无调度配置正在引用该分组'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(groupKey)
        try {
          await deleteVehicleGroup({ key: groupKey })
          message.success(t('删除车辆分组成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除车辆分组出错') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [describeTarget, message, reloadList, t],
  )

  /* --------------------------------- 搜索与筛选 --------------------------------- */

  /** 提交筛选：记录条件并回首页重新查询（Apex request 模式下取消由表格内建） */
  const handleSearch = useCallback((value: string) => {
    queryRef.current = value.trim()
    setQueryText(queryRef.current)
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<VehicleGroupRecordDto>[]>(() => {
    /** 文本单元格：空值留白、悬浮显示全文 */
    const textCell = (maxWidth: number) => (info: { getValue: () => unknown }) => {
      const value = info.getValue()
      const text = value === null || value === undefined || value === '' ? '' : String(value)
      return (
        <Tooltip title={text} placement="topLeft">
          <span className={styles.ellipsis} style={{ maxWidth: maxWidth - 16 }}>
            {text}
          </span>
        </Tooltip>
      )
    }

    return [
      {
        accessorKey: 'agvGroupName',
        header: t('分组名称'),
        enableSorting: false,
        size: 220,
        cell: textCell(220),
      },
      {
        accessorKey: 'agvGroupKey',
        header: t('标识'),
        enableSorting: false,
        size: 220,
        cell: textCell(220),
      },
      {
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 170,
        meta: { apex: { align: 'center' } },
        // 展示层统一秒级格式；缺失/不可解析留白（不写「—」占位）
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：固定右侧不参与偏好持久化；入口按按钮码控制（无权限隐藏）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 170,
        meta: { apex: { align: 'center' } },
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === record.agvGroupKey
          return (
            <Space size={4}>
              {/* 编辑分组：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除分组：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
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
  }, [t, canUpdate, canDelete, pendingRowKey, openEdit, handleDelete])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左）+ 新增分组（右）；不设手动刷新按钮，新鲜度由写操作
          成功后的自动刷新保证（普通 CRUD 配置数据不轮询） */}
      <div className={styles.toolbar}>
        <Input.Search
          className={styles.search}
          placeholder={t('根据(名称/标识)查询')}
          enterButton
          allowClear
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          onSearch={handleSearch}
        />
        <Space wrap size={8}>
          {/* 新增分组：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus />} onClick={openCreate}>
              {t('新增分组')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；
          展开行显示组内车辆 Tag（旧实现同形态，组内无车不可展开） */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageVehicleGroups(
              { pageNo, pageSize, ...(queryRef.current ? { query: queryRef.current } : {}) },
              { signal: params.signal },
            ).then((page) => ({
              data: page.records ?? [],
              rowCount: page.total ?? 0,
            }))
          }}
          getRowId={stringFieldRowId('agvGroupKey')}
          expandable={{
            expandedRowRender: (record) => (
              <Space wrap size={4}>
                {(record.simpleAGVs ?? []).map((agv) => (
                  // 组内车辆 Tag：名称缺失退回原 key（不猜测、不留白丢失标识）
                  <Tag key={agv.key} color="blue">
                    {agv.name ?? agv.key}
                  </Tag>
                ))}
              </Space>
            ),
            rowExpandable: (record) => (record.simpleAGVs?.length ?? 0) > 0,
          }}
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
      <GroupFormModal
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
