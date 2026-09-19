/**
 * 三方交管页（P19 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\TriTraffic）：antd Table + 搜索框 + 新增/编辑
 * 共用弹窗 + 检测 Dropdown（申请/释放）+ Popconfirm 删除。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（GET pageTripartiteTraffics 服务端
 *   分页、稳定行 ID、列偏好、内建取消/错误重试）；排序不启用（G09：旧页面无
 *   排序）；普通 CRUD 配置数据不轮询，新鲜度由写操作成功后的自动刷新保证；
 *   无手动刷新按钮（按钮纪律）；
 * - 列结构与旧版逐列核对（旧版为 antd Table 默认左对齐，等价保持 start 不臆改）：
 *   区域编号弹性省略悬浮 / 点边组合弹性（选项集合映射名称，无映射显示原值=
 *   已删除组合不可静默替换）/ 当前占用系统弹性省略悬浮 / 是否外部系统作为
 *   仲裁方 180（是/否布尔映射、缺失留白）/ 操作列 300 默认钉右；
 * - 检测（通信模拟测试）：菜单两项 申请(APPLY)/释放(RELEASE)，点击先经
 *   confirmCommand 确认层（标识目标区域与仿真语义=专项验收「调用真实后端并
 *   标识目标/仿真」），确认后真实调用 testCommunication，按真实结果反馈成功/
 *   失败（不用动画假装成功；契约分类：向三方仲裁系统发起的通信模拟，非车辆
 *   动、非本系统数据变更，A21 合法真实仿真接口保留并标识）；行级防连点；
 * - 删除升级为 confirmCommand 破坏性确认（danger，列明对象与影响；旧版仅
 *   Popconfirm 一问，B3 CRUD 先例 P04/P31/P32 同款）；编辑无破坏性直接打开；
 * - 权限：页面守卫 traffic:tripartite:view；新增/编辑/删除/检测按钮码
 *   traffic:tripartite:add/update/delete/check 无权限隐藏（旧 §7 一致，
 *   检测为粗粒度码、子项不再细分）；
 * - 点边组合选项（getSimpleTripartiteTrafficEdgeGroups）页面加载一次供列表
 *   映射与弹窗下拉；失败 message 如实反馈（旧版同语义），不阻塞列表主链路。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Dropdown, Input, Space, Tooltip } from 'antd'
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
import { stringFieldRowId } from '@/utils/table/rowId'
import { toBackendPage } from '@/utils/table/tablePaging'
import { confirmCommand } from '@/utils/command/commandConfirm'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import {
  deleteTripartiteTraffic,
  getSimpleTripartiteTrafficEdgeGroups,
  pageTripartiteTraffics,
  testCommunication,
  TRIPARTITE_SYSTEM_CODE,
} from '@/services/tripartite-traffic/tripartite-traffic.service'
import type {
  SimpleMapNodeEdgeGroup,
  TripartiteApplyType,
  TripartiteTrafficRecord,
} from '@/services/tripartite-traffic/tripartite-traffic.service.types'
import { TrafficEditModal } from '@/features/tri-traffic/components/TrafficEditModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './TriTraffic.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

/** 检测菜单项（旧实现 constants/TriTraffic testControls 同源：申请/释放两态） */
const TEST_MENU: { key: TripartiteApplyType }[] = [
  { key: 'APPLY' },
  { key: 'RELEASE' },
]

