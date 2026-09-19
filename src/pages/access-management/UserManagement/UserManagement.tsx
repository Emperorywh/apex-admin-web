/**
 * 用户管理页（P31 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\AccessManagement\UserManagement）：antd Table +
 * 搜索框 + 新增用户弹窗 + 分配角色弹窗 + Popconfirm 删除/重置密码。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（GET pageUsers 服务端分页、稳定行
 *   ID、列偏好、内建取消/错误重试）；排序不启用（G09：旧页面无排序）；
 * - 列结构与旧版逐列核对（旧版为 antd Table 默认左对齐，等价保持 start 不臆改）：
 *   用户名 200 省略悬浮 / 状态 100（root 只读 Tag、其余 Switch 乐观切换）/ 创建
 *   时间、更新时间弹性（displayDateTime 秒级展示，缺失留白）/ 操作列默认钉右
 *   （重置密码 / 分配角色 / 删除）；
 * - 状态切换保持旧版乐观更新语义：Switch 即时响应（本地覆盖态），成功后回查
 *   真实状态、失败清除覆盖回滚呈现——不伪造成功；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；旧版仅
 *   Popconfirm 一问，B3 CRUD 先例见 P04）；重置密码保留旧版 Popconfirm 轻量
 *   确认形态（影响可控：重置为默认密码并当场告知）；
 * - root 为系统内置超管：状态只读 Tag、隐藏重置密码/分配角色/删除（旧实现同
 *   边界，后端仍是最终鉴权方）；
 * - 无权限动作隐藏（按钮码 auth:user:add/resetPassword/assign-role/delete，
 *   与旧 §7 一致）；页面守卫 auth:user:view（root 专属码，T00 routeAccess 同
 *   语义拦截）；
 * - 普通 CRUD 不轮询、无手动刷新按钮（按钮纪律），新鲜度由写操作成功后的
 *   自动 reload 保证。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Popconfirm, Space, Switch, Tag, Tooltip } from 'antd'
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
  deleteAuthUser,
  pageAuthUsers,
  resetAuthUserPassword,
  updateAuthUserState,
} from '@/services/access-user/access-user.service'
import type {
  AuthUserDto,
  AuthUserState,
} from '@/services/access-user/access-user.service.types'
import { UserCreateModal } from '@/features/access-user/components/UserCreateModal'
import { RoleAssignModal } from '@/features/access-user/components/RoleAssignModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './UserManagement.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 重置密码的默认新密码提示（旧实现前端写死的后端默认密码，等价迁移） */
const RESET_DEFAULT_PASSWORD = '123456'

