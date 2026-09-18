/**
 * 载具类型页（P06 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\VehicleDeploy\VehicleType）：antd Table +
 * 名称/编码双筛选 + 新增/编辑弹窗（InputNumber 尺寸）+ Popconfirm 删除。
 * 本重写保持业务闭环等价并按样板升级基座：
 * - 列表迁移为 ApexTableReact request 模式（服务端分页、稳定行 ID、列偏好、
 *   内建取消/错误重试）；排序不启用（G09：旧页面无排序，后端未声明全量排序）；
 * - 列结构与旧版逐列核对：名称/编码左对齐、长度/宽度居中、创建时间秒级展示、
 *   操作列在末（编辑/删除按按钮码显隐）；
 * - 删除升级为 confirmCommand 破坏性确认（列明对象与影响、防重复提交；
 *   旧版仅「确定删除当前载具类型?」一问，控制样板见 P05/P04）；
 * - 新增/编辑弹窗草稿保留（CarrierFormModal 常挂，A13/DoD 7）；
 * - 无权限动作隐藏（按钮码 CARRIER_ADD/UPDATE/DELETE，与旧 §7 一致）；
 * - 普通 CRUD 配置数据不轮询（DoD 7：仅实时页按需轮询），新鲜度由写操作
 *   成功后的自动刷新保证；无手动刷新按钮（按钮纪律）。
 *
 * 权限呈现（P06 专项核对）：后端权限树真实下发 carrier:view（MENU，无 path；
 * 旧前端路由未写 access、由 MENU_TREE 兜底映射本路径），路由 meta.perm 挂
 * 后端已有码（PERM.CARRIER_VIEW），不公开访问也不凭空造码。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Input, Space, Tooltip } from 'antd'
import { Plus, Search as SearchIcon } from 'lucide-react'
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
  deleteCarrier,
  pageCarriers,
} from '@/services/vehicle/carrier.service'
import type { CarrierRecordDto } from '@/services/vehicle/carrier.service.types'
import { CarrierFormModal } from '@/features/carrier-type/components/CarrierFormModal'
import { PERM_BUTTON } from '@/constants/auth/permission.constants'
import styles from './VehicleType.module.css'

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function VehicleType() {
  const { t } = useTranslation('carrierType')
  const { message } = App.useApp()
  const apexLocale = useApexLocale()

  // 按钮码权限（与旧实现 §7 一致）：新增/编辑/删除载具类型，动作触发型无权限隐藏
  const { hasPerm } = usePermission()
  const canAdd = hasPerm(PERM_BUTTON.CARRIER_ADD)
  const canUpdate = hasPerm(PERM_BUTTON.CARRIER_UPDATE)
  const canDelete = hasPerm(PERM_BUTTON.CARRIER_DELETE)

  /* ------------------------------- 列表与筛选状态 ------------------------------- */

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<CarrierRecordDto>>(null)

  // 筛选条件经 ref 供 request 回调读取最新值（避免闭包捕获旧筛选）
  const nameRef = useRef<string>('')
  const codeRef = useRef<string>('')
  const [nameText, setNameText] = useState('')
  const [codeText, setCodeText] = useState('')

  /** 操作后统一刷新列表（写操作成功的主刷新入口） */
  const reloadList = useCallback(() => {
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 列偏好接线 --------------------------------- */

  const prefs = useColumnPreferences('carrier-type:main')
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
  const [editTarget, setEditTarget] = useState<CarrierRecordDto | null>(null)

  const openCreate = useCallback(() => {
    setEditTarget(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((record: CarrierRecordDto) => {
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

  /* --------------------- 删除载具类型（confirmCommand 破坏性确认） --------------------- */

  // 行级写操作防连点：同一行只允许一个在途命令（行 ID = String(id)）
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null)

  /** 展示名（名称 + 编码），确认框列明对象用 */
  const describeTarget = useCallback(
    (record: CarrierRecordDto) =>
      `${record.carrierName ?? ''}（${record.carrierCode ?? ''}）`,
    [],
  )

  /** 删除载具类型：高危确认（danger，列明对象与影响）→ 删除 → 刷新列表 */
  const handleDelete = useCallback(
    (record: CarrierRecordDto) => {
      const rowId = String(record.id)
      void confirmCommand({
        title: t('删除载具类型'),
        targets: [describeTarget(record)],
        impact: t('删除影响：载具类型将从系统移除，请确认无车辆或调度配置正在引用该类型'),
        danger: true,
      }).then(async (confirmed) => {
        if (!confirmed) return
        setPendingRowKey(rowId)
        try {
          await deleteCarrier({ id: record.id as number })
          message.success(t('删除载具类型成功'))
          reloadList()
        } catch (error) {
          if (!isCancelledError(error)) {
            message.error(t('删除载具类型失败') + apiErrorMessage(error))
          }
        } finally {
          setPendingRowKey(null)
        }
      })
    },
    [describeTarget, message, reloadList, t],
  )

  /* --------------------------------- 搜索与筛选 --------------------------------- */

  /** 提交筛选：记录条件并回首页重新查询（Apex request 模式下取消由表格内建） */
  const handleSearch = useCallback(() => {
    nameRef.current = nameText.trim()
    codeRef.current = codeText.trim()
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [nameText, codeText])

  /** 重置筛选：清空输入与已生效条件，回首页重查（旧实现同语义；非刷新按钮） */
  const handleReset = useCallback(() => {
    setNameText('')
    setCodeText('')
    nameRef.current = ''
    codeRef.current = ''
    tableInstanceRef.current?.resetPageIndex()
    tableApiRef.current?.reload()
  }, [])

  /* --------------------------------- 表格列定义 --------------------------------- */

  const columns = useMemo<ApexColumnDef<CarrierRecordDto>[]>(() => {
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
        accessorKey: 'carrierName',
        header: t('载具名称'),
        enableSorting: false,
        size: 220,
        cell: textCell(220),
      },
      {
        accessorKey: 'carrierCode',
        header: t('载具编码'),
        enableSorting: false,
        size: 220,
        cell: textCell(220),
      },
      {
        // 尺寸列：协议原样数值（mm），旧实现居中对齐；缺失留白
        accessorKey: 'carrierLength',
        header: t('载具长度(mm)'),
        enableSorting: false,
        size: 140,
        meta: { apex: { align: 'center' } },
        cell: textCell(140),
      },
      {
        accessorKey: 'carrierWidth',
        header: t('载具宽度(mm)'),
        enableSorting: false,
        size: 140,
        meta: { apex: { align: 'center' } },
        cell: textCell(140),
      },
      {
        accessorKey: 'createTime',
        header: t('创建时间'),
        enableSorting: false,
        size: 170,
        // 展示层统一秒级格式；缺失/不可解析留白（不写「—」占位）
        cell: (info) => displayDateTime(info.getValue() as string | null | undefined),
      },
      {
        // 操作列：入口按按钮码控制（无权限隐藏）
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 170,
        meta: { apex: { align: 'center' } },
        cell: ({ row }) => {
          const record = row.original
          const pending = pendingRowKey !== null && pendingRowKey === String(record.id)
          return (
            <Space size={4}>
              {/* 编辑载具类型：无权限隐藏 */}
              {canUpdate ? (
                <Button size="small" type="primary" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
              ) : null}
              {/* 删除载具类型：无权限隐藏；确认统一走 confirmCommand（列明对象与影响） */}
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
      {/* 工具行：名称/编码双筛选（左，旧实现同形态）+ 新增载具类型（右）；不设手动
          刷新按钮，新鲜度由写操作成功后的自动刷新保证（普通 CRUD 配置数据不轮询） */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Input
            className={styles.filterInput}
            placeholder={t('载具名称')}
            value={nameText}
            onChange={(event) => setNameText(event.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Input
            className={styles.filterInput}
            placeholder={t('载具编码')}
            value={codeText}
            onChange={(event) => setCodeText(event.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button type="primary" icon={<SearchIcon size={14} />} onClick={handleSearch}>
            {t('查询')}
          </Button>
          <Button onClick={handleReset}>{t('重置')}</Button>
        </div>
        <Space wrap size={8}>
          {/* 新增载具类型：无权限隐藏 */}
          {canAdd ? (
            <Button type="primary" icon={<Plus />} onClick={openCreate}>
              {t('新增载具类型')}
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
            return pageCarriers(
              {
                pageNo,
                pageSize,
                ...(nameRef.current ? { carrierName: nameRef.current } : {}),
                ...(codeRef.current ? { carrierCode: codeRef.current } : {}),
              },
              { signal: params.signal },
            ).then((page) => ({
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
      <CarrierFormModal
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
