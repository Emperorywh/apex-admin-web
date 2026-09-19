/**
 * 车辆动作页（P23 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\ActionControl\AGVAction）：antd Table + 动作
 * 搜索 + 新增/编辑弹窗 + Popconfirm 删除；动作参数列单元格内 Descriptions
 * 逐行展示键值明细。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=id
 *   （int64 主键，stringFieldRowId 收敛字符串）、列偏好 agv-action:main、
 *   内建取消/错误重试）；分页参数 G04 平铺口径（pageNo/pageSize/query）；
 *   排序不启用（G09：pageAGVActions 无排序参数）；
 * - 列结构与旧版逐列核对：动作类型/动作描述/阻塞类型（协议原值，未知枚举
 *   原值展示不臆造中文）/动作参数（单元格 Descriptions column=1 逐行键值，
 *   旧实现同形态；非字符串 value 以 JSON 文本展示——展示层转换不改数据）；
 *   空值一律留白；
 * - 操作列：旧版 width 200 fixed right（Apex 默认钉右）；删除升级为
 *   confirmCommand 破坏性确认（列明对象与影响、防重复提交；旧版 Popconfirm
 *   仅「确认删除当前数据?」一问，DoD 8 升级，控制样板见 P04–P22）；
 * - 新增/编辑弹窗（四字段 + 动作参数 Form.List）见 ActionFormModal；
 * - 无权限动作隐藏（按钮码 action:vehicle:add/update/delete，与旧 §7/§8.2
 *   一致；菜单码 action:vehicle:view 挂路由守卫）；
 * - 动作配置为配置数据不轮询（DoD 7），新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）；
 * - 不落地 operation（旧仓库零 UI 消费者，登记于交接记录）：importExcel /
 *   exportExcel；getAGVActions 已由 P03 代建共享选项服务，不重复落地。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Descriptions, Input, Space } from 'antd'
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
import { useApexLocale } from '@/hooks/useApexLocale'
import { useColumnPreferences } from '@/hooks/useColumnPreferences'
import { usePermission } from '@/hooks/usePermission'
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { toValueDisplayText } from '@/utils/display/valueDisplay'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteAgvAction,
  pageAgvActions,
} from '@/services/action/agv-action-manage.service'
import type { AgvActionRowDto } from '@/services/action/agv-action-manage.service.types'
import { ActionFormModal } from '@/features/action-control/components/ActionFormModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './AGVAction.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function AGVAction() {
  const { t } = useTranslation('agvAction')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7/§8.2 一致）：新增/编辑/删除，无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.ACTION_VEHICLE_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.ACTION_VEHICLE_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.ACTION_VEHICLE_DELETE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<AgvActionRowDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('agv-action:main')
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
  const [editTarget, setEditTarget] = useState<AgvActionRowDto | null>(null)

  // 操作列默认钉右（P14–P22 同款；无已保存偏好时生效，恢复默认回到出厂空态
  // 后由本默认兜底——用户保存的偏好优先于代码默认）
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: AgvActionRowDto) => {
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

  /* --------------------- 删除车辆动作（confirmCommand 破坏性确认） --------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = int64 主键 id）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除车辆动作：按 int64 主键 id 定位（body 仅 {id}，旧实现同形态）；确认后删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: AgvActionRowDto) => {
      const rowId = String(record.id ?? '')
      void confirmCommand({
        title: t('删除车辆动作'),
        targets: [record.actionType ?? ''],
        impact: t('删除影响：该动作将被永久删除，且不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteAgvAction({ id: record.id as number })
          message.success(t('删除动作成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除动作出错：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* --------------------------------- 搜索提交 --------------------------------- */

  /** 提交搜索：记录条件并回首页重新查询（旧实现 onSearch 回首页同语义） */
  const handleSearch = useCallback(() => {
    queryRef.current = searchText.trim()
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [searchText])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<AgvActionRowDto>[]>(() => {
    return [
      {
        // 动作类型：旧版弹性列；缺失留白
        accessorKey: 'actionType',
        header: t('动作类型'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 动作描述：旧版弹性列；缺失留白
        accessorKey: 'actionDescription',
        header: t('动作描述'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 阻塞类型：协议原值展示（NONE/SOFT/HARD，旧实现同款不译）；
        // 未知枚举显示原值不臆造中文（P23 专项：不因未知枚举丢失）
        accessorKey: 'blockingType',
        header: t('阻塞类型'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 动作参数：旧版单元格内 Descriptions column=1 size=small 逐行键值
        // （label=动作名，children=动作值）同形态；非字符串 value 以 JSON 文本
        // 展示（展示层转换，不改数据）；无参数/缺失留白
        accessorKey: 'actionParameters',
        header: t('动作参数'),
        enableSorting: false,
        cell: ({ row }) => {
          const params = row.original.actionParameters
          if (!params || params.length === 0) return null
          return (
            <Descriptions
              items={params.map((item, index) => ({
                key: `${item.key ?? ''}-${index}`,
                label: item.key ?? '',
                children: toValueDisplayText(item.value),
              }))}
              size="small"
              column={1}
            />
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
              {/* 编辑动作：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除动作：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
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
      {/* 工具行：动作搜索框（左，旧实现 Search enterButton 同形态）+
          新增按钮（右，按按钮码显隐）；不设手动刷新按钮，新鲜度由写操作成功后
          的自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('查询车辆动作')}
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
          {/* 新增动作：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('新增动作')}
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
            return pageAgvActions(
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

      {/* 新增/编辑弹窗：常挂保留草稿（新增模式）；编辑目标变化时重填 */}
      <ActionFormModal
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