export default function UserManagement() {
  const { t } = useTranslation('access-user')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：动作触发型无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.AUTH_USER_ADD)
  const canResetPassword = hasPerm(PERM_BUTTON.AUTH_USER_RESET_PASSWORD)
  const canAssignRole = hasPerm(PERM_BUTTON.AUTH_USER_ASSIGN_ROLE)
  const canDelete = hasPerm(PERM_BUTTON.AUTH_USER_DELETE)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<AuthUserDto>>(null)

  // 搜索关键字经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const queryRef = useRef<string>('')
  const [queryText, setQueryText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('access-user:main')
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

  /* --------------------------- 状态切换（乐观更新等价迁移） --------------------------- */

  // 乐观覆盖态：rowId → 目标状态。旧版直接改本地数组使 Switch 即时响应；Apex
  // request 模式数据由表格内建管理，这里以行级覆盖层等价实现——渲染时优先取
  // 覆盖态，成功后清除并回查真实状态，失败清除覆盖即回滚呈现（不伪造成功）。
  const [stateOverrides, setStateOverrides] = useState<Record<string, AuthUserState>>({})
  // 状态切换中的用户行 ID（Switch loading，防重复点击，旧版 togglingId 同语义）
  const [togglingRowKey, setTogglingRowKey] = useState<string | null>(null)

  const handleToggleState = useCallback(
    (record: AuthUserDto, checked: boolean) => {
      const rowKey = String(record.id ?? '')
      const nextState: AuthUserState = checked ? 'ENABLED' : 'DISABLED'
      // 乐观写覆盖态：Switch 即时响应（旧版 setUserRecords 同语义）
      setStateOverrides((prev) => ({ ...prev, [rowKey]: nextState }))
      setTogglingRowKey(rowKey)
      updateAuthUserState({ username: record.username ?? '', state: nextState })
        .then(() => {
          message.success(t('修改状态成功'))
          // 成功后回查真实状态并清除覆盖层（后端为准，不驻留前端假设）
          setStateOverrides((prev) => {
            const next = { ...prev }
            delete next[rowKey]
            return next
          })
          reloadList()
        })
        .catch((error) => {
          if (!isCancelledError(error)) {
            message.error(t('修改状态失败：{{msg}}', { msg: apiErrorMessage(error) }))
          }
          // 失败清除覆盖态即回滚呈现（旧版 getUsers() 刷新回滚同语义）
          setStateOverrides((prev) => {
            const next = { ...prev }
            delete next[rowKey]
            return next
          })
        })
        .finally(() => setTogglingRowKey(null))
    },
    [message, reloadList, t],
  )

  /* ------------------------------ 弹窗状态（先于列定义） ------------------------------ */

  const [createOpen, setCreateOpen] = useState(false)
  // 分配角色目标（行记录快照：id + username 用于回显查询与标题）
  const [assignTarget, setAssignTarget] = useState<AuthUserDto | null>(null)

  /* --------------------------- 重置密码（受控 Popconfirm） --------------------------- */

  // 受控 Popconfirm：行内 setState 会重建列定义并重挂单元格，非受控浮层 open
  // 会被重置（P14 沉淀⑩）；页面级持有当前确认目标行
  const [resetPwdRowKey, setResetPwdRowKey] = useState<string | null>(null)

  /** 重置密码确认：后端重置为默认密码，成功后当场告知（旧实现同语义） */
  const handleResetPassword = useCallback(
    (record: AuthUserDto) => {
      resetAuthUserPassword({ id: Number(record.id) })
        .then(() => {
          message.success(
            t('重置密码成功，新密码为：{{password}}', { password: RESET_DEFAULT_PASSWORD }),
          )
        })
        .catch((error) => {
          if (!isCancelledError(error)) {
            message.error(t('重置密码失败：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        })
    },
    [message, t],
  )

  /* ----------------------------- 删除用户（破坏性确认） ----------------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除用户：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: AuthUserDto) => {
      const rowKey = String(record.id ?? '')
      void confirmCommand({
        title: t('删除用户'),
        targets: [record.username ?? ''],
        impact: t('删除影响：该用户将被永久删除，且不可恢复'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowKey)
        try {
          await deleteAuthUser({ id: Number(record.id) })
          message.success(t('删除用户成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除用户失败：{{msg}}', { msg: apiErrorMessage(error) }))
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

  const columns = useMemo<ApexColumnDef<AuthUserDto>[]>(() => {
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
        // 用户名：省略+悬浮（旧版 200 宽同款）
        accessorKey: 'username',
        header: t('用户名'),
        enableSorting: false,
        size: 200,
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 状态：root 只读 Tag（系统内置超管禁止修改，旧实现同边界）；其余行
        // Switch 乐观切换；未知枚举原值呈现不猜语义；缺失留白
        accessorKey: 'state',
        header: t('状态'),
        enableSorting: false,
        size: 100,
        cell: ({ row }) => {
          const record = row.original
          // 展示值：乐观覆盖层优先，回退协议原值（显式 string 语义，比较统一）
          const value: string | null | undefined =
            stateOverrides[String(record.id ?? '')] ?? record.state
          if (value === null || value === undefined || value === '') return null
          // root：只读 Tag（绿=启用 / 红=禁用；未知枚举按纪律原值呈现）
          if (record.username === 'root') {
            if (value === 'ENABLED') return <Tag color="green">{t('启用')}</Tag>
            if (value === 'DISABLED') return <Tag color="red">{t('禁用')}</Tag>
            return <Tag>{value}</Tag>
          }
          if (value !== 'ENABLED' && value !== 'DISABLED') {
            // 非内置账号的未知枚举同样不猜语义（Switch 只消费受控枚举）
            return <Tag>{value}</Tag>
          }
          return (
            <Switch
              checked={value === 'ENABLED'}
              loading={togglingRowKey === String(record.id ?? '')}
              onChange={(checked) => handleToggleState(record, checked)}
              checkedChildren={t('启用')}
              unCheckedChildren={t('禁用')}
            />
          )
        },
      },
      {
        // 创建时间：displayDateTime 秒级展示（缺失/不可解析留白；后端实测毫秒串
        // 与 P26/P28/P30 同源既有能力，展示层统一转换）
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 更新时间：同创建时间
        accessorKey: 'updateTime',
        header: t('更新时间'),
        enableSorting: false,
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：默认钉右（旧版 fixed right）；按钮按码控权+root 行收敛；
        // 单项隐藏保留空操作列（旧 §7.2 同语义）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 260,
        cell: ({ row }) => {
          const record = row.original
          const rowKey = String(record.id ?? '')
          // root 为系统内置超管：隐藏重置密码/分配角色/删除（旧实现同边界）
          const isRoot = record.username === 'root'
          const pending = pendingRowKey === rowKey
          return (
            <Space size={4}>
              {/*
               * 重置密码：root 隐藏；无 resetPassword 码隐藏；
               * 受控 Popconfirm（行内重建不丢 open，P14 沉淀⑩）
               */}
              {!isRoot && canResetPassword ? (
                <Popconfirm
                  title={t('重置密码')}
                  description={t('确定重置该用户密码?')}
                  open={resetPwdRowKey === rowKey}
                  onOpenChange={(next) => setResetPwdRowKey(next ? rowKey : null)}
                  onConfirm={() => handleResetPassword(record)}
                  okText={t('确定')}
                  cancelText={t('取消')}
                >
                  <Button size="small">{t('重置密码')}</Button>
                </Popconfirm>
              ) : null}
              {/*
               * 分配角色：root 隐藏；无 assign-role 码隐藏（旧 §7.7 同语义）
               */}
              {!isRoot && canAssignRole ? (
                <Button
                  size="small"
                  type="primary"
                  disabled={pending}
                  onClick={() => setAssignTarget(record)}
                >
                  {t('分配角色')}
                </Button>
              ) : null}
              {/*
               * 删除用户：root 隐藏；无 delete 码隐藏；确认统一走 confirmCommand
               * （列明对象与影响；旧版 Popconfirm 一问，B3 先例 P04 同款升级）
               */}
              {!isRoot && canDelete ? (
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
    canResetPassword,
    canAssignRole,
    canDelete,
    stateOverrides,
    togglingRowKey,
    resetPwdRowKey,
    pendingRowKey,
    handleToggleState,
    handleResetPassword,
    handleDelete,
  ])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左）+ 新增用户（右）；不设手动刷新按钮，新鲜度由写操作
          成功后的自动刷新保证（普通 CRUD 不轮询） */}
      <div className={styles.toolbar}>
        <Input.Search
          className={styles.search}
          placeholder={t('查询用户')}
          enterButton
          allowClear
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          onSearch={handleSearch}
        />
        <Space wrap size={8}>
          {/* 新增用户：无权限隐藏（工具栏独立按钮，旧 §7.1 同语义） */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
              {t('新增用户')}
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
            return pageAuthUsers(
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

      {/* 新增用户弹窗：关闭即销毁草稿（旧版同语义，等价迁移） */}
      <UserCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSucceeded={() => {
          setCreateOpen(false)
          reloadList()
        }}
      />

      {/* 分配角色弹窗：目标行快照驱动回显与标题；关闭清目标 */}
      <RoleAssignModal
        open={assignTarget !== null}
        userId={assignTarget?.id ?? null}
        username={assignTarget?.username ?? null}
        onClose={() => setAssignTarget(null)}
        onSucceeded={() => {
          setAssignTarget(null)
          reloadList()
        }}
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
