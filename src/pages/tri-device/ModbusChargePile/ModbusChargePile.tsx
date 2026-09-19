/**
 * 充电桩页（P16 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\TriDevice\ChargePile\ModbusChargePile——当前路由
 * 唯一来源，ChargePile/index.tsx 单 Tab 壳未挂路由，其他旧 Modbus 文件不在迁移
 * 范围）：antd Table + 搜索框 + 新增/编辑弹窗 + 操作项 Dropdown（开始/停止充电）
 * + Popconfirm 删除。本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=deviceKey、
 *   列偏好 device-charge-pile:main、内建取消/错误重试）；排序不启用（G09：旧
 *   页面无排序，后端未声明全量排序）；普通 CRUD 配置数据不轮询（DoD 7），
 *   新鲜度由写操作成功后的自动刷新保证；无手动刷新按钮（按钮纪律）；
 * - 列结构与旧版逐列核对（9 列，列头文案同旧版，设备标识在设备名称前）：
 *   设备标识/设备名称/设备状态（启用/禁用）/关联的驱动（经驱动集合映射名称）/
 *   设备的IP地址/设备的端口号/设备配置信息（JSON 预览 Popover）/充电桩状态/
 *   操作（钉右 300）；空值一律留白；未知枚举显示协议原值；
 * - 充电桩状态随分页行记录内嵌下发（OpenAPI 无 getChargePileState 独立查询，
 *   旧实现同形态直接读行记录）；状态枚举沿用旧系统 ChargeState 既定语义映射
 *   （ERROR/FAULT→错误、IDLE→空闲、CHARGING→充电中、FULL→充满、OFFLINE→离线），
 *   未知枚举显示协议原值不猜语义；命令受理 ≠ 充电完成，发送成功后刷新列表
 *   （旧实现同语义：命令成功后重新查询列表获取最新状态）；
 * - 控制命令升级（旧实现菜单点击直接执行，零确认）：开始/停止充电 =
 *   confirmCommand 命令确认（列明对象充电桩与影响 + 受理语义附注）→ 发送；
 *   命令无参数录入（DeviceParam 仅 deviceKey，doorWay 为电梯语义不携带），
 *   故不设参数弹窗；成功提示不显示成充电完成（任务卡 A14 验收点）；
 * - 删除升级为 confirmCommand 破坏性确认（danger，列明对象与影响；旧版仅一问）；
 * - 驱动集合经 useStaticOptions 加载（失败清空：驱动列回退显示原 key，仅弹窗
 *   驱动下拉失去数据源；无重试按钮）；
 * - 无权限动作隐藏：新增/编辑/删除/操作项分别挂按钮码
 *   device:charge-pile:add/update/delete/operate（与旧实现一致）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Dropdown, Input, Popover, Space, Tooltip } from 'antd'
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
} from 'apex-table-react'
import { useTranslation } from 'react-i18next'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteChargePile,
  fetchChargePileDrivers,
  pageChargePiles,
  startCharge,
  stopCharge,
} from '@/services/device-charge-pile/device-charge-pile.service'
import type {
  ChargePileDriverDto,
  ChargePileDto,
} from '@/services/device-charge-pile/device-charge-pile.service.types'
import { ChargePileFormModal } from '@/features/device-charge-pile/components/ChargePileFormModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './ModbusChargePile.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/**
 * 充电桩状态枚举 → 文案 key 映射（旧系统 ChargeState 既定语义原样迁移；
 * ERROR 与 FAULT 在旧映射中同为「错误」）。不在表内的枚举显示协议原值。
 */
const CHARGE_STATE_TEXT_KEYS: Record<string, string> = {
  ERROR: '错误',
  IDLE: '空闲',
  CHARGING: '充电中',
  FULL: '充满',
  FAULT: '错误',
  OFFLINE: '离线',
}

