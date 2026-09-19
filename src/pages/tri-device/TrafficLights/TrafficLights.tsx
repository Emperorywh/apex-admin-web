/**
 * 交通灯页（P17 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\TriResource\TrafficLights——当前路由唯一来源，
 * 任务卡明示旧来源在 TriResource 而非 TriDevice）：antd Table + 搜索框 +
 * 新增/编辑弹窗 + 行内测试/编辑/删除。本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=deviceKey、
 *   列偏好 device-traffic-light:main、内建取消/错误重试）；排序不启用（G09：旧
 *   页面无排序，后端未声明全量排序）；普通 CRUD 配置数据不轮询（DoD 7），
 *   新鲜度由写操作成功后的自动刷新保证；无手动刷新按钮（按钮纪律）；
 * - 列结构与旧版逐列核对（8 列，列头文案同旧版）：设备标识/设备名称/请求地址
 *   （deviceConfig.url）/请求参数（deviceConfig.requestParam 紧凑 JSON，空值
 *   留白——旧版「-」占位按全局空值纪律改为留白）/响应成功表达式/同步等待响应
 *   （是/否，false 是明确状态非缺失，缺失留白）/创建时间（秒级格式，缺失留白）/
 *   操作（钉右 280）；未知协议字段不发明列（新契约顶层 ip/port/deviceStatus
 *   旧 UI 无此三列，不新增）；
 * - 连通性测试升级（A21：测试是向现场设备发起的真实连通性请求，不作为只读
 *   自动执行；旧实现菜单点击直接执行，按 DoD8 升级）：confirmCommand 命令确认
 *   （列明对象交通灯与影响）→ 发送；结果语义诚实——code=200 即旧语义
 *   「交通灯测试成功，连通性正常」，失败经 apiErrorMessage 透传后端诊断信息
 *   （未知结果保留诊断信息），测试在途行内 loading（loading ≠ 假装测试通过），
 *   不自动重试；旧实现「交通灯测试失败：」分支由请求层业务码抛错统一承接；
 * - 删除升级为 confirmCommand 破坏性确认（danger，列明对象与影响；旧版仅一问
 *   Popconfirm）；
 * - 驱动集合经 useStaticOptions 加载（失败清空：仅弹窗驱动下拉失去数据源；
 *   无重试按钮，本页列表不消费驱动集合）；
 * - 无权限动作隐藏：测试/编辑/删除/新增分别挂按钮码
 *   device:traffic-light:operate/update/delete/add（与旧实现一致，测试归
 *   operate 粗粒度码，交通灯无独立 test 码）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Space, Tooltip } from 'antd'
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
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteTrafficLight,
  fetchTrafficLightDrivers,
  pageTrafficLights,
  testTrafficLight,
} from '@/services/device-traffic-light/device-traffic-light.service'
import type {
  TrafficLightDriverDto,
  TrafficLightDto,
} from '@/services/device-traffic-light/device-traffic-light.service.types'
import { TrafficLightsFormModal } from '@/features/device-traffic-light/components/TrafficLightsFormModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './TrafficLights.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function TrafficLights() {
  const { t } = useTranslation('deviceTrafficLight')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现一致）：新增/编辑/删除/测试（测试归 operate 粗粒度码）
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_DELETE)
  const canOperate = hasPerm(PERM_BUTTON.DEVICE_TRAFFIC_LIGHT_OPERATE)

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<TrafficLightDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧筛选）
  const queryRef = useRef<string>('')
  const [queryText, setQueryText] = useState('')

  /** 操作后统一刷新列表（写操作/测试命令成功后获取最新列表） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /** 提交搜索：记录条件并回首页重新查询（旧实现同语义） */
  const handleSearch = useCallback((value: string) => {
    queryRef.current = value.trim()
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------- 驱动集合（弹窗下拉数据源） --------------------------- */

  // 驱动下拉数据源：失败清空（按钮纪律：无重试按钮；本页列表不消费驱动集合）
  const driversState = useStaticOptions<TrafficLightDriverDto>((signal) =>
    fetchTrafficLightDrivers({ signal }),
  )
  const drivers = useMemo(() => driversState.options ?? [], [driversState.options])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('device-traffic-light:main')
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
  const [editTarget, setEditTarget] = useState<TrafficLightDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: TrafficLightDto) => {
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

  /* ------------------------------ 删除交通灯（danger 确认） ------------------------------ */

  // 删除在途的行 key（行级防连点；行 ID = deviceKey）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除交通灯：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: TrafficLightDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: t('删除交通灯'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact: t('删除影响：交通灯将从系统移除，请确认无任务或调度配置正在引用该交通灯'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteTrafficLight({ deviceKey: record.deviceKey as string })
          message.success(t('删除交通灯成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除交通灯出错') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* ------------------------- 连通性测试（A21 设备控制类操作） ------------------------- */

  // 测试在途的行 key（行内 loading；同一行只允许一个在途测试）
  const [testingKey, setTestingKey] = useState<string | null>(null)

  /**
   * 连通性测试：confirmCommand 确认（列明对象交通灯与影响）→ 发送。
   * 结果语义诚实：code=200 即「交通灯测试成功，连通性正常」（旧实现同语义）；
   * 失败经 apiErrorMessage 透传后端诊断信息（未知结果保留诊断信息，不用动画
   * 假装测试通过）；取消确认不发任何请求。
   */
  const handleTest = useCallback(
    (record: TrafficLightDto) => {
      const rowId = record.deviceKey ?? ''
      if (!rowId) return
      void confirmCommand({
        title: t('测试交通灯'),
        targets: [`${record.deviceName ?? ''}（${record.deviceKey ?? ''}）`],
        impact: t('测试影响：将向该交通灯设备发起一次连通性测试请求，测试结果以本页反馈消息为准'),
      }).then(async (confirmed) => {
        if (!confirmed) return
        setTestingKey(rowId)
        try {
          await testTrafficLight({ deviceKey: record.deviceKey as string })
          message.success(t('交通灯测试成功，连通性正常'))
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('交通灯测试出错') + apiErrorMessage(error))
          }
        } finally {
          setTestingKey(null)
        }
      })
    },
    [message, t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<TrafficLightDto>[]>(() => {
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
        // 请求地址：deviceConfig.url（旧实现嵌套取值同形态）；缺失留白
        id: 'requestUrl',
        accessorFn: (row) => row.deviceConfig?.url,
        header: t('请求地址'),
        enableSorting: false,
        size: 200,
        cell: textCell(200),
      },
      {
        // 请求参数：deviceConfig.requestParam 紧凑 JSON（旧实现 JSON.stringify 同形态）；
        // 空值留白（旧版「-」占位按全局空值纪律改留白）
        id: 'requestParam',
        accessorFn: (row) => row.deviceConfig?.requestParam,
        header: t('请求参数'),
        enableSorting: false,
        size: 220,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined || value === '') return null
          const text = JSON.stringify(value)
          return (
            <Tooltip title={text} placement="topLeft">
              <span className={styles.ellipsis} style={{ maxWidth: 204 }}>
                {text}
              </span>
            </Tooltip>
          )
        },
      },
      {
        // 响应成功表达式：deviceConfig.responseSuccessExpression；缺失留白
        id: 'responseSuccessExpression',
        accessorFn: (row) => row.deviceConfig?.responseSuccessExpression,
        header: t('响应成功表达式'),
        enableSorting: false,
        size: 200,
        cell: textCell(200),
      },
      {
        // 同步等待响应：boolean 明确两态（false=否 不是缺失）；缺失留白
        accessorKey: 'syncWaitResponse',
        header: t('同步等待响应'),
        enableSorting: false,
        size: 110,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined) return null
          return value ? t('是') : t('否')
        },
      },
      {
        // 创建时间：秒级墙钟格式（缺失/不可解析留白）
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => {
          const text = displayDateTime(info.getValue() as string | null | undefined)
          if (!text) return null
          return (
            <Tooltip title={text} placement="topLeft">
              <span className={styles.ellipsis} style={{ maxWidth: 154 }}>
                {text}
              </span>
            </Tooltip>
          )
        },
      },
      {
        // 操作列：测试（operate 码）+ 编辑/删除（update/delete 码）；无权限隐藏；
        // 行内任一操作在途时其余按钮禁用防误触（测试与删除互斥）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 280,
        cell: ({ row }) => {
          const record = row.original
          const rowId = record.deviceKey ?? ''
          const pending =
            (pendingRowKey !== null && pendingRowKey === rowId) ||
            (testingKey !== null && testingKey === rowId)
          return (
            <Space size={4}>
              {/* 测试：无 operate 权限隐藏；confirmCommand 确认后发起连通性请求 */}
              {canOperate ? (
                <Button
                  size="small"
                  type="primary"
                  loading={testingKey !== null && testingKey === rowId}
                  disabled={pending && testingKey !== rowId}
                  onClick={() => handleTest(record)}
                >
                  {t('测试')}
                </Button>
              ) : null}
              {/* 编辑交通灯：无 update 权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" disabled={pending} onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除交通灯：无 delete 权限隐藏；confirmCommand 破坏性确认 */}
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
    canOperate,
    canUpdate,
    canDelete,
    pendingRowKey,
    testingKey,
    openEdit,
    handleDelete,
    handleTest,
  ])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左，旧实现 Search enterButton 宽 361 同形态）+ 新增交通灯（右）；
          不设手动刷新按钮，新鲜度由写操作成功后的自动刷新保证 */}
      <div className={styles.toolbar}>
        <Input.Search
          className={styles.search}
          placeholder={t('请输入交通灯名称或唯一key查询')}
          enterButton
          allowClear
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          onSearch={handleSearch}
        />
        <Space wrap size={8}>
          {/* 新增交通灯：无 add 权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('新增交通灯')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建） */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageTrafficLights(
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
      <TrafficLightsFormModal
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
