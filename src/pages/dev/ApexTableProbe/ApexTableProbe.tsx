/**
 * T021 临时探针页：ApexTable 分页 / 跨页选择 / 主题语言 / 会话内存列布局演示。
 * T022 追加展开子表演示（成员表 / 任务多层展开 / 跨页展开规模）。
 *
 * - 临时路由 /dev/apex-table-probe，验证完成后随收尾移除（同 T013 探针先例）；
 * - 数据为真实后端只读查询（root），不做任何 mock；
 * - 本页仅用于能力演示与取证，不是业务页面，标签用中文字面量即可。
 */

import { useMemo } from 'react'
import {
  ApexTableReact,
  createLegacyTableRequest,
  useApexTableLocale,
  useCrossPageSelection,
  useSessionColumnLayout,
} from '@/components/ApexTable'
import type { ApexColumnDef } from '@/components/ApexTable'
import { legacyGet } from '@/services/request/legacy/legacyRequest'
import { convertLegacyPage, toRowId } from '@/services/request/legacy/legacyProtocol'
import type { LegacyRawPage } from '@/services/request/legacy/legacy.types'
import { localeChanged, themeChanged } from '@/store/slices/settingsSlice'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useTheme } from '@/hooks/useTheme'
import { SUPPORTED_LANGUAGES } from '@/i18n/i18n'
import ExpansionProbe from './ExpansionProbe'

/** 探针行形状：只取演示用到的字段，完整车辆模型归 T030（type 别名以满足库行约束） */
type ProbeVehicleRow = {
  key: string
  name?: string
  manufacturer?: string
  state?: {
    operatingMode?: string
    batteryState?: { batteryCharge?: number }
  }
}

/** 列定义保持模块级稳定引用，避免触发表格重建 */
const probeColumns: ApexColumnDef<ProbeVehicleRow>[] = [
  { accessorKey: 'key', header: 'Key', size: 180 },
  { accessorKey: 'name', header: '名称', size: 200 },
  { accessorKey: 'manufacturer', header: '制造商', size: 140 },
  { id: 'operatingMode', accessorFn: (row) => row.state?.operatingMode ?? '', header: '运行模式', size: 140 },
  { id: 'battery', accessorFn: (row) => row.state?.batteryState?.batteryCharge ?? 0, header: '电量(%)', size: 100 },
]

export default function ApexTableProbe() {
  const dispatch = useAppDispatch()
  const resolvedTheme = useTheme()
  const locale = useApexTableLocale()
  const selection = useCrossPageSelection()
  const layout = useSessionColumnLayout<ProbeVehicleRow>('probe-vehicles')

  // 服务端分页取数：旧协议 1 基页码在 createLegacyTableRequest 内换算
  const request = useMemo(
    () =>
      createLegacyTableRequest<ProbeVehicleRow>(async ({ pageNo, pageSize, signal }) => {
        const raw = await legacyGet<LegacyRawPage<ProbeVehicleRow>>(
          '/fms/v1/dispatcher/vehicle/pageVehicles',
          { pageNo, pageSize },
          { signal },
        )
        const page = convertLegacyPage(raw)
        return { items: page.items, total: page.total }
      }),
    [],
  )

  return (
    // T022 起页面含多个演示区块，整体改为纵向滚动。
    // 注意：固定高度滚动容器里的 flex 子项会被收缩压扁（flex-shrink 默认 1，
    // 表格根元素被压扁后视口测量为 0、行不渲染），顶层子元素一律 flexShrink: 0。
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto' }}>
      {/* 语言与主题切换：走全局 settings 动作，验证表格文案/配色随全局联动 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button key={lang} type="button" onClick={() => dispatch(localeChanged(lang))} style={{ padding: '2px 10px' }}>
            {lang}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dispatch(themeChanged(resolvedTheme === 'dark' ? 'light' : 'dark'))}
          style={{ padding: '2px 10px' }}
        >
          {resolvedTheme === 'dark' ? '浅色' : '深色'}
        </button>
        <button type="button" onClick={selection.clearSelection} style={{ padding: '2px 10px' }}>
          清空选择（{selection.selectionCount}）
        </button>
        <button type="button" onClick={layout.resetToDefault} style={{ padding: '2px 10px' }}>
          恢复默认列布局
        </button>
        <span style={{ color: 'var(--app-text-2)' }}>已选：{selection.selectedIds.join('、') || '无'}</span>
      </div>
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>样例〇 · 服务端分页与跨页选择（T021）</h4>
      <ApexTableReact
        columns={probeColumns}
        request={request}
        getRowId={(row) => toRowId(row.key)}
        pagination={{ pageSizeOptions: [10, 20, 50] }}
        locale={locale}
        columnSettingsEnabled
        showRowNumber
        showSelectionColumn
        height={520}
        style={{ flexShrink: 0 }}
        tableRef={layout.tableRef}
        {...layout.columnProps}
        state={{ rowSelection: selection.rowSelection }}
        onRowSelectionChange={selection.onRowSelectionChange}
      />
      {/* T022 展开子表演示：成员表 / 任务多层展开 / 分页×展开规模 */}
      <ExpansionProbe />
    </div>
  )
}
