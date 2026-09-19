/**
 * 角色管理页（P32 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\AccessManagement\RoleManagement）：antd Table +
 * 搜索框 + 新增/编辑共用弹窗 + 分配权限三态树弹窗 + Popconfirm 删除。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（GET pageRoles 服务端分页、稳定行
 *   ID、列偏好、内建取消/错误重试）；排序不启用（G09：旧页面无排序）；
 * - 列结构与旧版逐列核对（旧版为 antd Table 默认左对齐，等价保持 start 不臆改）：
 *   角色编码 200 省略悬浮 / 角色名称弹性省略悬浮 / 状态 90（ENABLED→启用、
 *   DISABLED→禁用；未知枚举原值呈现、缺失留白）/ 创建时间、更新时间弹性
 *   （displayDateTime 秒级展示，缺失留白）/ 操作列默认钉右（编辑 / 分配权限 /
 *   删除）；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；旧版
 *   仅 Popconfirm 一问，B3 CRUD 先例见 P04/P31）；编辑与分配权限无破坏性，
 *   保持直接打开；
 * - 权限分配弹窗为父子三态勾选（持久半选，旧 SPEC_permission_modal_tri_state
 *   D1–D12 完整等价迁移，见 PermissionAssignModal）；权限变更时效=下次登录
 *   生效（旧 SPEC B15），不伪造即时权限刷新；
 * - 前端不按行收敛内置角色（旧实现同边界：删除/编辑按钮对所有行均呈现，内
 *   置角色保护由后端业务码拒绝并如实反馈）；
 * - 无权限动作隐藏（按钮码 auth:role:add/update/assign-permission/delete，与
 *   旧 §7 一致）；页面守卫 auth:role:view（root 专属码，T00 routeAccess 同语
 *   义拦截）；
 * - 普通 CRUD 不轮询、无手动刷新按钮（按钮纪律），新鲜度由写操作成功后的
 *   自动 reload 保证。
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
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { displayDateTime } from '@/utils/datetime/datetimeDisplay'
import {
  deleteRole,
  pageRoles,
} from '@/services/access-role/access-role.service'
import type {
  AuthRoleRecord,
  AuthRoleState,
} from '@/services/access-role/access-role.service.types'
import { RoleEditModal } from '@/features/access-role/components/RoleEditModal'
import { PermissionAssignModal } from '@/features/access-role/components/PermissionAssignModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './RoleManagement.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function RoleManagement() {
  const { t } = useTranslation('access-role')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：动作触发型无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.AUTH_ROLE_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.AUTH_ROLE_UPDATE)
  const canAssignPermission = hasPerm(PERM_BUTTON.AUTH_ROLE_ASSIGN_PERMISSION)
  const canDelete = hasPerm(PERM_BUTTON.AUTH_ROLE_DELETE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<AuthRoleRecord>>(null)

  // 搜索关键字经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef<string>('')
  const [queryText, setQueryText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('access-role:main')
  const [prefSlices, setPrefSlices] = useState<ColumnPrefSlices>({})
  const prefSlicesRef = useRef<ColumnPrefSlices>({})

  // 代码默认钉位：操作列固定右侧（旧版操作列 fixed right 等价迁移；
  // 用户保存的列偏好优先于代码默认，仅在无已保存偏好时生效）
  const defaultPinning: ColumnPinningState = { start: [], end: ['actions'] }

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

  // 新增 / 编辑共用弹窗：null=新增模式，非空=编辑目标行快照（旧 isModify/modifyRow 合并）
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AuthRoleRecord | null>(null)
  // 分配权限弹窗：目标行快照（roleId/roleName 驱动回显与标题）
  const [permTarget, setPermTarget] = useState<AuthRoleRecord | null>(null)

  /* ----------------------------- 删除角色（破坏性确认） ----------------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除角色：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: AuthRoleRecord) => {
      const rowKey = String(record.id ?? '')
      const targetName = record.name || record.code || ''
      void confirmCommand({
        title: t('删除角色'),
        targets: [targetName],
        impact: t('删除影响：该角色将被永久删除且不可恢复，关联用户将失去对应权限'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowKey)
        try {
          await deleteRole({ id: Number(record.id) })
          message.success(t('删除角色成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除角色失败：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /* --------------------------------- 搜索提交 --------------------------------- */

  /** 提交搜索：trim 后记录条件并回首页重新查询（旧版 onSearch 重置第一页同语义） */
  const handleSearch = useCallback((value: string) => {
    queryRef.current = value.trim()
    setQueryText(queryRef.current)
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<AuthRoleRecord>[]>(() => {
    /** 省略单元格：单行省略 + 悬浮完整值（缺失留白，不写「—」占位） */
    const ellipsisCell = (value: string | null | undefined) => {
      if (value === null || value === undefined || value === '') return null
      return (
        <Tooltip title={value} placement="topLeft">
          <span className={styles.ellipsis}>{value}</span>
        </Tooltip>
      )
    }

    return [
      {
        // 角色编码：省略+悬浮（旧版 200 宽同款）
        accessorKey: 'code',
        header: t('角色编码'),
        enableSorting: false,
        size: 200,
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 角色名称：弹性省略+悬浮（旧版无固定宽同款）
        accessorKey: 'name',
        header: t('角色名称'),
        enableSorting: false,
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 状态：受控枚举映射文案（ENABLED→启用 / DISABLED→禁用）；未知枚举
        // 原值呈现不猜语义（纪律收敛：旧版把非 ENABLED 一律渲染为「禁用」，
        // 重写后按 AGENTS 第 3 节区分，差异登记 P32 交接记录）；缺失留白
        accessorKey: 'state',
        header: t('状态'),
        enableSorting: false,
        size: 90,
        cell: (info) => {
          const value = info.getValue() as AuthRoleState | string | null | undefined
          if (value === null || value === undefined || value === '') return null
          if (value === 'ENABLED') return t('启用')
          if (value === 'DISABLED') return t('禁用')
          return String(value)
        },
      },
      {
        // 创建时间：displayDateTime 秒级展示（缺失/不可解析留白；后端时间串
        // 展示层统一转换，与 P31 用户管理同款）。宽度 170：秒级 19 字符实占
        // ~146px（AGENTS 第 1 节换算），Apex 默认 150 会截断（联验截图实证）
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 更新时间：同创建时间
        accessorKey: 'updateTime',
        header: t('更新时间'),
        enableSorting: false,
        size: 170,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：默认钉右（旧版 fixed right）；按钮按码控权（旧 §7 同语义）；
        // 单项隐藏保留空操作列
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 260,
        cell: ({ row }) => {
          const record = row.original
          const rowKey = String(record.id ?? '')
          const pending = pendingRowKey === rowKey
          return (
            <Space size={4}>
              {/*
               * 编辑角色：无 auth:role:update 权限条件渲染隐藏；
               * 入口已控权，弹窗内提交按钮无需重复控权（旧 §7.7）
               */}
              {canUpdate ? (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setEditTarget(record)
                    setEditOpen(true)
                  }}
                >
                  {t('编辑')}
                </Button>
              ) : null}
              {/*
               * 分配权限：无 auth:role:assign-permission 权限隐藏（旧 §7.7 同语义）
               */}
              {canAssignPermission ? (
                <Button size="small" onClick={() => setPermTarget(record)}>
                  {t('分配权限')}
                </Button>
              ) : null}
              {/*
               * 删除角色：无 auth:role:delete 权限隐藏；确认统一走 confirmCommand
               * （列明对象与影响；旧版 Popconfirm 一问，B3 先例 P04/P31 同款升级）
               */}
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
  }, [t, canUpdate, canAssignPermission, canDelete, pendingRowKey, handleDelete])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左）+ 新增角色（右）；不设手动刷新按钮，新鲜度由写操作
          成功后的自动刷新保证（普通 CRUD 不轮询） */}
      <div className={styles.toolbar}>
        <Input.Search
          className={styles.search}
          placeholder={t('查询角色')}
          enterButton
          allowClear
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          onSearch={handleSearch}
        />
        <Space wrap size={8}>
          {/* 新增角色：无权限隐藏（工具栏独立按钮，旧 §7.1 同语义） */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={15} />} onClick={() => {
              setEditTarget(null)
              setEditOpen(true)
            }}>
              {t('新增角色')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；行 ID = id
          （int64 主键字符串化守卫精度）；分页档位沿用旧版 antd 默认 */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageRoles(
              { pageNo, pageSize, ...(queryRef.current ? { query: queryRef.current } : {}) },
              { signal: params.signal },
            ).then((page) => ({
              // rowCount 取真实 total；未知总数不由前端补 0（DoD 5）
              data: page.records ?? [],
              rowCount: page.total ?? 0,
            }))
          }}
          getRowId={stringFieldRowId('id')}
          locale={apexLocale}
          pagination={{ pageSizeOptions: [10, 20, 50, 100] }}
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

      {/* 新增 / 编辑共用弹窗：关闭即销毁草稿（旧版同语义，等价迁移） */}
      <RoleEditModal
        open={editOpen}
        modifyRow={editTarget}
        onClose={() => setEditOpen(false)}
        onSucceeded={() => {
          setEditOpen(false)
          reloadList()
        }}
      />

      {/* 分配权限弹窗：目标行快照驱动回显与标题；关闭清目标 */}
      <PermissionAssignModal
        open={permTarget !== null}
        roleId={permTarget?.id ?? null}
        roleName={permTarget?.name ?? null}
        onClose={() => setPermTarget(null)}
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
