/**
 * 工艺管理页（P21 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\MissionCluster\MissionFlow）：antd Table +
 * 工艺搜索 + 创建/重发弹窗（FlowModal：Cron 表达式构建器 + 模板集合 Transfer）
 * + 操作 Dropdown（暂停/继续/取消）+ 展开行子工艺子表（含子工艺操作 Dropdown）。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=id（int64
 *   主键，stringFieldRowId 收敛字符串）、列偏好 order-flow:main、内建取消/
 *   错误重试）；分页参数 G04 平铺口径（pageNo/pageSize/query，query=工艺名称
 *   模糊）；排序不启用（G09：pageOrderFlows 无排序参数）；
 * - 列结构与旧版逐列核对（6 列）：工艺名称（弹性）/工艺标识（弹性）/
 *   时间表达式（弹性；原样展示，保留旧秒位与 ? 语义，不推算下一次执行时间）/
 *   循环次数（弹性）/执行方式（弹性；0=并行触发 1=串行触发，未知值显示协议
 *   原值=AGENTS 纪律，旧实现未知返回空串为收敛差异登记）/操作（width 220
 *   默认钉右：重发 + 操作 Dropdown）；
 * - 展开行子表迁移为 ApexTableReact data 模式（真实完整小集合、关闭虚拟化
 *   =P20/P22 同款；行 ID=子工艺数据库 id）：订单模版名称/订单模版标识/
 *   工艺状态（后端受控枚举映射，未知原值=旧实现同款）/操作（width 150 钉右）；
 * - 主/子工艺控制命令（暂停/继续/取消）升级为 confirmCommand 确认（列明对象
 *   与影响、防重复提交=A14 纪律；旧版点击菜单直接发送无确认层）；取消为破坏性
 *   操作用 danger 确认；主/子控制分别校验对象与权限（operate / sub-operate
 *   两个按钮码），成功后刷新列表以真实状态为准（不伪造即时状态变更）；
 * - 创建/重发弹窗见 OrderFlowModal（重发=按行回显后走创建接口，旧同语义）；
 * - 权限（历史码值交叉，P20 已实证该族归属）：本页为「工艺管理」，视图码
 *   mission-template:view 挂路由守卫；按钮码 mission-template:create（创建）/
 *   resend（重发）/operate（主工艺操作）/sub-operate（子工艺操作），无权限隐藏
 *   入口（旧 §7/§8.2 同边界）；
 * - 工艺列表为调度执行数据但旧实现无轮询（仅查询与操作后刷新），等价迁移不
 *   新增轮询（DoD 7：不擅自改数据新鲜度语义）；无手动刷新按钮（按钮纪律）；
 *   空值一律留白。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Dropdown, Input, Space } from 'antd'
import type { MenuProps } from 'antd'
import { CalendarClock, ChevronDown, MoreHorizontal, RefreshCcw, Search as SearchIcon, SquarePen } from 'lucide-react'
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
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  orderFlowOperation,
  pageOrderFlows,
  subOrderFlowOperation,
} from '@/services/order-flow/order-flow.service'
import type {
  OrderFlowDto,
  OrderFlowOperationType,
  SubOrderFlowDto,
} from '@/services/order-flow/order-flow.service.types'
import { OrderFlowModal } from '@/features/mission-cluster/components/OrderFlowModal'
import type { OrderFlowModalMode } from '@/features/mission-cluster/components/OrderFlowModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './MissionFlow.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 执行方式映射（0/1 语义来自 OpenAPI triggerType 描述，属既定语义） */
const TRIGGER_TYPE_LABELS: Record<string, string> = {
  '0': '并行触发',
  '1': '串行触发',
}

/** 子工艺状态映射（OpenAPI subOrderFlowState 描述枚举，属既定语义；未知原值展示） */
const SUB_FLOW_STATE_LABELS: Record<string, string> = {
  EXECUTING: '执行中',
  PAUSED: '已暂停',
  ABNORMAL: '异常',
  CANCELLED: '已取消',
  FAILED: '失败',
  COMPLETED: '已完成',
}

