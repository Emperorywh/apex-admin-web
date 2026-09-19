/**
 * 电梯页（P14 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\TriDevice\Elevator_back——当前路由唯一来源，
 * 历史 Elevator 实现不在迁移范围）：antd Table + 搜索框 + 新增/编辑弹窗 +
 * 操作项 Dropdown（呼叫/开门/关门/清占用）+ 状态 Popover + Popconfirm 删除。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=deviceKey、
 *   列偏好 device-elevator:main、内建取消/错误重试）；排序不启用（G09：旧页面
 *   无排序，后端未声明全量排序）；普通 CRUD 配置数据不轮询（DoD 7），新鲜度由
 *   写操作成功后的自动刷新保证；无手动刷新按钮（按钮纪律）；
 * - 列结构与旧版逐列核对：设备名称/设备标识/楼层/设备状态（启用/禁用）/
 *   设备驱动（driverKey 经驱动集合映射名称）/IP地址/端口/设备配置（JSON 预览
 *   Popover）/网络状态（在线绿/离线红 Tag）；空值一律留白；未知枚举显示原值；
 * - 电梯状态：「状态」按钮按需查询（旧实现同交互，本页非实时轮询页），状态
 *   按行缓存（修复旧版全部行共享一份状态的串扰），未知枚举显示协议原值；
 * - 控制命令升级（旧实现清占用直接执行、开关门/外呼仅弹窗一问）：外呼/开门/
 *   关门=弹窗录入参数 → confirmCommand 命令确认（列明对象电梯与影响 +
 *   「提交≠完成」附注）→ 发送；清占用=confirmCommand danger 确认 → 发送；
 *   受理 ≠ 设备动作完成，结果以「状态」重新查询为准；失败不自动补发；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响；旧版仅一问）；
 * - G06 内呼缺口：旧 innerCall 未出现在 OpenAPI——操作菜单对有操作权限用户
 *   保留「电梯上楼（内呼）」入口（灰色标记 + Tooltip + 点击警告说明，
 *   零请求），不用外呼猜替；
 * - 驱动集合经 useStaticOptions 加载（失败清空+加载失败文本，无重试按钮）；
 * - 无权限动作隐藏：新增/编辑/删除/操作项分别挂按钮码
 *   device:elevator:add/update/delete/operate（与旧实现一致）；
 *   「状态」为查看行为不控权（旧实现同边界）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Descriptions, Dropdown, Input, Popover, Space, Tag, Tooltip } from 'antd'
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
  clearElevatorOccupy,
  closeDoor,
  deleteElevator,
  fetchElevatorDrivers,
  fetchElevatorState,
  openDoor,
  outerCall,
  pageElevators,
} from '@/services/device-elevator/device-elevator.service'
import type {
  ElevatorDriverDto,
  ElevatorDto,
  ElevatorStateDto,
} from '@/services/device-elevator/device-elevator.service.types'
import { ElevatorFormModal } from '@/features/device-elevator/components/ElevatorFormModal'
import { ElevatorControlModal } from '@/features/device-elevator/components/ElevatorControlModal'
import type { ElevatorCommandKind } from '@/features/device-elevator/components/ElevatorControlModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './Elevator.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function Elevator() {
  const { t } = useTranslation('deviceElevator')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现一致）：新增/编辑/删除/操作项；「状态」查看行为不控权
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_DELETE)
  const canOperate = hasPerm(PERM_BUTTON.DEVICE_ELEVATOR_OPERATE)

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<ElevatorDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧筛选）
  const queryRef = useRef<string>('')
  const [queryText, setQueryText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
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

  // 驱动下拉数据源：失败清空 + error 标记（按钮纪律：无重试按钮，仅文本提示）
  const driversState = useStaticOptions<ElevatorDriverDto>((signal) =>
    fetchElevatorDrivers({ signal }),
  )
  const drivers = useMemo(() => driversState.options ?? [], [driversState.options])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('device-elevator:main')
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
  const [editTarget, setEditTarget] = useState<ElevatorDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: ElevatorDto) => {
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

  /* ------------------------- 删除电梯（confirmCommand 确认） ------------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = deviceKey）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除电梯：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: ElevatorDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: t('删除电梯'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact: t('删除影响：电梯将从系统移除，请确认无地图关联、任务或调度配置正在引用该电梯'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteElevator({ deviceKey: record.deviceKey as string })
          message.success(t('删除电梯成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除电梯出错') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* ----------------------- 电梯实时状态（状态按钮按需查询） ----------------------- */

  // 状态按行缓存（key=deviceKey）：修复旧版全部行共享一份状态的串扰；
  // 值 undefined = 尚未查询/查询失败已清空，null = 已查询但后端无数据
  const [stateByDevice, setStateByDevice] = useState<
    Record<string, ElevatorStateDto | null | undefined>
  >({})
  // 行级状态查询在途标记（同一电梯一次一个在途查询，防连点）
  const [statePendingKey, setStatePendingKey] = useState<string | null>(null)
  // 状态 Popover 受控展开行（页面级状态）：行内任意 setState 会重建列定义并
  // 重挂载单元格，非受控 Popover 的内部 open 会被重置——展开态必须由页面持有
  const [openStateKey, setOpenStateKey] = useState<string | null>(null)

  /** 查询单台电梯状态：成功落行缓存，失败清空该行区域并如实提示 */
  const handleQueryState = useCallback(
    async (record: ElevatorDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId || statePendingKey) return
      setStatePendingKey(rowId)
      try {
        const state = await fetchElevatorState(rowId)
        setStateByDevice((prev) => ({ ...prev, [rowId]: state ?? null }))
      } catch (error) {
        if (!isCancelledError(error)) {
          // 失败清空该请求对应区域（不留旧数据冒充成功），错误如实透传
          setStateByDevice((prev) => ({ ...prev, [rowId]: undefined }))
          message.error(t('查询电梯的状态出错') + apiErrorMessage(error))
        }
      } finally {
        setStatePendingKey(null)
      }
    },
    [message, statePendingKey, t],
  )

  /** 状态 Popover 内容：加载中/暂未查询/已查询（缺失字段留白，未知枚举原值） */
  const renderStateContent = useCallback(
    (record: ElevatorDto) => {
      const rowId = record.deviceKey ?? ''
      if (statePendingKey === rowId) {
        return <span style={{ fontSize: 12 }}>{t('状态查询中…')}</span>
      }
      const state = stateByDevice[rowId]
      if (state === undefined) {
        return <span style={{ fontSize: 12 }}>{t('暂未查询到电梯状态')}</span>
      }
      if (state === null) {
        return <span style={{ fontSize: 12 }}>{t('电梯状态为空')}</span>
      }
      return (
        <Descriptions
          style={{ width: 220 }}
          size="small"
          column={1}
          items={[
            { key: 'onlineState', label: t('在线状态'), children: state.onlineState ?? '' },
            { key: 'currentFloor', label: t('当前楼层'), children: state.currentFloor ?? '' },
            { key: 'runningState', label: t('运行状态'), children: state.runningState ?? '' },
            { key: 'frontDoorState', label: t('前电梯门状态'), children: state.frontDoorState ?? '' },
            { key: 'backDoorState', label: t('后电梯门状态'), children: state.backDoorState ?? '' },
            {
              key: 'occupyAgv',
              label: t('占用电梯的车辆'),
              children: state.occupyAgv?.name ?? '',
            },
          ]}
        />
      )
    },
    [stateByDevice, statePendingKey, t],
  )

  /* -------------------- 控制命令（外呼/开门/关门弹窗 + 清占用） -------------------- */

  // 控制弹窗状态：null = 关闭；kind 决定参数形态（G06：无内呼模式）
  const [controlKind, setControlKind] = useState<ElevatorCommandKind | null>(null)
  const [controlTarget, setControlTarget] = useState<ElevatorDto | null>(null)

  /** 命令在途的行 key（控制弹窗命令与清占用共用；与删除/状态查询分开防误禁） */
  const [commandPendingKey, setCommandPendingKey] = useState<string | null>(null)

  /** 发送单条控制命令：受理语义提示（提交 ≠ 完成，结果以「状态」查询为准） */
  const fireCommand = useCallback(
    async (rowId: string, request: () => Promise<unknown>, successText: string, errorText: string) => {
      setCommandPendingKey(rowId)
      try {
        await request()
        message.success(successText)
      } catch (error) {
        if (!isCancelledError(error)) {
          message.error(errorText + apiErrorMessage(error))
        }
      } finally {
        setCommandPendingKey(null)
      }
    },
    [message],
  )

  /**
   * 控制弹窗确认（参数已由弹窗校验）：confirmCommand 列明对象电梯与具体参数影响，
   * 确认后才真正发送；取消不发任何请求。
   */
  const handleControlConfirm = useCallback(
    (params: { currentFloor?: number; doorWay?: string }) => {
      const record = controlTarget
      const kind = controlKind
      if (!record?.deviceKey || !kind) return
      const rowId = record.deviceKey
      const target = `${record.deviceName ?? ''}（${record.deviceKey}）`
      const doorLabel =
        params.doorWay === 'FRONT' ? t('前门') : params.doorWay === 'BACK' ? t('后门') : (params.doorWay ?? '')

      const impact =
        kind === 'outerCall'
          ? t('呼叫影响：将向电梯发送呼叫命令（当前楼层 {{floor}}），电梯是否响应以「状态」查询为准', { floor: params.currentFloor ?? '' })
          : kind === 'openDoor'
            ? t('开门影响：将向电梯发送开门命令（{{door}}），执行结果以「状态」查询为准', { door: doorLabel })
            : t('关门影响：将向电梯发送关门命令（{{door}}），执行结果以「状态」查询为准', { door: doorLabel })

      void confirmCommand({
        title: kind === 'outerCall' ? t('呼叫电梯') : kind === 'openDoor' ? t('电梯开门') : t('电梯关门'),
        targets: [target],
        impact,
      }).then((confirmed) => {
        if (!confirmed) return
        setControlKind(null)
        setControlTarget(null)
        if (kind === 'outerCall') {
          void fireCommand(
            rowId,
            () => outerCall({ deviceKey: rowId, currentFloor: params.currentFloor as number }),
            t('已发送呼叫电梯命令，执行结果以「状态」查询为准'),
            t('呼叫电梯出错'),
          )
        } else if (kind === 'openDoor') {
          void fireCommand(
            rowId,
            () => openDoor({ deviceKey: rowId, doorWay: params.doorWay }),
            t('已发送电梯开门命令，执行结果以「状态」查询为准'),
            t('电梯开门出错'),
          )
        } else {
          void fireCommand(
            rowId,
            () => closeDoor({ deviceKey: rowId, doorWay: params.doorWay }),
            t('已发送电梯关门命令，执行结果以「状态」查询为准'),
            t('电梯关门出错'),
          )
        }
      })
    },
    [controlKind, controlTarget, fireCommand, t],
  )

  /** 清除占用电梯车辆：danger 确认（打断占用语义）→ 直接发送（命令无参数） */
  const handleClearOccupy = useCallback(
    (record: ElevatorDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: t('清除占用电梯车辆'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact: t('清除影响：将解除车辆对该电梯的占用，被释放车辆恢复调度，执行结果以「状态」查询为准'),
        danger: true,
      }).then((confirmed) => {
        if (!confirmed) return
        void fireCommand(
          rowId,
          () => clearElevatorOccupy({ deviceKey: rowId }),
          t('清除占用电梯车辆成功'),
          t('清除占用电梯车辆出错'),
        )
      })
    },
    [fireCommand, t],
  )

  /** 操作项菜单：呼叫/开门/关门 + 清占用 + G06 内呼入口（有权限用户可见说明） */
  const renderOperateMenu = useCallback(
    (record: ElevatorDto) => {
      const items: MenuProps['items'] = [
        { key: 'outerCall', label: t('呼叫电梯') },
        {
          // G06：内呼接口未出现在 OpenAPI——入口保留但灰色标记，点击给出
          // 「接口暂不可用」说明（不发任何请求）；不用 antd disabled：禁用项
          // 会抑制 Tooltip/点击，导致缺口说明对用户不可达
          key: 'innerCall',
          label: (
            <Tooltip title={t('内呼接口暂不可用：后端尚未提供该接口契约，开放时间待后端确认')} placement="right">
              <span style={{ opacity: 0.45 }}>{t('电梯上楼（内呼）')}</span>
            </Tooltip>
          ),
        },
        { key: 'openDoor', label: t('电梯开门') },
        { key: 'closeDoor', label: t('电梯关门') },
        { type: 'divider' },
        { key: 'clearElevatorOccupied', label: t('清除占用电梯车辆') },
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
              if (key === 'outerCall' || key === 'openDoor' || key === 'closeDoor') {
                setControlTarget(record)
                setControlKind(key)
                return
              }
              if (key === 'innerCall') {
                // G06 缺口说明：只提示，不发请求、不用外呼猜替
                message.warning(t('内呼接口暂不可用：后端尚未提供该接口契约，开放时间待后端确认'))
                return
              }
              if (key === 'clearElevatorOccupied') {
                handleClearOccupy(record)
              }
            },
          }}
        >
          <Button type="primary" loading={pending}>
            {t('操作项')}
          </Button>
        </Dropdown>
      )
    },
    [commandPendingKey, handleClearOccupy, message, t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<ElevatorDto>[]>(() => {
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
        accessorKey: 'deviceName',
        header: t('设备名称'),
        enableSorting: false,
        size: 160,
        cell: textCell(160),
      },
      {
        accessorKey: 'deviceKey',
        header: t('设备标识'),
        enableSorting: false,
        size: 160,
        cell: textCell(160),
      },
      {
        // 楼层：协议原样数值；缺失留白
        accessorKey: 'floors',
        header: t('楼层'),
        enableSorting: false,
        size: 90,
        cell: (info) => {
          const value = info.getValue()
          return value === null || value === undefined ? null : String(value)
        },
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
        // 设备驱动：driverKey 经驱动集合映射名称；未加载/未命中显示原 key（保留原值）
        accessorKey: 'driverKey',
        header: t('设备驱动'),
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
        header: t('IP地址'),
        enableSorting: false,
        size: 140,
        cell: textCell(140),
      },
      {
        // 端口：协议原样数值；缺失留白
        accessorKey: 'port',
        header: t('端口'),
        enableSorting: false,
        size: 90,
        cell: (info) => {
          const value = info.getValue()
          return value === null || value === undefined ? null : String(value)
        },
      },
      {
        // 设备配置：紧凑 JSON 展示 + Popover 内格式化预览（旧实现同形态）
        accessorKey: 'deviceConfig',
        header: t('设备配置'),
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
        // 网络状态：ONLINE=在线（绿）/OFFLINE=离线（红）；未知枚举原值灰 Tag；缺失留白
        accessorKey: 'onlineState',
        header: t('网络状态'),
        enableSorting: false,
        size: 100,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined || value === '') return null
          if (value === 'ONLINE') return <Tag color="#87D068">{t('在线')}</Tag>
          if (value === 'OFFLINE') return <Tag color="#D50000">{t('离线')}</Tag>
          return <Tag>{String(value)}</Tag>
        },
      },
      {
        // 操作列：状态（查看行为不控权）+ 操作项（operate 码）+ 编辑/删除（update/delete 码）；
        // 无权限隐藏；命令在途防连点（命令与删除互斥防误触）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 360,
        cell: ({ row }) => {
          const record = row.original
          const rowId = record.deviceKey ?? ''
          const pending =
            (pendingRowKey !== null && pendingRowKey === rowId) ||
            (commandPendingKey !== null && commandPendingKey === rowId)
          return (
            <Space size={4}>
              {/* 状态：按需查询 + 受控 Popover 展示（查看行为，不挂按钮码）；
                  点击即展开（内容区自呈现加载中/结果），失败清空后保持展开可见 */}
              <Popover
                placement="left"
                title={t('电梯状态')}
                trigger={['click']}
                open={openStateKey === rowId}
                onOpenChange={(open) => setOpenStateKey(open ? rowId : null)}
                content={renderStateContent(record)}
              >
                <Button
                  type="primary"
                  size="small"
                  loading={statePendingKey === rowId}
                  onClick={() => {
                    // 点击已展开的按钮是「收起」动作，不重复发起查询
                    if (openStateKey === rowId) return
                    void handleQueryState(record)
                  }}
                >
                  {t('状态')}
                </Button>
              </Popover>
              {/* 操作项：无 operate 权限隐藏（粗粒度码，子项不细分，旧实现同边界） */}
              {canOperate ? renderOperateMenu(record) : null}
              {/* 编辑电梯：无 update 权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" disabled={pending} onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除电梯：无 delete 权限隐藏；confirmCommand 破坏性确认 */}
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
      statePendingKey,
      openStateKey,
      openEdit,
    handleDelete,
    handleQueryState,
    renderOperateMenu,
    renderStateContent,
  ])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左，旧实现 Search enterButton 同形态）+ 新增设备（右）；
          不设手动刷新按钮，新鲜度由写操作成功后的自动刷新保证 */}
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
          {/* 新增设备：无 add 权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('新增设备')}
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
            return pageElevators(
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
      <ElevatorFormModal
        open={formOpen}
        editTarget={editTarget}
        drivers={drivers}
        onClose={closeForm}
        onSucceeded={handleFormSucceeded}
      />

      {/* 控制命令弹窗（外呼/开门/关门）：参数录入 → 页面层 confirmCommand → 发送 */}
      <ElevatorControlModal
        open={controlKind !== null}
        command={controlKind ?? 'outerCall'}
        deviceKey={controlTarget?.deviceKey ?? ''}
        deviceName={controlTarget?.deviceName ?? ''}
        onClose={() => {
          setControlKind(null)
          setControlTarget(null)
        }}
        onConfirm={handleControlConfirm}
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
