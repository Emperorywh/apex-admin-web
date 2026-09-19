/**
 * 调度配置表格（P13）：单个配置分类的只读/可编辑行表。
 *
 * 独立组件的原因：每个分类 Tab 一个实例，表格 ref/列偏好互不串扰
 * （若共享宿主页 ref，antd Tabs 多 pane 并存时 ref 被最后挂载者覆盖）；
 * 同时避免宿主页混出非组件导出（fast-refresh 纪律）。
 *
 * 基座形态：ApexTableReact data 模式——getTaskConfigs 一次全量、无分页、
 * G09 不开放排序；稳定行 ID=configKey（协议唯一键）；列偏好
 * dispatch-config:main；配置值列常驻编辑控件（编辑值经 onEdit 写回宿主
 * 草稿 state，本组件不持有草稿），无 save 权限或未知值类型时只读文本。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input, InputNumber, Select, Switch } from 'antd'
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
import {
  isKnownValueType,
  parseConfigValueOptions,
  parseConfigValueRange,
  toEditorValue,
} from '@/features/dispatch-config/utils/configEditor'
import type { TaskConfigDto } from '@/services/dispatch-config/dispatch-config.service.types'

interface DispatchConfigTableProps {
  /** 当前分类的草稿行（编辑值由宿主持有，本组件纯受控） */
  rows: TaskConfigDto[]
  /** 保存权限：true 时配置值列常驻编辑控件，否则只读文本（A05 保留可读值） */
  canSave: boolean
  /** 单元格写回：控件值 → 宿主按 configKey 合入草稿（值字符串化在宿主完成） */
  onEdit: (configKey: string, valueType: TaskConfigDto['configValueType'], raw: unknown) => void
}

/** 列偏好四切片的受控 state 形状（官方适配器 load 返回，晚一帧应用） */
interface ColumnPrefSlices {
  columnOrder?: ColumnOrderState
  columnVisibility?: ColumnVisibilityState
  columnSizing?: ColumnSizingState
  columnPinning?: ColumnPinningState
}

export default function DispatchConfigTable({ rows, canSave, onEdit }: DispatchConfigTableProps) {
  // common 为常载基础命名空间（本项目 nsSeparator 关闭，t() 不带 ns: 前缀）
  const { t } = useTranslation(['dispatchConfig', 'common'], { nsMode: 'fallback' })
  const apexLocale = useApexLocale()

  const tableApiRef = useRef<ApexTableRef>(null)
  const tableInstanceRef = useRef<ApexTableInstance<TaskConfigDto>>(null)

  /* ------------------------------- 列偏好接线 ------------------------------- */

  const prefs = useColumnPreferences('dispatch-config:main')
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
   * 列偏好持久化（P03 实证约束）：受控切片必须同步更新防回弹；
   * save 是整体替换语义，必须传合并后的完整四切片。
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

  /* -------------------------------- 表格列定义 -------------------------------- */

  const columns = useMemo<ApexColumnDef<TaskConfigDto>[]>(
    () => [
      {
        // 配置名称：旧版同列序；缺失留白
        accessorKey: 'configKeyName',
        header: t('配置名称'),
        enableSorting: false,
        size: 240,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 默认值：只读参考列（旧版「重置为默认」语义废弃后保留展示）
        accessorKey: 'defaultConfigValue',
        header: t('默认值'),
        enableSorting: false,
        size: 140,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 配置值：可编辑列（save 权限 + 已知类型时常驻控件；否则只读文本留白）
        accessorKey: 'configValue',
        header: t('配置值'),
        enableSorting: false,
        size: 260,
        cell: ({ row }) => {
          const record = row.original
          const configKey = record.configKey ?? ''
          const valueType = record.configValueType
          if (!canSave || !isKnownValueType(valueType)) {
            // 无权限或未知类型：只读展示协议原值（A05 只读保留可读值 / 不猜语义）
            const text = record.configValue ?? ''
            return text === '' ? null : text
          }
          const writeBack = (raw: unknown) => onEdit(configKey, valueType, raw)
          if (valueType === 'bool') {
            return (
              <Switch
                size="small"
                checked={toEditorValue('bool', record.configValue) === true}
                onChange={(checked) => writeBack(checked)}
              />
            )
          }
          if (valueType === 'int' || valueType === 'double') {
            const range = parseConfigValueRange(record.configValueRange)
            return (
              <InputNumber
                style={{ width: '100%' }}
                size="small"
                value={toEditorValue(valueType, record.configValue) as number | undefined}
                min={range.min}
                max={range.max}
                precision={valueType === 'int' ? 0 : undefined}
                step={valueType === 'double' ? 0.01 : undefined}
                placeholder={t('请输入配置值')}
                onChange={(value) => writeBack(value)}
              />
            )
          }
          if (valueType === 'enum' || valueType === 'select') {
            const options = parseConfigValueOptions(record.configValueRange).map((opt) => ({
              label: opt,
              value: opt,
            }))
            return (
              <Select
                style={{ width: '100%' }}
                size="small"
                allowClear
                mode={valueType === 'select' ? 'multiple' : undefined}
                value={toEditorValue(valueType, record.configValue) as string | string[] | undefined}
                options={options}
                placeholder={t('请选择配置值')}
                maxTagCount="responsive"
                onChange={(value) => writeBack(value)}
              />
            )
          }
          return (
            <Input
              size="small"
              allowClear
              value={toEditorValue('string', record.configValue) as string}
              placeholder={t('请输入配置值')}
              onChange={(event) => writeBack(event.target.value)}
            />
          )
        },
      },
      {
        // 配置值范围：只读参考列（int/double 区间与 enum/select 选项的真实来源）
        accessorKey: 'configValueRange',
        header: t('配置值范围'),
        enableSorting: false,
        size: 200,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
      {
        // 配置值单位：旧版末列；缺失留白
        accessorKey: 'configValueUnit',
        header: t('配置值单位'),
        enableSorting: false,
        size: 100,
        cell: (info) => {
          const text = info.getValue()
          return text === null || text === undefined || text === '' ? null : String(text)
        },
      },
    ],
    [t, canSave, onEdit],
  )

  return (
    <ApexTableReact
      ref={tableApiRef}
      tableRef={tableInstanceRef}
      columns={columns}
      data={rows}
      getRowId={(row) => row.configKey ?? ''}
      locale={apexLocale}
      pagination={false}
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
        persistPrefs({
          columnVisibility: resolveUpdater(updater, prefSlices.columnVisibility ?? {}),
        })
      }
      onColumnSizingChange={(updater) =>
        persistPrefs({ columnSizing: resolveUpdater(updater, prefSlices.columnSizing ?? {}) })
      }
      onColumnPinningChange={(updater) =>
        persistPrefs({
          columnPinning: resolveUpdater(updater, prefSlices.columnPinning ?? { start: [], end: [] }),
        })
      }
    />
  )
}

/**
 * TanStack Updater 解析：回调可能收到值或函数（旧值 → 新值）。
 * 列偏好持久化只需要最终值，这里以当前受控切片为旧值统一折叠。
 */
function resolveUpdater<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater
}