/** 控制命令菜单项（key=协议 operation 原值，旧 operates 同三键） */
const OPERATION_MENU_ITEMS: NonNullable<MenuProps['items']> = [
  { key: 'PAUSE', label: '暂停' },
  { key: 'CONTINUE', label: '继续' },
  { key: 'CANCEL', label: '取消' },
]

/** 空值留白单元格文本（null/undefined/空串一律 null——AGENTS 第 3 节纪律） */
function blankable(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

export default function MissionFlow() {
  const { t } = useTranslation('orderFlow')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（旧 §7/§8.2 同边界）：创建/重发/主工艺操作/子工艺操作，无权限隐藏
  // （历史码值交叉：本页为工艺管理，按钮码挂 mission-template:* 族）
  const { hasPerm } = usePermission()
  const canCreate = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_CREATE)
  const canResend = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_RESEND)
  const canOperate = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_OPERATE)
  const canSubOperate = hasPerm(PERM_BUTTON.MISSION_TEMPLATE_SUB_OPERATE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<OrderFlowDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写命令成功的主刷新入口；状态以服务端为准） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('order-flow:main')
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

  /* --------------------- 控制命令防连点（主/子工艺共用键空间） --------------------- */

  // 同一行只允许一个在途控制命令（键加前缀隔离主/子工艺：flow-<id>/sub-<id>）
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  /**
   * 控制命令统一发送：confirmCommand 确认（列明对象与影响）→ 发送 → 成功反馈 +
   * 刷新列表（真实状态以服务端为准）；取消不发任何请求。
   * danger=取消命令（破坏性，红色确认按钮）；目标与权限由调用方分别校验
   * （主工艺 operate 码/子工艺 sub-operate 码，A14 主/子分别校验对象）。
   */
  const fireFlowOperation = useCallback(
    (options: {
      /** 防连点键（flow-<id> / sub-<id>） */
      pendingId: string
      /** 确认框标题（已翻译） */
      title: string
      /** 目标展示名（名称+标识） */
      target: string
      /** 命令中文名（暂停/继续/取消，用于影响说明） */
      operationLabel: string
      /** 取消命令为破坏性确认 */
      danger?: boolean
      /** 发送请求 */
      send: () => Promise<void>
    }) => {
      void confirmCommand({
        title: options.title,
        targets: [options.target],
        impact: t('{{operation}}影响：将向调度系统发送「{{operation}}」命令，执行结果以列表刷新结果为准', {
          operation: options.operationLabel,
        }),
        danger: options.danger,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingKey(options.pendingId)
        try {
          await options.send()
          message.success(t('当前任务操作成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('当前任务操作出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /** 主工艺控制命令入口：对象=工艺名称（工艺标识），权限=operate 码 */
  const handleFlowOperation = useCallback(
    (record: OrderFlowDto, operation: OrderFlowOperationType) => {
      const id = record.id
      if (id === undefined || id === null) return
      const labelMap: Record<OrderFlowOperationType, string> = {
        PAUSE: t('暂停'),
        CONTINUE: t('继续'),
        CANCEL: t('取消'),
      }
      fireFlowOperation({
        pendingId: `flow-${id}`,
        title: t('{{operation}}工艺：{{name}}', {
          operation: labelMap[operation],
          name: record.orderFlowName ?? '',
        }),
        target: `${blankable(record.orderFlowName) ?? ''}（${blankable(record.orderFlowKey) ?? ''}）`,
        operationLabel: labelMap[operation],
        danger: operation === 'CANCEL',
        send: () => orderFlowOperation({ id, operation }),
      })
    },
    [fireFlowOperation, t],
  )

  /** 子工艺控制命令入口：对象=订单模版名称（子工艺标识），权限=sub-operate 码 */
  const handleSubFlowOperation = useCallback(
    (record: SubOrderFlowDto, operation: OrderFlowOperationType) => {
      const id = record.id
      if (id === undefined || id === null) return
      const labelMap: Record<OrderFlowOperationType, string> = {
        PAUSE: t('暂停'),
        CONTINUE: t('继续'),
        CANCEL: t('取消'),
      }
      fireFlowOperation({
        pendingId: `sub-${id}`,
        title: t('{{operation}}子工艺：{{name}}', {
          operation: labelMap[operation],
          name: record.orderTemplateName ?? '',
        }),
        target: `${blankable(record.orderTemplateName) ?? ''}（${blankable(record.subOrderFlowKey) ?? ''}）`,
        operationLabel: labelMap[operation],
        danger: operation === 'CANCEL',
        send: () => subOrderFlowOperation({ id, operation }),
      })
    },
    [fireFlowOperation, t],
  )

  /* ------------------------------ 弹窗状态（先于列定义） ------------------------------ */

  // 弹窗双态：create 创建 / resend 重发（回显源行，提交走创建）
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<OrderFlowModalMode>('create')
  const [formTarget, setFormTarget] = useState<OrderFlowDto | null>(null)

  // 操作列默认钉右（P14–P24 同款；无已保存偏好时生效）
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

  /** 打开创建/重发弹窗 */
  const openForm = useCallback((mode: OrderFlowModalMode, target: OrderFlowDto | null) => {
    setFormMode(mode)
    setFormTarget(target)
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
  }, [])

  /** 表单提交成功：清弹窗状态、关闭弹窗（弹窗自销毁草稿）、刷新列表 */
  const handleFormSucceeded = useCallback(() => {
    setFormTarget(null)
    setFormOpen(false)
    reloadList()
  }, [reloadList])

  /* --------------------------- 展开行子工艺子表（Apex data） --------------------------- */

  /**
   * 子表列：与旧版 SubFlowTable 四列逐列核对（订单模版名称/订单模版标识/
   * 工艺状态/操作），均空值留白；操作列 width 150 钉右（旧 fixed right 同款）。
   */
  const subColumns = useMemo<ApexColumnDef<SubOrderFlowDto>[]>(() => {
    return [
      {
        accessorKey: 'orderTemplateName',
        header: t('订单模版名称'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        accessorKey: 'orderTemplateKey',
        header: t('订单模版标识'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        // 工艺状态：后端受控枚举映射；未知枚举显示协议原值（旧实现同款），
        // 缺失留白（Apex cell getValue 对泛型列推断为 {}，P12 同款断言收窄）
        accessorKey: 'subOrderFlowState',
        header: t('工艺状态'),
        enableSorting: false,
        cell: (info) => {
          const raw = info.getValue() as string | null | undefined
          if (raw === null || raw === undefined || raw === '') return null
          return SUB_FLOW_STATE_LABELS[raw] ? t(SUB_FLOW_STATE_LABELS[raw]) : String(raw)
        },
      },
      {
        // 子工艺操作列：无 sub-operate 权限隐藏（旧同边界）；确认与防连点统一走
        // fireFlowOperation
        id: 'subActions',
        header: t('操作'),
        enableSorting: false,
        size: 150,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingKey !== null && pendingKey === `sub-${record.id}`
          if (!canSubOperate) return null
          return (
            <Dropdown
              trigger={['click']}
              disabled={pending}
              menu={{
                items: OPERATION_MENU_ITEMS.map((item) =>
                  item && 'label' in item && item.label
                    ? { ...item, label: t(String(item.label)) }
                    : item,
                ),
                onClick: ({ key }) => handleSubFlowOperation(record, key as OrderFlowOperationType),
              }}
            >
              <Button size="small" icon={<MoreHorizontal size={12} />}>
                {t('操作')}
                <ChevronDown size={12} />
              </Button>
            </Dropdown>
          )
        },
      },
    ]
  }, [t, canSubOperate, pendingKey, handleSubFlowOperation])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<OrderFlowDto>[]>(() => {
    return [
      {
        // 工艺名称：旧版弹性列；缺失留白
        accessorKey: 'orderFlowName',
        header: t('工艺名称'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        // 工艺标识：旧版弹性列；缺失留白
        accessorKey: 'orderFlowKey',
        header: t('工艺标识'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        // 时间表达式：原样展示（保留旧秒位与 ? 语义）；部署时区语义在后端，
        // 不推算下一次执行时间（P21 专项验收纪律）
        accessorKey: 'cronExpression',
        header: t('时间表达式'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        // 循环次数：数值原样（-1=无限循环由 tooltip 说明承载，列表不臆造文案）
        accessorKey: 'triggerTimes',
        header: t('循环次数'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        // 执行方式：0=并行触发/1=串行触发（OpenAPI 既定语义）；未知值显示协议
        // 原值（AGENTS 纪律；旧实现未知返回空串，收敛差异登记）
        accessorKey: 'triggerType',
        header: t('执行方式'),
        enableSorting: false,
        cell: (info) => {
          const raw = info.getValue()
          if (raw === null || raw === undefined || raw === '') return null
          const label = TRIGGER_TYPE_LABELS[String(raw)]
          return label ? t(label) : String(raw)
        },
      },
      {
        // 操作列：旧版 width 220 fixed right（Apex 默认钉右）；重发 primary +
        // 操作 Dropdown（暂停/继续/取消）；入口按按钮码控制（无权限隐藏）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 220,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingKey !== null && pendingKey === `flow-${record.id}`
          return (
            <Space size={4}>
              {/* 重发工艺：无权限隐藏（回显整表单、提交走创建，旧同语义） */}
              {canResend ? (
                <Button
                  size="small"
                  type="primary"
                  icon={<RefreshCcw size={12} />}
                  disabled={pending}
                  onClick={() => openForm('resend', record)}
                >
                  {t('重发')}
                </Button>
              ) : null}
              {/* 主工艺操作 Dropdown：无 operate 权限隐藏；菜单项=暂停/继续/取消 */}
              {canOperate ? (
                <Dropdown
                  trigger={['click']}
                  disabled={pending}
                  menu={{
                    items: OPERATION_MENU_ITEMS.map((item) =>
                      item && 'label' in item && item.label
                        ? { ...item, label: t(String(item.label)) }
                        : item,
                    ),
                    onClick: ({ key }) => handleFlowOperation(record, key as OrderFlowOperationType),
                  }}
                >
                  <Button size="small" type="primary" icon={<CalendarClock size={12} />}>
                    {t('操作')}
                    <ChevronDown size={12} />
                  </Button>
                </Dropdown>
              ) : null}
            </Space>
          )
        },
      },
    ]
  }, [t, canResend, canOperate, pendingKey, openForm, handleFlowOperation])

  /* --------------------------------- 搜索提交 --------------------------------- */

  /** 提交搜索：记录条件并回首页重新查询（旧实现 onSearch 回首页同语义） */
  const handleSearch = useCallback(() => {
    queryRef.current = searchText.trim()
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [searchText])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：工艺搜索框（左，旧实现 Search enterButton 同形态）+ 创建工艺
          按钮（右，按按钮码显隐）；不设手动刷新按钮，新鲜度由控制命令成功后的
          自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('搜索工艺')}
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
          {/* 创建工艺：无权限隐藏 */}
          {canCreate ? (
            <Button
              type="primary"
              icon={<SquarePen size={14} />}
              onClick={() => openForm('create', null)}
            >
              {t('创建工艺')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；展开行子表
          （子工艺）为只读+操作的 Apex data 模式小集合 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageOrderFlows(
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
          getRowId={stringFieldRowId('id')}
          locale={apexLocale}
          expandable={{
            // 子工艺子表：数据=行内 subOrderFlows；真实完整小集合 data 模式
            // =P20/P22 同款；行 ID=子工艺数据库 id；无子工艺不可展开
            expandedRowRender: (record) => (
              <ApexTableReact
                columns={subColumns}
                data={record.subOrderFlows ?? []}
                getRowId={(row) => String(row.id ?? `sub-${record.id}`)}
                locale={apexLocale}
                density="compact"
                pagination={false}
                virtualization={false}
                columnSettingsEnabled={false}
              />
            ),
            rowExpandable: (record) => (record.subOrderFlows?.length ?? 0) > 0,
          }}
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
            persistPrefs({ columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}) })
          }
          onColumnSizingChange={(updater) =>
            persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
          }
          onColumnPinningChange={(updater) =>
            persistPrefs({ columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? defaultPinning) })
          }
        />
      </div>

      {/* 创建/重发弹窗：关闭即销毁草稿（destroyOnHidden，旧 handleCancel 同语义） */}
      <OrderFlowModal
        open={formOpen}
        mode={formMode}
        target={formTarget}
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