export default function TriTraffic() {
  const { t } = useTranslation('tripartite-traffic')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：动作触发型无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_DELETE)
  const canCheck = hasPerm(PERM_BUTTON.TRAFFIC_TRIPARTITE_CHECK)

  /* ------------------------------- 列表与搜索状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<TripartiteTrafficRecord>>(null)

  // 搜索关键字经 ref 供 request 回调读取最新值（避免闭包捕获旧条件）
  const areaCodeRef = useRef<string>('')
  const [areaCodeText, setAreaCodeText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* ------------------------------ 点边组合选项全集 ------------------------------ */

  // 列表「点边组合」列名称映射与弹窗下拉共用（旧实现同款页面级一次加载；
  // 失败 message 如实反馈不阻塞列表主链路，映射退化为显示原 id）
  const [edgeGroups, setEdgeGroups] = useState<SimpleMapNodeEdgeGroup[]>([])

  useEffect(() => {
    const controller = new AbortController()
    getSimpleTripartiteTrafficEdgeGroups({ signal: controller.signal })
      .then((groups) => setEdgeGroups(groups ?? []))
      .catch((error) => {
        if (!isCancelledError(error)) {
          message.warning(t('查询三方交管点边组合失败：{{msg}}', { msg: apiErrorMessage(error) }))
        }
      })
    return () => controller.abort()
  }, [message, t])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('tripartite-traffic:main')
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

  /* ------------------------------ 弹窗与写操作状态 ------------------------------ */

  // 新增 / 编辑共用弹窗：null=新增模式，非空=编辑目标行快照
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TripartiteTrafficRecord | null>(null)

  // 行级写操作防连点：同一行只允许一个在途命令（检测/删除共用行键）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 删除三方交管：高危确认（danger，列明对象与影响）→ 整行实体提交删除 → 刷新 */
  const handleDelete = useCallback(
    (record: TripartiteTrafficRecord) => {
      const rowKey = String(record.id ?? '')
      void confirmCommand({
        title: t('删除三方交管'),
        targets: [record.areaCode || rowKey],
        impact: t('删除影响：该区域的三方交管配置将被永久删除，仲裁方对应区域的协同关系随之解除'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowKey)
        try {
          // 旧实现同形态：请求体为整行实体（非 ?id= query 族）
          await deleteTripartiteTraffic(record)
          message.success(t('删除三方交管成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除三方交管失败：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, reloadList, t],
  )

  /**
   * 通信模拟测试：菜单选择 申请(APPLY)/释放(RELEASE) → 确认层（标识目标区域
   * 与仿真语义）→ 真实调用 testCommunication → 按真实结果反馈。
   * 契约分类（专项验收）：向三方仲裁系统发起的通信模拟（applyType+areaCode+
   * systemCode=rxx），非车辆动、非本系统数据变更；受理即链路反馈，无异步
   * 结果可核实（ResultVoid），失败如实呈现不伪装成功。
   */
  const handleTestCommunication = useCallback(
    (record: TripartiteTrafficRecord, applyType: TripartiteApplyType) => {
      const rowKey = String(record.id ?? '')
      const areaCode = record.areaCode ?? ''
      void confirmCommand({
        title: applyType === 'APPLY' ? t('申请') : t('释放'),
        targets: [areaCode || rowKey],
        impact: t(
          '通信模拟测试说明：将向三方仲裁系统发送{{action}}仿真请求（系统编号 rxx），验证协同链路；以真实返回结果为准',
          { action: applyType === 'APPLY' ? t('申请') : t('释放') },
        ),
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowKey)
        try {
          await testCommunication({
            applyType,
            areaCode,
            systemCode: TRIPARTITE_SYSTEM_CODE,
          })
          message.success(t('三方交管测试成功'))
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('三方交管测试失败：{{msg}}', { msg: apiErrorMessage(error) }))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [message, t],
  )

  /** 检测菜单 items（旧实现 testControls 同源两态，label 经翻译） */
  const testMenuItems: MenuProps['items'] = useMemo(
    () => TEST_MENU.map(({ key }) => ({ key, label: t(key === 'APPLY' ? '申请' : '释放') })),
    [t],
  )

  /** 检测菜单点击（旧实现 onTestCommunicationClick 同结构：按 key 分发申请/释放） */
  const onTestMenuClick = useCallback(
    (record: TripartiteTrafficRecord) =>
      (info: Parameters<NonNullable<MenuProps['onClick']>>[0]) => {
        // menu.key 由本页固定菜单渲染而来，仅 APPLY/RELEASE 两种
        if (info.key !== 'APPLY' && info.key !== 'RELEASE') return
        handleTestCommunication(record, info.key)
      },
    [handleTestCommunication],
  )

  /* --------------------------------- 搜索提交 --------------------------------- */

  /** 提交搜索：trim 后记录条件并回首页重新查询（旧版 onSearch 重置第一页同语义） */
  const handleSearch = useCallback((value: string) => {
    areaCodeRef.current = value.trim()
    setAreaCodeText(areaCodeRef.current)
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<TripartiteTrafficRecord>[]>(() => {
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
        // 区域编号：弹性省略+悬浮（旧版无固定宽同款）
        accessorKey: 'areaCode',
        header: t('区域编号'),
        enableSorting: false,
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 点边组合：选项集合映射名称，找不到映射（含组合已删除）显示原值——
        // 已删除组合不可静默替换（旧实现 edgeGroups.find(...)?.name || value 同语义）
        accessorKey: 'nodeEdgeGroupId',
        header: t('点边组合'),
        enableSorting: false,
        cell: (info) => {
          const value = info.getValue() as string | null | undefined
          if (value === null || value === undefined || value === '') return null
          const name = edgeGroups.find((group) => group.id === value)?.name
          return ellipsisCell(name || value)
        },
      },
      {
        // 当前占用系统：弹性省略+悬浮（仲裁方写入的占用状态，缺失留白）
        accessorKey: 'lockedSys',
        header: t('当前占用系统'),
        enableSorting: false,
        cell: (info) => ellipsisCell(info.getValue() as string | null | undefined),
      },
      {
        // 是否外部系统作为仲裁方：布尔映射 是/否（旧实现同款）；缺失留白
        accessorKey: 'isExternalArbitrator',
        header: t('是否外部系统作为仲裁方'),
        enableSorting: false,
        size: 180,
        cell: (info) => {
          const value = info.getValue() as boolean | null | undefined
          if (value === null || value === undefined) return null
          return value ? t('是') : t('否')
        },
      },
      {
        // 操作列：默认钉右（旧版 fixed right 300 宽）；检测/编辑/删除按码控权
        //（旧 §7 同语义），单项隐藏保留空操作列
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 300,
        cell: ({ row }) => {
          const record = row.original
          const rowKey = String(record.id ?? '')
          const pending = pendingRowKey === rowKey
          return (
            <Space size={4}>
              {/*
               * 检测（通信模拟测试）：粗粒度码 traffic:tripartite:check 控权、
               * 子项不再细分（旧 §7.4 同语义）；菜单申请/释放两态。
               */}
              {canCheck ? (
                <Dropdown
                  trigger={['click']}
                  disabled={pending}
                  menu={{
                    items: testMenuItems,
                    onClick: onTestMenuClick(record),
                  }}
                >
                  <Button size="small" type="primary">
                    {t('检测')}
                  </Button>
                </Dropdown>
              ) : null}
              {/*
               * 编辑：无 traffic:tripartite:update 权限隐藏；无破坏性直接打开
               *（旧 §7.2 同语义）
               */}
              {canUpdate ? (
                <Button
                  size="small"
                  type="primary"
                  disabled={pending}
                  onClick={() => {
                    setEditTarget(record)
                    setEditOpen(true)
                  }}
                >
                  {t('编辑')}
                </Button>
              ) : null}
              {/*
               * 删除：无 traffic:tripartite:delete 权限隐藏；确认统一走
               * confirmCommand（旧版 Popconfirm 一问，B3 先例同款升级）
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
  }, [
    t,
    edgeGroups,
    canCheck,
    canUpdate,
    canDelete,
    pendingRowKey,
    handleDelete,
    testMenuItems,
    onTestMenuClick,
  ])

  /* ------------------------------------ 渲染 ------------------------------------ */

  return (
    <div className={styles.page}>
      {/* 工具行：搜索（左）+ 新增三方交管（右）；不设手动刷新按钮（按钮纪律） */}
      <div className={styles.toolbar}>
        <Input.Search
          className={styles.search}
          placeholder={t('请输入区域编号查询')}
          enterButton
          allowClear
          value={areaCodeText}
          onChange={(event) => setAreaCodeText(event.target.value)}
          onSearch={handleSearch}
        />
        <Space wrap size={8}>
          {/* 新增三方交管：无权限隐藏（工具栏独立按钮，旧 §7.1 同语义） */}
          {canAdd ? (
            <Button type="primary" icon={<Plus size={15} />} onClick={() => {
              setEditTarget(null)
              setEditOpen(true)
            }}>
              {t('新增三方交管')}
            </Button>
          ) : null}
        </Space>
      </div>

      {/* 主列表：Apex request 模式（服务端分页/取消/错误重试内建）；行 ID = id
          （int64 主键字符串化守卫精度）；点边组合名称映射依赖 edgeGroups */}
      <div className={styles.tableWrap}>
        <ApexTableReact
          ref={tableApiRef}
          tableRef={tableInstanceRef}
          columns={columns}
          request={(params) => {
            const { pageNo, pageSize } = toBackendPage(params.pageIndex, params.pageSize)
            return pageTripartiteTraffics(
              {
                pageNo,
                pageSize,
                ...(areaCodeRef.current ? { areaCode: areaCodeRef.current } : {}),
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
      <TrafficEditModal
        open={editOpen}
        edgeGroups={edgeGroups}
        modifyRow={editTarget}
        onClose={() => setEditOpen(false)}
        onSucceeded={() => {
          setEditOpen(false)
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
