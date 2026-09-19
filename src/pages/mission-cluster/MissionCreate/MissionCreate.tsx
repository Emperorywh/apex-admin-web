/**
 * 任务工艺页（P20 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\MissionCluster\MissionCreate）：antd Table +
 * 任务搜索 + 创建/编辑/复制弹窗 + Popconfirm 删除 + 双层展开行子表
 * （子任务表：地图名称/地图ID/站点名称/站点ID；再展开动作表：动作类型/动作
 * 描述/阻塞类型/动作参数 Descriptions）。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=id（int64
 *   主键，stringFieldRowId 收敛字符串）、列偏好 order-template:main、内建取消/
 *   错误重试）；分页参数 G04 平铺口径（pageNo/pageSize/query，query=模板名称
 *   或编号）；排序不启用（G09：pageOrderTemplates 无排序参数）；
 * - 列结构与旧版逐列核对（4 列）：任务名称（弹性）/任务标识（弹性）/
 *   指定车辆（组）（弹性；appointVehicleName 优先、缺失回退 appointVehicle-
 *   GroupName=旧 render 同语义）/操作（width 260 钉右：复制+编辑 primary、
 *   删除 danger）；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；旧版
 *   Popconfirm 仅「确定删除当前任务?」一问，DoD 8 升级，样板见 P04–P24）；
 *   注意删除按 orderTemplateKey 定位（body 仅 {orderTemplateKey}，旧实现同
 *   形态——与 P23/P24 按 int64 id 定位不同族）；
 * - 展开行双层子表均使用 ApexTableReact data 模式（真实完整小集合、只读、
 *   关闭虚拟化防小集合行为差异=P22 同款；行 ID：子任务行=数据库 id、动作行=
 *   传入前注入的「动作类型+卡内序号」复合标识（动作无独立主键，旧实现
 *   rowKey=actionType 的唯一化增强，同类型多动作不撞 ID）；
 * - 新增/编辑/复制弹窗（三层嵌套表单）见 MissionTemplateModal；权限按钮码
 *   mission-flow:add/copy/update/delete（无权限隐藏，旧 §7/§8.2 同边界；
 *   注意历史码值交叉：本页为任务工艺但按钮码挂 mission-flow:*、路由视图码
 *   mission-flow:view——旧路由/权限清单实证，非工艺管理页的 mission-template:*）；
 * - 任务工艺为配置数据不轮询（DoD 7），新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）；空值一律留白。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Descriptions, Input, Space } from 'antd'
import { Copy, PenLine, Plus, Search as SearchIcon, Trash2 } from 'lucide-react'
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
import { toValueDisplayText } from '@/utils/display/valueDisplay'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteOrderTemplate,
  pageOrderTemplates,
} from '@/services/order-template/order-template-manage.service'
import type {
  TemplateActionDto,
  TemplateMissionRowDto,
  TemplateRowDto,
} from '@/services/order-template/order-template-manage.service.types'
import { MissionTemplateModal } from '@/features/mission-cluster/components/MissionTemplateModal'
import type { MissionTemplateModalMode } from '@/features/mission-cluster/components/MissionTemplateModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './MissionCreate.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 动作子表行：协议动作 + 注入的卡内唯一行 ID（动作无独立主键） */
interface ActionRow extends TemplateActionDto {
  __rowId: string
}

/** 空值留白单元格文本（null/undefined/空串一律 null——AGENTS 第 3 节纪律） */
function blankable(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value)
}

