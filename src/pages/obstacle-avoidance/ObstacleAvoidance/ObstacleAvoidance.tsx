/**
 * 避障模板页（P22 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\ObstacleAvoidance）：antd Table + 名称搜索 +
 * 新增/编辑弹窗 + Popconfirm 删除 + 展开行子表（避障参数明细）。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=id
 *   （int64 主键，stringFieldRowId 收敛字符串）、列偏好 obstacle-avoidance:main、
 *   内建取消/错误重试）；分页参数 G04 平铺口径（pageNo/pageSize/query）；
 *   排序不启用（G09：pageObstacleAvoidance 无排序参数）；
 * - 列结构与旧版逐列核对：避障名称（弹性）+ 操作（旧版 200 固定右侧，
 *   Apex 默认钉右）；空值一律留白；
 * - 展开行子表（避障参数名称/避障参数类型/是否启用避障参数）同样使用
 *   ApexTableReact data 模式（真实完整小集合，禁 antd Table/自绘表格）；
 *   enable 为 boolean 协议原值映射「启用/未启用」（旧实现同语义），缺失留白；
 *   avoid 为协议原值展示（未知标识不臆造中文）；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；
 *   旧版 Popconfirm 仅「确认删除当前数据?」一问，DoD 8 升级，控制样板见
 *   P04–P18）；
 * - 新增/编辑弹窗（名称 + Transfer 选模板 + 参数配置表）见 ObstacleTemplateModal；
 * - 无权限动作隐藏（按钮码 obstacle-avoidance:add/update/delete，与旧 §7/§8.2
 *   一致；菜单码 obstacle-avoidance:view 挂路由守卫）；
 * - 模板为配置数据不轮询（DoD 7），新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Space } from 'antd'
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
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteObstacleAvoidance,
  pageObstacleAvoidance,
} from '@/services/obstacle-avoidance/obstacle-avoidance.service'
import type {
  ObstacleAvoidanceDto,
  ObstacleAvoidanceParameterDto,
} from '@/services/obstacle-avoidance/obstacle-avoidance.service.types'
import { ObstacleTemplateModal } from '@/features/obstacle-avoidance/components/ObstacleTemplateModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './ObstacleAvoidance.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function ObstacleAvoidance() {
  const { t } = useTranslation('obstacleTemplate')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7/§8.2 一致）：新增/编辑/删除，无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.OBSTACLE_AVOIDANCE_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.OBSTACLE_AVOIDANCE_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.OBSTACLE_AVOIDANCE_DELETE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<ObstacleAvoidanceDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('obstacle-avoidance:main')
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
  const [editTarget, setEditTarget] = useState<ObstacleAvoidanceDto | null>(null)

  // 操作列默认钉右（P14–P18 同款；无已保存偏好时生效，恢复默认回到出厂空态
  // 后由本默认兜底——用户保存的偏好优先于代码默认）
  const defaultPinning: ColumnPinningState = useMemo(() => ({ start: [], end: ['actions'] }), [])

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: ObstacleAvoidanceDto) => {
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

  /* ------------------- 删除避障模板（confirmCommand 破坏性确认） ------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = int64 主键 id）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除避障模板：按 int64 主键 id 定位（协议原样）；确认后删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: ObstacleAvoidanceDto) => {
      const rowId = String(record.id ?? '')
      void confirmCommand({
        title: t('删除避障模板'),
        targets: [record.obstacleAvoidanceName ?? ''],
        impact: t('删除影响：该避障模板将被永久删除，且不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteObstacleAvoidance({ id: record.id as number })
          message.success(t('删除避障数据成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除避障数据出错：{{msg}}', { msg: apiErrorMessage(error) }))
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

  /* --------------------------- 展开行子表（Apex data 模式） --------------------------- */

  /**
   * 避障参数明细子表列定义：与旧版 expandedRowRender 三列逐列核对
   * （避障参数名称/避障参数类型/是否启用避障参数，均弹性；空值留白；
   * enable true→启用 / false→未启用为旧实现既定两态映射，缺失留白；
   * avoid 协议原值展示，未知标识不臆造中文）。
   */
  const detailColumns = useMemo<ApexColumnDef<ObstacleAvoidanceParameterDto>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('避障参数名称'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        accessorKey: 'avoid',
        header: t('避障参数类型'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        accessorKey: 'enable',
        header: t('是否启用避障参数'),
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue()
          if (value === null || value === undefined) return null
          return value ? t('启用') : t('未启用')
        },
      },
    ],
    [t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<ObstacleAvoidanceDto>[]>(() => {
    return [
      {
        // 避障名称：旧版弹性列；缺失留白
        accessorKey: 'obstacleAvoidanceName',
        header: t('避障名称'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
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
              {/* 编辑避障：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除避障：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
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
      {/* 工具行：避障策略名称搜索框（左，旧实现 Search enterButton 同形态）+
          新增按钮（右，按按钮码显隐）；不设手动刷新按钮，新鲜度由写操作成功后
          的自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('输入避障策略名称查询')}
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
          {/* 新增避障：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('新增避障')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；
          展开行显示避障参数明细子表（旧实现同形态，无参数不可展开） */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageObstacleAvoidance(
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
          expandable={{
            expandedRowRender: (record) => (
              // 避障参数明细子表：真实完整小集合走 Apex data 模式（禁 antd
              // Table/自绘表格）；无编辑控件（只读子表），关闭虚拟化防小集合
              // 行为差异；行 ID=名称+类型复合（参数无独立主键，复合标识稳定）
              <ApexTableReact
                columns={detailColumns}
                data={record.parameters ?? []}
                getRowId={(row) => `${row.name ?? ''}-${row.avoid ?? ''}`}
                locale={apexLocale}
                density="compact"
                pagination={false}
                virtualization={false}
                columnSettingsEnabled={false}
              />
            ),
            rowExpandable: (record) => (record.parameters?.length ?? 0) > 0,
          }}
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
      <ObstacleTemplateModal
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
