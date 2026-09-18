/**
 * 车辆列表页（P05 整页重写：控制交互样板）。
 *
 * 旧实现（C:\code\dd\src\pages\VehicleDeploy\VehicleDisplay）：antd Table +
 * 搜索框 + 接入/编辑弹窗 + 详情抽屉 + 跨页勾选批量指令，状态仅手动查询。
 * 本重写保持业务闭环等价并按规格升级控制基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID、列偏好、
 *   内建取消/错误重试）；排序不启用（G09：旧页面无排序，后端未声明全量排序——
 *   旧 SPEC_VehicleList_Sort.md 属 Overlook 面板 WebSocket 全量列表，不适用本页）；
 * - 状态查询只在可见时按需轮询（useVisiblePolling 约 5 秒串行；后台保留快照，
 *   重新激活立即刷新——A12/D14，替代旧版「不轮询也不刷新」）；
 * - 控制样板（本页建立、设备类页面复用）：写命令先 confirmCommand 列明对象与
 *   影响，执行前核验目标最新状态（verifyVehicleFresh：快照过期/目标缺失不执行，
 *   刷新后由用户重新确认——规格 8.2「影响现场的操作需先核验新状态」）；
 * - 批量指令按整批接受诚实呈现（真实返回无逐项结果，不伪造逐车完成——A15）；
 * - 行选择：TanStack 受控 RowSelectionState（按行 ID 跨页保留），筛选/删除/
 *   批量成功后清理无效选择；表头勾选仅当前页（表格内建语义，同旧版）；
 * - 接入/编辑弹窗草稿保留（新增模式，A13/DoD 7）；详情为页内抽屉快速预览
 *   （旧版等价；独立详情页归 P39，完成后联验完整详情链路）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Dropdown, Input, Space, Switch, Tag, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
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
  RowSelectionState,
} from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { useVisiblePolling } from '@/hooks/useVisiblePolling'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteVehicle,
  operateAllVehicles,
  operateVehicle,
  pageVehicles,
  updateVehicle,
} from '@/services/vehicle/vehicle-manage.service'
import type {
  VehicleOperateCommand,
  VehicleRecordDto,
} from '@/services/vehicle/vehicle-manage.service.types'
import { verifyVehicleFresh } from '@/features/vehicle-list/vehicleStateVerify'
import {
  CONNECTION_STATE_LABEL,
  CONNECTION_STATE_TAG_COLOR,
  OPERATE_IMPACT_KEY,
  VEHICLE_BATCH_OPERATE_ITEMS,
  VEHICLE_OPERATE_ITEMS,
  VEHICLE_TYPE_LABEL,
  toFormParam,
} from '@/features/vehicle-list/vehicleListOptions'
import { VehicleFormModal } from '@/features/vehicle-list/components/VehicleFormModal'
import { VehicleDetailDrawer } from '@/features/vehicle-list/components/VehicleDetailDrawer'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './VehicleDisplay.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function VehicleDisplay() {
  const { t } = useTranslation('vehicleList')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：动作触发型无权限隐藏，调度状态 Switch 用 disabled
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.VEHICLE_LIST_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.VEHICLE_LIST_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.VEHICLE_LIST_DELETE)
  const canOperate = hasPerm(PERM_BUTTON.VEHICLE_LIST_OPERATE)
  const canEnable = hasPerm(PERM_BUTTON.VEHICLE_LIST_ENABLE)
  const canBatchOperate = hasPerm(PERM_BUTTON.VEHICLE_LIST_BATCH_OPERATE)

  /* ------------------------------- 列表与选择状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<VehicleRecordDto>>(null)

  // 筛选条件经 ref 供 request 回调读取最新值（避免闭包捕获旧筛选）
  const queryRef = useRef<string>('')
  const [queryText, setQueryText] = useState('')

  // 行选择（TanStack 受控，按行 ID 跨页保留）；同步维护 key→名称映射供确认框列明对象
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selectedNamesRef = useRef<Map<string, string>>(new Map())
  const selectedKeys = useMemo(() => Object.keys(rowSelection).filter((key) => rowSelection[key]), [rowSelection])

  const clearSelection = useCallback(() => {
    setRowSelection({})
    selectedNamesRef.current = new Map()
  }, [])

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* ------------------------------- 实时轮询（约 5 秒） ------------------------------- */

  // 状态查询只在可见时按需轮询：页签激活且文档可见才刷新；后台保留快照、恢复即查
  useVisiblePolling({ refresh: async () => { reloadList() } })

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('vehicle-list:main')
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
  const [editTarget, setEditTarget] = useState<VehicleRecordDto | null>(null)
  const [detailTarget, setDetailTarget] = useState<VehicleRecordDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: VehicleRecordDto) => {
    setEditTarget(record)
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
  }, [])

  /** 表单提交成功：清编辑目标、刷新列表（未关联选项集合变化由弹窗下次打开重查） */
  const handleFormSucceeded = useCallback(() => {
    setEditTarget(null)
    setFormOpen(false)
    reloadList()
  }, [reloadList])

  /* ------------------------- 控制命令：核验 → 执行（样板链路） ------------------------- */

  // 行级写操作防连点：同一天行只允许一个在途命令
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)
  // 批量指令在途标记（防重复提交）
  const [batchPending, setBatchPending] = useState(false)

  /** 展示名（名称 + 标识），确认框列明对象用 */
  const describeTarget = useCallback(
    (record: VehicleRecordDto) => `${record.name ?? ''}（${record.key ?? ''}）`,
    [],
  )

  /** 核验结论 → 用户提示（不执行并刷新列表，让用户基于新状态重新决定） */
  const warnStale = useCallback(
    (outcome: 'missing' | 'stale') => {
      if (outcome === 'missing') {
        message.warning(t('未查询到车辆最新状态，可能已被删除，请刷新后重试'))
      } else {
        message.warning(t('车辆状态已变化，已为你刷新列表，请重新确认后再操作'))
      }
      reloadList()
    },
    [message, reloadList, t],
  )

  /**
   * 单车指令执行（暂停/继续）：确认 → 核验状态 → 发命令。
   * 命令接受仅代表调度系统受理，动作完成以列表轮询的真实状态为准。
   */
  const executeRowOperate = useCallback(
    async (record: VehicleRecordDto, operate: 'PAUSE' | 'CONTINUE') => {
      const vehicleKey = record.key ?? ''
      setPendingRowKey(vehicleKey)
      try {
        const check = await verifyVehicleFresh(vehicleKey, record)
        if (check.outcome !== 'ok') {
          warnStale(check.outcome)
          return
        }
        await operateVehicle({ vehicleKey, operate })
        message.success(t('车辆操作成功'))
        reloadList()
      } catch (error) {
        if (!isCancelledError(error)) {
          message.error(t('车辆操作出错') + apiErrorMessage(error))
        }
      } finally {
        setPendingRowKey(null)
      }
    },
    [message, reloadList, t, warnStale],
  )

  /** 单车指令菜单：确认框列明对象与影响，确认后才进入核验与执行 */
  const renderOperateMenu = useCallback(
    (record: VehicleRecordDto): ReactNode => {
      const items: MenuProps['items'] = VEHICLE_OPERATE_ITEMS.map((item) => ({
        key: item.key,
        label: t(item.label),
      }))
      const pending = pendingRowKey !== null && pendingRowKey === record.key
      return (
        <Dropdown
          trigger={['click']}
          menu={{
            items,
            onClick: ({ key }) => {
              const definition = VEHICLE_OPERATE_ITEMS.find((item) => item.key === key)
              if (!definition) return
              void confirmCommand({
                title: t('车辆操作确认'),
                targets: [describeTarget(record)],
                impact: t(OPERATE_IMPACT_KEY[definition.key]),
              }).then((confirmed) => {
                if (confirmed) void executeRowOperate(record, definition.key)
              })
            },
          }}
        >
          <Button size="small" type="primary" loading={pending}>
            {t('操作')}
          </Button>
        </Dropdown>
      )
    },
    [describeTarget, executeRowOperate, pendingRowKey, t],
  )

  /**
   * 调度状态切换（旧实现经 updateVehicle 全量翻转，协议通道保持一致）：
   * 确认 → 核验状态（快照过期即拦截）→ updateVehicle → 刷新。
   */
  const handleDispatchToggle = useCallback(
    (record: VehicleRecordDto) => {
      const next = record.dispatchState === 'ENABLE' ? 'DISABLE' : 'ENABLE'
      const vehicleKey = record.key ?? ''
      void confirmCommand({
        title: t('调度状态确认'),
        targets: [describeTarget(record)],
        impact: t(OPERATE_IMPACT_KEY[next === 'ENABLE' ? 'ENABLED' : 'DISABLED']),
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(vehicleKey)
        try {
          const check = await verifyVehicleFresh(vehicleKey, record)
          if (check.outcome !== 'ok') {
            warnStale(check.outcome)
            return
          }
          await updateVehicle({ ...toFormParam(record), dispatchState: next })
          message.success(t('编辑车辆成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('编辑车辆出错') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [describeTarget, message, reloadList, t, warnStale],
  )

  /** 删除车辆：高危确认（danger）→ 删除 → 清理选择集与列表 */
  const handleDelete = useCallback(
    (record: VehicleRecordDto) => {
      const vehicleKey = record.key ?? ''
      void confirmCommand({
        title: t('删除车辆'),
        targets: [describeTarget(record)],
        impact: t('删除影响：车辆将从调度系统移除，如需继续参与调度须重新接入'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(vehicleKey)
        try {
          await deleteVehicle({ key: vehicleKey })
          message.success(t('删除车辆成功'))
          // 被删车辆从跨页选择集中移除，避免残留失效 key 传给批量指令
          setRowSelection((prev) => {
            if (!(vehicleKey in prev)) return prev
            const next = { ...prev }
            delete next[vehicleKey]
            return next
          })
          selectedNamesRef.current.delete(vehicleKey)
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除车辆失败') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [describeTarget, message, reloadList, t],
  )

  /**
   * 批量指令（一键暂停/继续/启用/禁用）：勾选了车辆仅作用于勾选项；
   * 未勾选保持旧实现语义——不传 vehicleKeys 即对全部车辆操作。
   * 后端只返回整批结果：按「已提交，结果以实际状态核实」诚实呈现（A15）。
   */
  const handleBatchOperate = useCallback(
    (operate: VehicleOperateCommand) => {
      if (batchPending) return
      const targets = [...selectedKeys]
      const targetNames = targets.map(
        (key) => selectedNamesRef.current.get(key) ?? key,
      )
      // 无勾选 = 全部车辆（协议语义），确认框按「全部车辆」呈现
      const listedTargets = targets.length > 0 ? targetNames : [t('全部车辆')]
      void confirmCommand({
        title: t('一键操作确认'),
        targets: listedTargets,
        impact: t(OPERATE_IMPACT_KEY[operate]),
        danger: operate === 'DISABLED',
      }).then(async (confirmed) => {
        if (!confirmed) return
        setBatchPending(true)
        try {
          await operateAllVehicles({
            operate,
            ...(targets.length > 0 ? { vehicleKeys: targets } : {}),
          })
          message.success(
            t('批量指令已提交（{{count}}），执行结果以车辆状态为准', {
              count: targets.length > 0 ? targets.length : t('全部车辆'),
            }),
          )
          // 勾选集已消费完毕：清空避免误作用到下一次操作（旧实现同语义）
          clearSelection()
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('一键操作出错') + apiErrorMessage(error))
          }
        } finally {
          setBatchPending(false)
        }
      })
    },
    [batchPending, clearSelection, message, reloadList, selectedKeys, t],
  )

  /* --------------------------------- 搜索与筛选 --------------------------------- */

  /** 提交筛选：记录条件、清空跨页选择（数据范围已变）并回首页重新查询 */
  const handleSearch = useCallback(
    (value: string) => {
      queryRef.current = value.trim()
      setQueryText(queryRef.current)
      clearSelection()
      tableInstanceRef.current?.resetPageIndex()
      tableApiRef.current?.reload()
    },
    [clearSelection],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<VehicleRecordDto>[]>(() => {
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
    /** 尺寸数值单元格：协议原值直出，缺失留白 */
    const numberCell = (info: { getValue: () => unknown }) => {
      const value = info.getValue()
      if (value === null || value === undefined) return null
      return String(value)
    }

    return [
      {
        accessorKey: 'name',
        header: t('车辆名称'),
        enableSorting: false,
        size: 160,
        cell: textCell(160),
      },
      {
        accessorKey: 'key',
        header: t('车辆标识'),
        enableSorting: false,
        size: 180,
        cell: textCell(180),
      },
      {
        accessorKey: 'vehicleType',
        header: t('车辆类型'),
        enableSorting: false,
        size: 100,
        meta: { apex: { align: 'center' } },
        // 旧系统既定取值域（1=叉车、2=小车）；未知值显示协议原值（规格 11.2/18.3）
        cell: (info) => {
          const value = info.getValue() as number | null | undefined
          if (value === null || value === undefined) return null
          const known = VEHICLE_TYPE_LABEL[value]
          return known ? t(known) : String(value)
        },
      },
      {
        accessorKey: 'connectionState',
        header: t('网络状态'),
        enableSorting: false,
        size: 110,
        meta: { apex: { align: 'center' } },
        cell: (info) => {
          const value = info.getValue() as string | null | undefined
          if (!value) return null
          const known = CONNECTION_STATE_LABEL[value]
          return (
            <Tag color={CONNECTION_STATE_TAG_COLOR[value]}>
              {known ? t(known) : value}
            </Tag>
          )
        },
      },
      {
        accessorKey: 'dispatchState',
        header: t('调度状态'),
        enableSorting: false,
        size: 100,
        meta: { apex: { align: 'center' } },
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === record.key
          return (
            // 状态展示型控件（无权限 disabled 而非隐藏，避免该列数据行空荡）；
            // 命令在途同行禁用（防连点）
            <Switch
              size="small"
              checked={record.dispatchState === 'ENABLE'}
              disabled={!canEnable || pending}
              onChange={() => handleDispatchToggle(record)}
            />
          )
        },
      },
      {
        // 绑定地图：嵌套路径取值（state.agvPosition.mapDescription），缺失留白
        id: 'bindMap',
        header: t('绑定地图'),
        enableSorting: false,
        size: 140,
        meta: { apex: { align: 'center' } },
        cell: ({ row }) => textCell(140)({ getValue: () => row.original.state?.agvPosition?.mapDescription }),
      },
      {
        accessorKey: 'agvDimension.length',
        header: t('长度(m)'),
        enableSorting: false,
        size: 90,
        meta: { apex: { align: 'center' } },
        cell: numberCell,
      },
      {
        accessorKey: 'agvDimension.width',
        header: t('宽度(m)'),
        enableSorting: false,
        size: 90,
        meta: { apex: { align: 'center' } },
        cell: numberCell,
      },
      {
        accessorKey: 'agvDimension.loadLength',
        header: t('载货长度(m)'),
        enableSorting: false,
        size: 110,
        meta: { apex: { align: 'center' } },
        cell: numberCell,
      },
      {
        accessorKey: 'agvDimension.loadWidth',
        header: t('载货宽度(m)'),
        enableSorting: false,
        size: 110,
        meta: { apex: { align: 'center' } },
        cell: numberCell,
      },
      {
        accessorKey: 'agvDimension.centerOffset',
        header: t('偏移量(m)'),
        enableSorting: false,
        size: 100,
        meta: { apex: { align: 'center' } },
        cell: numberCell,
      },
      {
        // 操作列：固定右侧不参与偏好持久化；入口按按钮码控制（无权限隐藏）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 300,
        meta: { apex: { align: 'center' } },
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === record.key
          return (
            <Space size={4}>
              {/* 详情：view 行为，不限权 */}
              <Button size="small" type="link" onClick={() => setDetailTarget(record)}>
                {t('详情')}
              </Button>
              {/* 编辑车辆：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 行级指令：无权限隐藏入口 */}
              {canOperate ? renderOperateMenu(record) : null}
              {/* 删除车辆：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
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
  }, [t, canUpdate, canDelete, canOperate, canEnable, pendingRowKey, handleDispatchToggle, handleDelete, openEdit, renderOperateMenu])

  /* ------------------------------------ 渲染 ------------------------------------ */

  const batchItems: MenuProps['items'] = VEHICLE_BATCH_OPERATE_ITEMS.map((item) => ({
    key: item.key,
    label: t(item.label),
  }))

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左）+ 已选提示/一键操作/新增车辆（右）；不设手动刷新按钮，
          新鲜度由可见轮询与写操作成功后的自动刷新保证 */}
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
          {/* 跨页已选提示与清空入口，仅勾选了行时出现 */}
          {selectedKeys.length > 0 ? (
            <>
              <span className={styles.selectedHint}>
                {t('已选 {{count}} 辆', { count: selectedKeys.length })}
              </span>
              <Button onClick={clearSelection}>{t('清空')}</Button>
            </>
          ) : null}
          {/* 一键操作：勾选了车辆时仅作用于勾选项（无权限隐藏整个入口） */}
          {canBatchOperate ? (
            <Dropdown
              trigger={['click']}
              menu={{ items: batchItems, onClick: ({ key }) => handleBatchOperate(key as VehicleOperateCommand) }}
              disabled={batchPending}
            >
              <Button type="primary" danger loading={batchPending}>
                {t('一键操作')}
              </Button>
            </Dropdown>
          ) : null}
          {/* 新增车辆：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus />} onClick={openCreate}>
              {t('新增车辆')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；
          行选择跨页保留（TanStack 受控），调度状态 Switch 无权限禁用 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageVehicles(
              { pageNo, pageSize, ...(queryRef.current ? { query: queryRef.current } : {}) },
              { signal: params.signal },
            ).then((page) => {
              // 记录选择集内已知目标的名称（确认框列明对象；跨页行不丢名字）
              for (const record of page.records ?? []) {
                if (record.key && record.name) selectedNamesRef.current.set(record.key, `${record.name}（${record.key}）`)
              }
              return {
                data: page.records ?? [],
                rowCount: page.total ?? 0,
              }
            })
          }}
          getRowId={stringFieldRowId('key')}
          // 行选择：选择列必须显式放出（包内默认不渲染该列），
          // enableRowSelection 只启用选择能力（TanStack 受控 state）
          showSelectionColumn
          enableRowSelection
          onRowSelectionChange={(updater) =>
            setRowSelection(resolveUpdater(updater, rowSelection))
          }
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100, 200] }}
          columnSettingsEnabled
          height="100%"
          state={{
            rowSelection,
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

      {/* 接入/编辑弹窗：常挂保留草稿（新增模式）；编辑目标变化时重填 */}
      <VehicleFormModal
        open={formOpen}
        editTarget={editTarget}
        onClose={closeForm}
        onSucceeded={handleFormSucceeded}
      />

      {/* 详情抽屉：按目标挂载（快速预览；独立详情页归 P39，完成后联验完整链路） */}
      {detailTarget ? (
        <VehicleDetailDrawer
          open
          record={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      ) : null}
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