export default function MissionCreate() {
  const { t } = useTranslation('orderTemplate')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7/§8.2 一致）：创建/复制/编辑/删除，无权限隐藏
  // （历史码值交叉：任务工艺页按钮码为 mission-flow:*，旧权限清单实证）
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.MISSION_FLOW_ADD)
  const canCopy = hasPerm(PERM_BUTTON.MISSION_FLOW_COPY)
  const canUpdate = hasPerm(PERM_BUTTON.MISSION_FLOW_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.MISSION_FLOW_DELETE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<TemplateRowDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('order-template:main')
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

  /* --------------------- 行级写操作防连点（删除共用） --------------------- */

  // 同一行只允许一个在途写命令（行 ID = int64 主键 id）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /* ------------------------------ 弹窗状态（先于列定义） ------------------------------ */

  // 弹窗三态：create 创建 / edit 编辑（携带 id 更新）/ copy 复制（回显后走创建）
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<MissionTemplateModalMode>('create')
  const [formTarget, setFormTarget] = useState<TemplateRowDto | null>(null)

  // 操作列默认钉右（P14–P24 同款；无已保存偏好时生效）
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

  const openForm = useCallback((mode: MissionTemplateModalMode, target: TemplateRowDto | null) => {
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

  /* --------------------- 删除任务工艺模板（confirmCommand 破坏性确认） --------------------- */

  /** 删除模板：按 orderTemplateKey 定位（body 仅 {orderTemplateKey}，旧实现同形态）；
   *  确认后删除 → 刷新列表；行级防连点 */
  const handleDelete = useCallback(
    (record: TemplateRowDto) => {
      const rowId = String(record.id ?? '')
      void confirmCommand({
        title: t('删除任务'),
        targets: [record.orderTemplateName ?? ''],
        impact: t('删除影响：该任务模板及其子任务配置将被永久删除，不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteOrderTemplate({ orderTemplateKey: record.orderTemplateKey ?? '' })
          message.success(t('删除任务成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除任务出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* --------------------------- 展开行子表列（双层 Apex） --------------------------- */

  /**
   * 第一层子表（子任务）：与旧版 MissionTable 四列逐列核对（地图名称/地图ID/
   * 站点名称/站点ID，均弹性；空值留白）。
   */
  const missionColumns = useMemo<ApexColumnDef<TemplateMissionRowDto>[]>(
    () => [
      {
        accessorKey: 'mapName',
        header: t('地图名称'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        accessorKey: 'mapId',
        header: t('地图ID'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        accessorKey: 'stationName',
        header: t('站点名称'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        accessorKey: 'stationId',
        header: t('站点ID'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
    ],
    [t],
  )

  /**
   * 第二层子表（动作）：与旧版 ActionsTable 四列逐列核对（动作类型/动作描述/
   * 阻塞类型/动作参数；动作参数列旧 width 25% 同比例，单元格内 Descriptions
   * 逐行展示参数名=值，空参数留白；阻塞类型协议原值，未知枚举不臆造中文映射）。
   */
  const actionColumns = useMemo<ApexColumnDef<ActionRow>[]>(
    () => [
      {
        accessorKey: 'actionType',
        header: t('动作类型'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        accessorKey: 'actionDescription',
        header: t('动作描述'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        accessorKey: 'blockingType',
        header: t('阻塞类型'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        accessorKey: 'actionParameters',
        header: t('动作参数'),
        enableSorting: false,
        size: 260,
        cell: ({ row }) => {
          // Apex cell getValue 对数组列泛型推断为 {}（P12 同款），改从行数据断言取值
          const params = row.original.actionParameters
          if (!params || params.length === 0) return null
          return (
            <Descriptions
              column={1}
              size="small"
              items={params.map((param, index) => ({
                key: `${param.key ?? 'param'}-${index}`,
                label: blankable(param.key) ?? '',
                children: toValueDisplayText(param.value),
              }))}
            />
          )
        },
      },
    ],
    [t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<TemplateRowDto>[]>(() => {
    return [
      {
        // 任务名称：旧版弹性列；缺失留白
        accessorKey: 'orderTemplateName',
        header: t('任务名称'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        // 任务标识：旧版弹性列；缺失留白
        accessorKey: 'orderTemplateKey',
        header: t('任务标识'),
        enableSorting: false,
        cell: (info) => blankable(info.getValue()),
      },
      {
        // 指定车辆（组）：车辆名优先、缺失回退分组名（旧 render 同语义）；均缺失留白
        id: 'appointVehicle',
        header: t('指定车辆（组）'),
        enableSorting: false,
        cell: ({ row }) =>
          blankable(row.original.appointVehicleName) ??
          blankable(row.original.appointVehicleGroupName),
      },
      {
        // 操作列：旧版 width 260 fixed right（Apex 默认钉右）；入口按按钮码控制
        // （无权限隐藏）；删除走破坏性确认
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 260,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === String(record.id ?? '')
          return (
            <Space size={4}>
              {/* 复制任务：无权限隐藏（回显整表单、提交走创建不带 id） */}
              {canCopy ? (
                <Button
                  size="small"
                  type="primary"
                  icon={<Copy size={12} />}
                  disabled={pending}
                  onClick={() => openForm('copy', record)}
                >
                  {t('复制')}
                </Button>
              ) : null}
              {/* 编辑任务：无权限隐藏（按 id 定位整模板替换） */}
              {canUpdate ? (
                <Button
                  size="small"
                  type="primary"
                  icon={<PenLine size={12} />}
                  disabled={pending}
                  onClick={() => openForm('edit', record)}
                >
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除任务：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
              {canDelete ? (
                <Button
                  size="small"
                  danger
                  icon={<Trash2 size={12} />}
                  disabled={pending}
                  onClick={() => handleDelete(record)}
                >
                  {t('删除')}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ]
  }, [t, canCopy, canUpdate, canDelete, pendingRowKey, openForm, handleDelete])

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
      {/* 工具行：任务搜索框（左，旧实现 Search enterButton 同形态）+ 创建任务
          按钮（右，按按钮码显隐）；不设手动刷新按钮，新鲜度由写操作成功后的
          自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('搜索任务')}
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
          {/* 创建任务：无权限隐藏 */}
          {canAdd ? (
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => openForm('create', null)}
            >
              {t('创建任务')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；展开行双层
          子表（子任务→动作）均为只读 Apex data 模式小集合 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageOrderTemplates(
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
            // 第一层：子任务子表（数据=行内 orderMissions；真实完整小集合 data
            // 模式=P22 同款；行 ID=数据库 id；无子任务不可展开）
            expandedRowRender: (record) => (
              <ApexTableReact
                columns={missionColumns}
                data={record.orderMissions ?? []}
                getRowId={(row) => String(row.id ?? `mission-${record.id}`)}
                locale={apexLocale}
                density="compact"
                pagination={false}
                virtualization={false}
                columnSettingsEnabled={false}
                expandable={{
                  // 第二层：动作子表（动作无独立主键：传入前注入「动作类型+卡内
                  // 序号」复合行 ID，旧实现 rowKey=actionType 的唯一化增强）
                  expandedRowRender: (mission) => (
                    <ApexTableReact
                      columns={actionColumns}
                      data={(mission.actions ?? []).map((row, index) => ({
                        ...row,
                        __rowId: `${row.actionType ?? ''}-${index}`,
                      }))}
                      getRowId={(row) => row.__rowId}
                      locale={apexLocale}
                      density="compact"
                      pagination={false}
                      virtualization={false}
                      columnSettingsEnabled={false}
                    />
                  ),
                  rowExpandable: (mission) => (mission.actions?.length ?? 0) > 0,
                }}
              />
            ),
            rowExpandable: (record) => (record.orderMissions?.length ?? 0) > 0,
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

      {/* 创建/编辑/复制弹窗：关闭即销毁草稿（destroyOnHidden，旧版同语义） */}
      <MissionTemplateModal
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
