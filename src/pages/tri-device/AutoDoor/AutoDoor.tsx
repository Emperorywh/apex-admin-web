/**
 * 自动门页（P15 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\TriDevice\AutoDoor_back——当前路由唯一来源，
 * 历史 AutoDoor/ModbusAutodoor 实现不在迁移范围）：antd Table + 搜索框 +
 * 新增/编辑弹窗 + 操作项 Dropdown（开门/关门/清占用）+ 状态 Popover +
 * Popconfirm 删除。本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=deviceKey、
 *   列偏好 device-auto-door:main、内建取消/错误重试）；排序不启用（G09：旧页面
 *   无排序，后端未声明全量排序）；普通 CRUD 配置数据不轮询（DoD 7），新鲜度由
 *   写操作成功后的自动刷新保证；无手动刷新按钮（按钮纪律）；
 * - 列结构与旧版逐列核对（9 列，列头文案同旧版）：设备名称/设备标识/驱动/
 *   启用状态（启用/禁用）/IP地址/端口/设备配置（JSON 预览 Popover）/网络状态/
 *   操作（钉右 360）；空值一律留白；未知枚举显示原值；
 * - 自动门状态：「状态」按钮按需查询（旧实现同交互，本页非实时轮询页），状态
 *   按行缓存（修复旧版全部行共享一份状态的串扰）+ 受控 Popover（修复行内
 *   setState 重挂载丢展开态缺陷，P14 同款）；内容=门状态（协议原值）+网络状态，
 *   契约 AutoDoorState 两字段完整呈现，缺失留白；
 * - 控制命令升级（旧实现三个命令均菜单点击直接执行，零确认）：开门/关门/
 *   清占用=confirmCommand 命令确认（列明对象自动门与影响 + 「提交≠完成」附注）
 *   → 发送；命令无参数录入（单门设备，无 doorWay/楼层语义，与电梯差异），
 *   故不设参数弹窗；清占用 danger 确认，行数据携带占用车辆清单
 *   （vehicleNames）时列明具体车辆（>5 台合并计数）；
 *   受理 ≠ 设备动作完成，结果以「状态」重新查询为准；失败不自动补发；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响；旧版仅一问）；
 * - 驱动集合经 useStaticOptions 加载（失败清空+加载失败文本，无重试按钮）；
 * - 无权限动作隐藏：新增/编辑/删除/操作项分别挂按钮码
 *   device:auto-door:add/update/delete/operate（与旧实现一致）；
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
  clearAutoDoorOccupy,
  closeDoor,
  deleteAutoDoor,
  fetchAutoDoorDrivers,
  fetchAutoDoorState,
  openDoor,
  pageAutoDoors,
} from '@/services/device-auto-door/device-auto-door.service'
import type {
  AutoDoorDriverDto,
  AutoDoorDto,
  AutoDoorStateDto,
} from '@/services/device-auto-door/device-auto-door.service.types'
import { AutoDoorFormModal } from '@/features/device-auto-door/components/AutoDoorFormModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './AutoDoor.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function AutoDoor() {
  const { t } = useTranslation('deviceAutoDoor')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现一致）：新增/编辑/删除/操作项；「状态」查看行为不控权
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_DELETE)
  const canOperate = hasPerm(PERM_BUTTON.DEVICE_AUTO_DOOR_OPERATE)

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<AutoDoorDto>>(null)

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
  const driversState = useStaticOptions<AutoDoorDriverDto>((signal) =>
    fetchAutoDoorDrivers({ signal }),
  )
  const drivers = useMemo(() => driversState.options ?? [], [driversState.options])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('device-auto-door:main')
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
  const [editTarget, setEditTarget] = useState<AutoDoorDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: AutoDoorDto) => {
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

  /* ------------------------- 删除自动门（confirmCommand 确认） ------------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = deviceKey）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除自动门：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: AutoDoorDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: t('删除自动门'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact: t('删除影响：自动门将从系统移除，请确认无任务、地图关联或调度配置正在引用该自动门'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteAutoDoor({ deviceKey: record.deviceKey as string })
          message.success(t('删除自动门成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除自动门出错') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* ----------------------- 自动门实时状态（状态按钮按需查询） ----------------------- */

  // 状态按行缓存（key=deviceKey）：修复旧版全部行共享一份状态的串扰；
  // 值 undefined = 尚未查询/查询失败已清空，null = 已查询但后端无数据
  const [stateByDevice, setStateByDevice] = useState<
    Record<string, AutoDoorStateDto | null | undefined>
  >({})
  // 行级状态查询在途标记（同一自动门一次一个在途查询，防连点）
  const [statePendingKey, setStatePendingKey] = useState<string | null>(null)
  // 状态 Popover 受控展开行（页面级状态）：行内任意 setState 会重建列定义并
  // 重挂载单元格，非受控 Popover 的内部 open 会被重置——展开态必须由页面持有
  const [openStateKey, setOpenStateKey] = useState<string | null>(null)

  /**
   * 网络状态渲染：ONLINE=在线（绿）/OFFLINE=离线（红）；未知枚举原值灰 Tag；
   * 缺失留白。列表列与状态 Popover 共用同一映射。
   */
  const renderOnlineState = useCallback(
    (value: string | undefined | null) => {
      if (value === null || value === undefined || value === '') return null
      if (value === 'ONLINE') return <Tag color="#87D068">{t('在线')}</Tag>
      if (value === 'OFFLINE') return <Tag color="#D50000">{t('离线')}</Tag>
      return <Tag>{String(value)}</Tag>
    },
    [t],
  )

  /** 查询单台自动门状态：成功落行缓存，失败清空该行区域并如实提示 */
  const handleQueryState = useCallback(
    async (record: AutoDoorDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId || statePendingKey) return
      setStatePendingKey(rowId)
      try {
        const state = await fetchAutoDoorState(rowId)
        setStateByDevice((prev) => ({ ...prev, [rowId]: state ?? null }))
      } catch (error) {
        if (!isCancelledError(error)) {
          // 失败清空该请求对应区域（不留旧数据冒充成功），错误如实透传
          setStateByDevice((prev) => ({ ...prev, [rowId]: undefined }))
          message.error(t('查询自动门状态出错') + apiErrorMessage(error))
        }
      } finally {
        setStatePendingKey(null)
      }
    },
    [message, statePendingKey, t],
  )

  /** 状态 Popover 内容：加载中/暂未查询/已查询（缺失字段留白，门状态协议原值） */
  const renderStateContent = useCallback(
    (record: AutoDoorDto) => {
      const rowId = record.deviceKey ?? ''
      if (statePendingKey === rowId) {
        return <span style={{ fontSize: 12 }}>{t('状态查询中…')}</span>
      }
      const state = stateByDevice[rowId]
      if (state === undefined) {
        return <span style={{ fontSize: 12 }}>{t('暂未查询到自动门状态')}</span>
      }
      if (state === null) {
        return <span style={{ fontSize: 12 }}>{t('自动门状态为空')}</span>
      }
      return (
        <Descriptions
          style={{ width: 200 }}
          size="small"
          column={1}
          items={[
            // 门状态：协议原值展示（UNKNOWN/ERROR/DOOR_OPENED 等枚举不猜语义，
            // 旧实现同形态直接呈现字符串）；缺失留白
            { key: 'doorState', label: t('门状态'), children: state.doorState ?? '' },
            {
              key: 'onlineState',
              label: t('网络状态'),
              // 网络状态与列表列同映射：ONLINE/OFFLINE 有既定语义，未知枚举原值
              children: renderOnlineState(state.onlineState) ?? '',
            },
          ]}
        />
      )
    },
    [renderOnlineState, stateByDevice, statePendingKey, t],
  )

  /* -------------------- 控制命令（开门/关门/清占用，无参数弹窗） -------------------- */

  /** 命令在途的行 key（三个命令共用；与删除/状态查询分开防误禁） */
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
   * 开门/关门命令：confirmCommand 列明对象自动门与影响（单门设备无参数录入，
   * 与电梯开门/关门的 doorWay 参数弹窗为有意差异），确认后才真正发送；
   * 取消不发任何请求。
   */
  const handleDoorCommand = useCallback(
    (record: AutoDoorDto, kind: 'openDoor' | 'closeDoor') => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: kind === 'openDoor' ? t('开门') : t('关门'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact:
          kind === 'openDoor'
            ? t('开门影响：将向自动门发送开门命令，执行结果以「状态」查询为准')
            : t('关门影响：将向自动门发送关门命令，执行结果以「状态」查询为准'),
      }).then((confirmed) => {
        if (!confirmed) return
        if (kind === 'openDoor') {
          void fireCommand(
            rowId,
            () => openDoor({ deviceKey: rowId }),
            t('已发送自动门开门命令，执行结果以「状态」查询为准'),
            t('自动门开门出错'),
          )
        } else {
          void fireCommand(
            rowId,
            () => closeDoor({ deviceKey: rowId }),
            t('已发送自动门关门命令，执行结果以「状态」查询为准'),
            t('自动门关门出错'),
          )
        }
      })
    },
    [fireCommand, t],
  )

  /**
   * 清除占用自动门车辆：danger 确认（打断占用语义）→ 发送；
   * 行数据携带占用车辆清单（vehicleNames）时在影响中列明具体车辆（真实数据
   * 增强确认对象与影响），未被占用则给通用说明。
   */
  const handleClearOccupy = useCallback(
    (record: AutoDoorDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      const vehicles = record.vehicleNames ?? []
      // >5 台合并计数（P12 先例），避免确认框无限拉长
      const vehicleText =
        vehicles.length === 0
          ? ''
          : vehicles.length <= 5
            ? vehicles.join('、')
            : t('{{count}} 台车辆：{{names}} 等', {
                count: vehicles.length,
                names: vehicles.slice(0, 5).join('、'),
              })
      void confirmCommand({
        title: t('清除占用自动门车辆'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact: vehicleText
          ? t('清除影响：将解除车辆对该自动门的占用（当前占用：{{vehicles}}），被释放车辆恢复调度，执行结果以「状态」查询为准', { vehicles: vehicleText })
          : t('清除影响：将解除车辆对该自动门的占用，被释放车辆恢复调度，执行结果以「状态」查询为准'),
        danger: true,
      }).then((confirmed) => {
        if (!confirmed) return
        void fireCommand(
          rowId,
          () => clearAutoDoorOccupy({ deviceKey: rowId }),
          t('清除占用自动门车辆成功'),
          t('清除占用自动门车辆出错'),
        )
      })
    },
    [fireCommand, t],
  )

  /** 操作项菜单：关门/开门/清占用（菜单项与顺序同旧实现） */
  const renderOperateMenu = useCallback(
    (record: AutoDoorDto) => {
      const items: MenuProps['items'] = [
        { key: 'closeDoor', label: t('关门') },
        { key: 'openDoor', label: t('开门') },
        { type: 'divider' },
        { key: 'clearAutoDoorOccupy', label: t('清除占用自动门车辆') },
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
              if (key === 'openDoor' || key === 'closeDoor') {
                handleDoorCommand(record, key)
                return
              }
              if (key === 'clearAutoDoorOccupy') {
                handleClearOccupy(record)
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
    [commandPendingKey, handleClearOccupy, handleDoorCommand, t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<AutoDoorDto>[]>(() => {
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
        // 驱动：driverKey 经驱动集合映射名称；未加载/未命中显示原 key（保留原值）
        accessorKey: 'driverKey',
        header: t('驱动'),
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
        // 启用状态：boolean 明确两态（false=禁用 不是缺失）；缺失留白
        accessorKey: 'deviceStatus',
        header: t('启用状态'),
        enableSorting: false,
        size: 100,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined) return null
          return value ? t('启用') : t('禁用')
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
        // 网络状态：与状态 Popover 共用映射；缺失留白
        accessorKey: 'onlineState',
        header: t('网络状态'),
        enableSorting: false,
        size: 100,
        cell: (info) => renderOnlineState(info.getValue() as string | undefined | null),
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
                title={t('自动门状态')}
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
              {/* 编辑自动门：无 update 权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" disabled={pending} onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除自动门：无 delete 权限隐藏；confirmCommand 破坏性确认 */}
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
    renderOnlineState,
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
            return pageAutoDoors(
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
      <AutoDoorFormModal
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
