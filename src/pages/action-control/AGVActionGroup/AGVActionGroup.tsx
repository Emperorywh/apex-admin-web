/**
 * 动作分组页（P24 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\ActionControl\AGVActionGroup）：antd Table +
 * 动作搜索 + 新增/编辑弹窗 + Popconfirm 删除；「动作组动作」列单元格内
 * DndContext + SortableContext 横向拖拽动作 Tag，松手即整组提交新顺序。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=id
 *   （int64 主键，stringFieldRowId 收敛字符串）、列偏好 agv-action-group:main、
 *   内建取消/错误重试）；分页参数 G04 平铺口径（pageNo/pageSize/query）；
 *   排序不启用（G09：pageAGVActionGroups 无排序参数）；
 * - 列结构与旧版逐列核对（3 列）：动作组名称（弹性，缺失留白）/动作组动作
 *   （弹性；单元格内 DndContext 横向拖拽 Tag，Tag 文本=动作描述、排序标识=
 *   动作 id——稳定动作标识与父组作用域，旧实现同形态）/操作（width 200
 *   钉右）；
 * - 拖拽重排：无 action-group:update 权限时传感器禁用（旧 sortableSensors
 *   同款双重保险）；松手后整组提交 {id, agvActionGroupName, agvActionIds}
 *   （updateAGVActionGroup 与弹窗编辑共用 operation，旧实现同形态）；成功
 *   reload + 「编辑动作组成功」；失败如实反馈并 reload 对齐服务端权威顺序
 *   （不显示假顺序、不假成功）；提交中锁行防连拖；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；旧版
 *   Popconfirm 仅「确认删除当前数据?」一问，DoD 8 升级，控制样板见 P04–P22）；
 * - 新增/编辑弹窗（名称 + 多选动作 + 失效动作识别拦截）见 ActionGroupModal；
 * - 无权限动作隐藏（按钮码 action-group:add/update/delete，旧 §7/§8.2 同
 *   边界；菜单码 action-group:view 挂路由守卫）；
 * - 动作分组为配置数据不轮询（DoD 7），新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）；
 * - 不落地 operation（旧仓库零 UI 消费者，登记于交接记录）：
 *   getAGVActionGroups 已由 P03 代建共享选项服务，本服务不重复落地。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Flex, Input, Space } from 'antd'
import { Plus, Search as SearchIcon } from 'lucide-react'
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
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteAgvActionGroup,
  pageAgvActionGroups,
  updateAgvActionGroup,
} from '@/services/action/agv-action-group-manage.service'
import type { AgvActionGroupRowDto } from '@/services/action/agv-action-group-manage.service.types'
import { ActionGroupModal } from '@/features/action-control/components/ActionGroupModal'
import { DraggableActionTag } from '@/features/action-control/components/DraggableActionTag'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './AGVActionGroup.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function AGVActionGroup() {
  const { t } = useTranslation('agvActionGroup')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7/§8.2 一致）：新增/编辑（含拖拽排序）/删除，无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.ACTION_GROUP_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.ACTION_GROUP_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.ACTION_GROUP_DELETE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<AgvActionGroupRowDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('agv-action-group:main')
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
  const [editTarget, setEditTarget] = useState<AgvActionGroupRowDto | null>(null)

  // 操作列默认钉右（P14–P22 同款；无已保存偏好时生效，恢复默认回到出厂空态
  // 后由本默认兜底——用户保存的偏好优先于代码默认）
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: AgvActionGroupRowDto) => {
    setEditTarget(record)
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
  }, [])

  /** 表单提交成功：清编辑目标、关闭弹窗（弹窗自销毁草稿）、刷新列表 */
  const handleFormSucceeded = useCallback(() => {
    setEditTarget(null)
    setFormOpen(false)
    reloadList()
  }, [reloadList])

  /* --------------------- 行级写操作防连点（删除/拖拽共用） --------------------- */

  // 同一行只允许一个在途写命令（行 ID = int64 主键 id；拖拽连拖与删除连点统一收敛）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /* --------------------- 删除动作分组（confirmCommand 破坏性确认） --------------------- */

  /** 删除动作分组：按 int64 主键 id 定位（body 仅 {id}，旧实现同形态）；确认后删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: AgvActionGroupRowDto) => {
      const rowId = String(record.id ?? '')
      void confirmCommand({
        title: t('删除车辆动作组'),
        targets: [record.actionGroupName ?? ''],
        impact: t('删除影响：该动作组将被永久删除，组配置不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteAgvActionGroup({ id: record.id as number })
          message.success(t('删除车辆动作组成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除车辆动作组出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* --------------------- 拖拽重排（「动作组动作」列单元格内） --------------------- */

  const sensors = useSensors(useSensor(PointerSensor))

  /**
   * 拖拽松手：组内动作按新顺序整组提交（稳定动作 id + 父组 id 作用域，旧实现
   * 同形态）；成功 reload + 反馈；失败如实反馈并 reload 对齐服务端权威顺序
   * （顺序唯一权威是服务端数据，不显示假顺序）；提交中锁行防连拖。
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent, record: AgvActionGroupRowDto) => {
      // 权限兜底：无编辑权限不允许拖拽排序（传感器已禁用，此处双重保险）
      if (!canUpdate) return
      const { active, over } = event
      if (!over || active.id === over.id) return
      const data = record.agvActions ?? []
      const oldIndex = data.findIndex((item) => item.id === active.id)
      const newIndex = data.findIndex((item) => item.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      const sortedActions = arrayMove(data, oldIndex, newIndex)
      const rowId = String(record.id ?? '')
      setPendingRowKey(rowId)
      updateAgvActionGroup({
        id: record.id as number,
        agvActionGroupName: record.actionGroupName ?? '',
        agvActionIds: sortedActions
          .map((item) => item.id)
          .filter((id): id is number => typeof id === 'number'),
      })
        .then(() => {
          message.success(t('编辑动作组成功'))
          reloadList()
        })
        .catch((error) => {
          if (!isCancelledError(error)) {
            message.error(t('编辑动作组出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
          // 失败后对齐服务端权威顺序（视觉复位），不保留假顺序
          reloadList()
        })
        .finally(() => {
          setPendingRowKey(null)
        })
    },
    [canUpdate, message, reloadList, t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<AgvActionGroupRowDto>[]>(() => {
    return [
      {
        // 动作组名称：旧版弹性列；缺失留白
        accessorKey: 'actionGroupName',
        header: t('动作组名称'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 动作组动作：旧版单元格内 DndContext + 横向拖拽 Tag 同形态；Tag 文本=
        // 动作描述（缺失留白）、排序标识=动作 id（稳定标识）；空数组/缺失留白；
        // 无 update 权限或该行提交中时拖拽传感器禁用（旧 sortableSensors 同款）
        accessorKey: 'agvActions',
        header: t('动作组动作'),
        enableSorting: false,
        cell: ({ row }) => {
          const actions = row.original.agvActions
          if (!actions || actions.length === 0) return null
          const pending = pendingRowKey !== null && pendingRowKey === String(row.original.id ?? '')
          const sortable = canUpdate && !pending
          return (
            <DndContext
              sensors={sortable ? sensors : []}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, row.original)}
            >
              <SortableContext
                items={actions
                  .map((item) => item.id)
                  .filter((id): id is number => typeof id === 'number')}
                strategy={horizontalListSortingStrategy}
              >
                <Flex gap="4px 0" wrap>
                  {actions.map((item, index) => (
                    <DraggableActionTag tag={item} key={item.id ?? `idx-${index}`} />
                  ))}
                </Flex>
              </SortableContext>
            </DndContext>
          )
        },
      },
      {
        // 操作列：旧版 width 200 fixed right（Apex 默认钉右）；入口按按钮码控制
        // （无权限隐藏）；删除走破坏性确认
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 200,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === String(record.id ?? '')
          return (
            <Space size={4}>
              {/* 编辑分组：无权限隐藏；该行提交中禁用防并发写 */}
              {canUpdate ? (
                <Button
                  size="small"
                  type="primary"
                  disabled={pending}
                  onClick={() => openEdit(record)}
                >
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
  }, [t, canUpdate, canDelete, pendingRowKey, sensors, openEdit, handleDelete, handleDragEnd])

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
      {/* 工具行：动作分组搜索框（左，旧实现 Search enterButton 同形态）+
          新增按钮（右，按按钮码显隐）；不设手动刷新按钮，新鲜度由写操作成功后
          的自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('查询车辆动作分组')}
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
          {/* 新增分组：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('新增分组')}
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
            return pageAgvActionGroups(
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

      {/* 新增/编辑弹窗：关闭即销毁草稿（destroyOnHidden，旧版同语义） */}
      <ActionGroupModal
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
