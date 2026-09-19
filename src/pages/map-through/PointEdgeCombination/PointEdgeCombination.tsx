/**
 * 多地图点边组合页（P11 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\MapThrough\PointEdgeCombination）：antd Table +
 * 名称搜索 + 新增/编辑弹窗 + Popconfirm 删除 + 展开行子表（组合内的
 * 点边组合-所属地图明细）。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 主列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID=id
 *   （int64 主键，stringFieldRowId 收敛字符串）、列偏好 node-edge-group:main、
 *   内建取消/错误重试）；排序不启用（G09：pageSystemNodeEdgeGroups 无排序参数）；
 * - 列结构与旧版逐列核对：组合名称/组合Key/包含组合（Tag 列表）/更新时间（180）
 *   + 操作（180，钉右）；空值一律留白；
 * - 展开行子表（点边组合名称/所属地图/节点数量/边数量）同样使用 ApexTableReact
 *   data 模式（真实完整小集合，禁 antd Table/自绘表格）；无明细行不可展开；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；
 *   旧版仅「删除之后不可恢复」一问，控制样板见 P04–P10）；
 * - 新增/编辑弹窗（名称 + 穿梭框选点边组合、失效关联识别并阻止保存）见
 *   NodeEdgeGroupModal；
 * - 无权限动作隐藏（按钮码 point-edge-combination:add/update/delete，与旧 §7/
 *   §8.2 一致；菜单码 point-edge-combination:view 挂路由守卫）；
 * - 组合为配置数据不轮询（DoD 7），新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Space, Tag } from 'antd'
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
  deleteSystemNodeEdgeGroup,
  pageSystemNodeEdgeGroups,
} from '@/services/node-edge-group/node-edge-group.service'
import type {
  MapNodeEdgeGroupJsonDto,
  SystemNodeEdgeGroupDto,
} from '@/services/node-edge-group/node-edge-group.service.types'
import { NodeEdgeGroupModal } from '@/features/node-edge-group/components/NodeEdgeGroupModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './PointEdgeCombination.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function PointEdgeCombination() {
  const { t } = useTranslation('nodeEdgeGroup')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7/§8.2 一致）：新增/编辑/删除，无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.POINT_EDGE_COMBINATION_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.POINT_EDGE_COMBINATION_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.POINT_EDGE_COMBINATION_DELETE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<SystemNodeEdgeGroupDto>>(null)

  // 搜索条件经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef('')
  const [searchText, setSearchText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('node-edge-group:main')
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
  const [editTarget, setEditTarget] = useState<SystemNodeEdgeGroupDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: SystemNodeEdgeGroupDto) => {
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

  /* ------------------- 删除多地图点边组合（confirmCommand 破坏性确认） ------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = int64 主键 id）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除组合：按 int64 主键 id 定位（协议原样）；确认后删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: SystemNodeEdgeGroupDto) => {
      const rowId = String(record.id ?? '')
      void confirmCommand({
        title: t('删除多地图点边组合'),
        targets: [record.nodeEdgeGroupName ?? ''],
        impact: t('删除影响：该多地图点边组合将被永久删除，组合内的点边组合引用同时解除，且不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteSystemNodeEdgeGroup({ systemNodeEdgeGroupId: record.id as number })
          message.success(t('删除多地图点边组合成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除多地图点边组合出错：{{msg}}', { msg: apiErrorMessage(error) }))
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
   * 明细子表列定义：与旧版 expandedRowRender 四列逐列核对
   * （点边组合名称/所属地图/节点数量/边数量，均弹性；空值留白，计数缺失留白）。
   */
  const detailColumns = useMemo<ApexColumnDef<MapNodeEdgeGroupJsonDto>[]>(
    () => [
      {
        accessorKey: 'nodeEdgeGroup',
        header: t('点边组合名称'),
        enableSorting: false,
        cell: ({ row }) => {
          const name = row.original.nodeEdgeGroup?.name
          return name === null || name === undefined || name === '' ? null : String(name)
        },
      },
      {
        accessorKey: 'simpleMap',
        header: t('所属地图'),
        enableSorting: false,
        cell: ({ row }) => {
          // 旧实现优先展示地图名称，缺失回退地图 id；两者皆缺留白
          const mapName = row.original.simpleMap?.mapName
          const mapId = row.original.simpleMap?.mapId
          const text = mapName || mapId
          return text ? String(text) : null
        },
      },
      {
        id: 'nodeCount',
        header: t('节点数量'),
        enableSorting: false,
        cell: ({ row }) => {
          // 计数列：协议缺失留白（留白 ≠ 0），有值显示真实长度
          const ids = row.original.nodeEdgeGroup?.nodeIds
          return Array.isArray(ids) ? ids.length : null
        },
      },
      {
        id: 'edgeCount',
        header: t('边数量'),
        enableSorting: false,
        cell: ({ row }) => {
          const ids = row.original.nodeEdgeGroup?.edgeIds
          return Array.isArray(ids) ? ids.length : null
        },
      },
    ],
    [t],
  )

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<SystemNodeEdgeGroupDto>[]>(() => {
    return [
      {
        // 组合名称：旧版 220；缺失留白
        accessorKey: 'nodeEdgeGroupName',
        header: t('组合名称'),
        enableSorting: false,
        size: 220,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 组合Key（后端生成的唯一 key）：弹性列；缺失留白
        accessorKey: 'nodeEdgeGroupKey',
        header: t('组合Key'),
        enableSorting: false,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 包含组合（关联的点边组合名称 Tag 列表，旧版 Space wrap 同形态）：弹性列
        accessorKey: 'nodeEdgeGroups',
        header: t('包含组合'),
        enableSorting: false,
        cell: ({ row }) => {
          const groups = row.original.nodeEdgeGroups ?? []
          if (groups.length === 0) return null
          return (
            <Space size={[4, 4]} wrap>
              {groups.map((group, index) => {
                // Tag key：点边组合 id + 地图 id 复合（旧实现 rowKey 同语义；
                // index 只兜底双缺失的极端渲染场景，不作为业务标识）
                const key =
                  (group.nodeEdgeGroup?.id ?? '') + (group.simpleMap?.mapId ?? '') || `idx-${index}`
                return (
                  <Tag key={key} color="blue">
                    {group.nodeEdgeGroup?.name ?? ''}
                  </Tag>
                )
              })}
            </Space>
          )
        },
      },
      {
        // 更新时间：旧版 180；缺失留白（后端字符串直出）
        accessorKey: 'updateTime',
        header: t('更新时间'),
        enableSorting: false,
        size: 180,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 操作列：入口按按钮码控制（无权限隐藏）；删除走破坏性确认
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 180,
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === String(record.id ?? '')
          return (
            <Space size={4}>
              {/* 编辑组合：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除组合：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
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
      {/* 工具行：组合名称搜索框（左，旧实现 Search 同形态）+ 新增按钮（右，
          按按钮码显隐）；不设手动刷新按钮，新鲜度由写操作成功后的自动刷新保证 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            placeholder={t('根据组合名称查询')}
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
          {/* 新增组合：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t('新增组合')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；
          展开行显示组合内的点边组合-所属地图明细子表（旧实现同形态，无明细不可展开） */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageSystemNodeEdgeGroups(
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
              // 明细子表：真实完整小集合走 Apex data 模式（禁 antd Table/自绘表格）；
              // 无编辑控件（只读子表），关闭虚拟化防小集合行为差异
              <ApexTableReact
                columns={detailColumns}
                data={record.nodeEdgeGroups ?? []}
                getRowId={(row) =>
                  // 子表行 ID：点边组合 id + 地图 id 复合（旧实现 rowKey 同语义）
                  `${row.nodeEdgeGroup?.id ?? ''}-${row.simpleMap?.mapId ?? ''}`
                }
                locale={apexLocale}
                density="compact"
                pagination={false}
                virtualization={false}
                columnSettingsEnabled={false}
              />
            ),
            rowExpandable: (record) => (record.nodeEdgeGroups?.length ?? 0) > 0,
          }}
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100, 200] }}
          columnSettingsEnabled
          height="100%"
          state={{
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

      {/* 新增/编辑弹窗：常挂保留草稿（新增模式）；编辑目标变化时重填 */}
      <NodeEdgeGroupModal
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