export default function ModbusChargePile() {
  const { t } = useTranslation('deviceChargePile')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现一致）：新增/编辑/删除/操作项
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_DELETE)
  const canOperate = hasPerm(PERM_BUTTON.DEVICE_CHARGE_PILE_OPERATE)

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<ChargePileDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧筛选）
  const queryRef = useRef<string>('')
  const [queryText, setQueryText] = useState('')

  /** 操作后统一刷新列表（写操作/命令成功后获取行内最新充电桩状态） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /** 提交搜索：记录条件并回首页重新查询（旧实现同语义） */
  const handleSearch = useCallback((value: string) => {
    queryRef.current = value.trim()
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------- 驱动集合（表单与列映射） --------------------------- */

  // 驱动下拉数据源：失败清空（按钮纪律：无重试按钮；驱动列回退显示原 key）
  const driversState = useStaticOptions<ChargePileDriverDto>((signal) =>
    fetchChargePileDrivers({ signal }),
  )
  const drivers = useMemo(() => driversState.options ?? [], [driversState.options])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('device-charge-pile:main')
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

  /* ------------------------------ 新增/编辑弹窗状态 ------------------------------ */

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ChargePileDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: ChargePileDto) => {
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

  /* ------------------------- 删除充电桩（confirmCommand 确认） ------------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = deviceKey）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除充电桩：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: ChargePileDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: t('删除充电桩'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact: t('删除影响：充电桩将从系统移除，请确认无任务或调度配置正在引用该充电桩'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteChargePile({ deviceKey: record.deviceKey as string })
          message.success(t('删除当前充电桩成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除当前充电桩出错') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* --------------------- 控制命令（开始/停止充电，无参数弹窗） --------------------- */

  /** 命令在途的行 key（与删除分开标记防误禁） */
  const [commandPendingKey, setCommandPendingKey] = useState<string | null>(null)

  /**
   * 发送单条充电命令：受理语义提示（命令接受 ≠ 充电完成，A14/任务卡验收点）；
   * 成功后刷新列表——充电桩状态随分页行记录内嵌下发，列表刷新即状态重查
   * （旧实现同语义）；失败不自动补发。
   */
  const fireCommand = useCallback(
    async (rowId: string, request: () => Promise<unknown>, successText: string, errorText: string) => {
      setCommandPendingKey(rowId)
      try {
        await request()
        message.success(successText)
        reloadList()
      } catch (error) {
        if (!isCancelledError(error)) {
          message.error(errorText + apiErrorMessage(error))
        }
      } finally {
        setCommandPendingKey(null)
      }
    },
    [message, reloadList],
  )

  /**
   * 开始/停止充电命令：confirmCommand 列明对象充电桩与影响（无参数录入，
   * DeviceParam 仅 deviceKey），确认后才真正发送；取消不发任何请求。
   */
  const handleChargeCommand = useCallback(
    (record: ChargePileDto, kind: 'startCharge' | 'stopCharge') => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: kind === 'startCharge' ? t('开始充电') : t('停止充电'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact:
          kind === 'startCharge'
            ? t('开始充电影响：将向充电桩发送开始充电命令，充电桩状态的更新以列表「充电桩状态」列为准')
            : t('停止充电影响：将向充电桩发送停止充电命令，充电桩状态的更新以列表「充电桩状态」列为准'),
      }).then((confirmed) => {
        if (!confirmed) return
        if (kind === 'startCharge') {
          void fireCommand(
            rowId,
            () => startCharge({ deviceKey: rowId }),
            t('已发送开始充电命令，充电桩状态的更新以列表「充电桩状态」列为准'),
            t('开始充电出错'),
          )
        } else {
          void fireCommand(
            rowId,
            () => stopCharge({ deviceKey: rowId }),
            t('已发送停止充电命令，充电桩状态的更新以列表「充电桩状态」列为准'),
            t('停止充电出错'),
          )
        }
      })
    },
    [fireCommand, t],
  )

  /** 操作项菜单：开始充电/停止充电（菜单项与顺序同旧实现） */
  const renderOperateMenu = useCallback(
    (record: ChargePileDto) => {
      const items: MenuProps['items'] = [
        { key: 'startCharge', label: t('开始充电') },
        { key: 'stopCharge', label: t('停止充电') },
      ]
      const pending = commandPendingKey !== null && commandPendingKey === (record.deviceKey ?? '')
      return (
        <Dropdown
          trigger={['click']}
          disabled={pending}
          menu={{
            items,
            onClick: ({ key }) => {
              if (!record.deviceKey) return
              if (key === 'startCharge' || key === 'stopCharge') {
                handleChargeCommand(record, key)
              }
            },
          }}
        >
          <Button type="primary" size="small" loading={pending}>
            {t('操作项')}
          </Button>
        </Dropdown>
      )
    },
    [commandPendingKey, handleChargeCommand, t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<ChargePileDto>[]>(() => {
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
        // 列序同旧版：设备标识在前
        accessorKey: 'deviceKey',
        header: t('设备标识'),
        enableSorting: false,
        size: 160,
        cell: textCell(160),
      },
      {
        accessorKey: 'deviceName',
        header: t('设备名称'),
        enableSorting: false,
        size: 160,
        cell: textCell(160),
      },
      {
        // 设备状态：boolean 明确两态（false=禁用 不是缺失）；缺失留白
        accessorKey: 'deviceStatus',
        header: t('设备状态'),
        enableSorting: false,
        size: 100,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined) return null
          return value ? t('启用') : t('禁用')
        },
      },
      {
        // 关联的驱动：driverKey 经驱动集合映射名称；未加载/未命中显示原 key（保留原值）
        accessorKey: 'driverKey',
        header: t('关联的驱动'),
        enableSorting: false,
        size: 140,
        cell: (info) => {
          const key = info.getValue()
          if (key === null || key === undefined || key === '') return null
          const driver = drivers.find((item) => item.key === key)
          const label = driver?.name ?? String(key)
          return (
            <Tooltip title={label} placement="topLeft">
              <span className={styles.ellipsis} style={{ maxWidth: 124 }}>
                {label}
              </span>
            </Tooltip>
          )
        },
      },
      {
        accessorKey: 'ip',
        header: t('设备的IP地址'),
        enableSorting: false,
        size: 140,
        cell: textCell(140),
      },
      {
        // 端口：协议原样数值；缺失留白
        accessorKey: 'port',
        header: t('设备的端口号'),
        enableSorting: false,
        size: 100,
        cell: (info) => {
          const value = info.getValue()
          return value === null || value === undefined ? null : String(value)
        },
      },
      {
        // 设备配置信息：紧凑 JSON 展示 + Popover 内格式化预览（旧实现 JsonViewer 同语义）
        accessorKey: 'deviceConfig',
        header: t('设备配置信息'),
        enableSorting: false,
        size: 220,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined) return null
          const text = JSON.stringify(value)
          return (
            <Popover
              placement="left"
              title={t('配置内容')}
              content={<pre className={styles.configPre}>{JSON.stringify(value, null, 2)}</pre>}
            >
              <Tooltip title={text} placement="topLeft">
                <span className={styles.ellipsis} style={{ maxWidth: 204 }}>
                  {text}
                </span>
              </Tooltip>
            </Popover>
          )
        },
      },
      {
        // 充电桩状态：随行记录内嵌下发（无独立状态查询 operation，旧实现同形态）；
        // 已知枚举按旧 ChargeState 既定语义映射展示，未知枚举协议原值，缺失留白
        id: 'chargePileState',
        accessorFn: (row) => row.deviceChargePileState?.chargePileState?.state,
        header: t('充电桩状态'),
        enableSorting: false,
        size: 110,
        cell: (info) => {
          const value = info.getValue() as string | undefined | null
          if (value === null || value === undefined || value === '') return null
          const textKey = CHARGE_STATE_TEXT_KEYS[value]
          const text = textKey ? t(textKey) : value
          return (
            <Tooltip title={text} placement="topLeft">
              <span className={styles.ellipsis} style={{ maxWidth: 94 }}>
                {text}
              </span>
            </Tooltip>
          )
        },
      },
      {
        // 操作列：操作项（operate 码）+ 编辑/删除（update/delete 码）；无权限隐藏；
        // 命令在途防连点（命令与删除互斥防误触）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 300,
        cell: ({ row }) => {
          const record = row.original
          const rowId = record.deviceKey ?? ''
          const pending =
            (pendingRowKey !== null && pendingRowKey === rowId) ||
            (commandPendingKey !== null && commandPendingKey === rowId)
          return (
            <Space size={4}>
              {/* 操作项：无 operate 权限隐藏（粗粒度码，子项不细分，旧实现同边界） */}
              {canOperate ? renderOperateMenu(record) : null}
              {/* 编辑充电桩：无 update 权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" disabled={pending} onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除充电桩：无 delete 权限隐藏；confirmCommand 破坏性确认 */}
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
  }, [
    t,
    drivers,
    canOperate,
    canUpdate,
    canDelete,
    pendingRowKey,
    commandPendingKey,
    openEdit,
    handleDelete,
    renderOperateMenu,
  ])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左，旧实现 Search enterButton 同形态）+ 新增充电桩（右）；
          不设手动刷新按钮，新鲜度由写操作成功后的自动刷新保证 */}
      <div className={styles.toolbar}>
        <Input.Search
          className={styles.search}
          placeholder={t('请输入设备名称查询')}
          enterButton
          allowClear
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          onSearch={handleSearch}
        />
        <Space wrap size={8}>
          {/* 新增充电桩：无 add 权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('新增充电桩')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；驱动集合加载
          失败不影响列表（驱动列回退显示原 key），仅弹窗驱动下拉失去数据源 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageChargePiles(
              {
                pageNo,
                pageSize,
                ...(queryRef.current ? { query: queryRef.current } : {}),
              },
              { signal: params.signal },
            ).then((page) => ({
              data: page.records ?? [],
              rowCount: page.total ?? 0,
            }))
          }}
          getRowId={stringFieldRowId('deviceKey')}
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

      {/* 新增/编辑弹窗：常挂保留草稿（新增模式）；编辑目标变化时重填 */}
      <ChargePileFormModal
        open={formOpen}
        editTarget={editTarget}
        drivers={drivers}
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
