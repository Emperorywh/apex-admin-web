/**
 * T022 临时探针页·展开子表演示：成员表 / 任务多层展开 / 跨页展开规模。
 *
 * - 隶属 /dev/apex-table-probe 临时路由，随收尾卡一并移除；
 * - 三组样例均为真实后端只读查询（root），不做任何 mock：
 *   ① pageVehicleGroups → simpleAGVs（分组成员子表，P06 数据形状预演）；
 *   ② pageOrderTemplates → orderMissions → actions（工艺模板三级展开，P20 形状预演）；
 *   ③ pageOrderFlows → subOrderFlows（79 行 4 页父表，验证分页×展开规模）；
 * - 服务实现责任不因本演示改变：vehicle-group/template/flow 的 service 层
 *   仍归 T028/T059(T061)/T063（TASKS §5 分工），本页只做能力取证。
 */

import { useMemo } from 'react'
import {
  ApexTableReact,
  createLegacyTableRequest,
  useApexTableLocale,
} from '@/components/ApexTable'
import type { ApexColumnDef } from '@/components/ApexTable'
import { legacyGet } from '@/services/request/legacy/legacyRequest'
import { convertLegacyPage, toRowId } from '@/services/request/legacy/legacyProtocol'
import type { LegacyRawPage } from '@/services/request/legacy/legacy.types'

/* -------------------------------------------------------------------------- */
/* 数据形状：只取演示所需字段，完整 DTO 归各业务任务卡                              */
/* -------------------------------------------------------------------------- */

/** 分组成员（OpenAPI SimpleAGV） */
type ProbeSimpleAgv = { key?: string; name?: string }

/** 车辆分组行（pageVehicleGroups.records） */
type ProbeGroupRow = {
  agvGroupKey: string
  agvGroupName?: string
  createTime?: string
  simpleAGVs?: ProbeSimpleAgv[]
}

/** 模板动作参数（key-value 形状，P20 Actions.actionParameters） */
type ProbeActionParameter = { key?: string; value?: unknown }

/** 模板动作（P20 Actions：类型/描述/阻塞类型/参数列表） */
type ProbeAction = {
  actionType?: string
  actionDescription?: string
  blockingType?: string
  actionParameters?: ProbeActionParameter[]
}

/** 模板子任务（P20 OrderMissionTemplate：地图/站点 + 动作列表） */
type ProbeMission = {
  id?: number
  mapName?: string
  mapId?: string
  stationName?: string
  stationId?: string
  actions?: ProbeAction[]
}

/** 工艺模板行（pageOrderTemplates.records） */
type ProbeTemplateRow = {
  orderTemplateKey: string
  orderTemplateName?: string
  appointVehicleName?: string
  appointVehicleGroupName?: string | null
  orderMissions?: ProbeMission[]
}

/** 工艺实例行（pageOrderFlows.records，含子流程） */
type ProbeFlowRow = {
  orderFlowKey: string
  orderFlowName?: string
  triggerType?: string
  triggerTimes?: number
  cronExpression?: string
  subOrderFlows?: ProbeSubFlow[]
}

/** 子流程（SubOrderFlow：引用模板与车辆，状态字段演示子表内容） */
type ProbeSubFlow = {
  subOrderFlowKey?: string
  orderTemplateName?: string
  appointVehicleName?: string
  subOrderFlowState?: string
}

/** 探针区块标题的统一样式，避免三处重复 */
const sectionTitleStyle = { margin: '8px 0 0', fontSize: 14, fontWeight: 600 } as const

/* -------------------------------------------------------------------------- */
/* 样例一：分组成员表 —— 分组主表（服务端分页）展开出成员子表                        */
/* -------------------------------------------------------------------------- */

/** 分组主表列：成员数由 simpleAGVs 长度派生，帮助观察展开内容规模 */
const groupColumns: ApexColumnDef<ProbeGroupRow>[] = [
  { accessorKey: 'agvGroupName', header: '分组名称', size: 200 },
  { accessorKey: 'agvGroupKey', header: '分组标识', size: 260 },
  { accessorKey: 'createTime', header: '创建时间', size: 180 },
  { id: 'memberCount', accessorFn: (row) => row.simpleAGVs?.length ?? 0, header: '成员数', size: 90 },
]

/**
 * 成员子表：详情行内嵌套的独立表格实例。
 * - 行身份用成员 key（缺失时退 name），与父表身份空间互不重叠；
 * - 不分页、非虚拟：内容自然撑高，由外层详情行承载滚动（SPEC §7.3
 *   “经验证的分页范围内非虚拟模式”）；
 * - 开启排序用于父子交互验证：点子表表头不得误触父行展开/选择。
 */
function MemberSubtable({ record }: { record: ProbeGroupRow }) {
  const locale = useApexTableLocale()
  const columns: ApexColumnDef<ProbeSimpleAgv>[] = [
    { accessorKey: 'name', header: '成员名称', size: 200 },
    { accessorKey: 'key', header: '成员标识', size: 320 },
  ]
  return (
    <ApexTableReact
      columns={columns}
      data={record.simpleAGVs ?? []}
      getRowId={(row) => toRowId(row.key ?? row.name ?? '')}
      locale={locale}
      enableSorting
      virtualization={false}
    />
  )
}

/** 成员表演示区块：真实 pageVehicleGroups 只读查询 */
export function GroupMemberDemo() {
  const locale = useApexTableLocale()
  // 服务端分页取数：分组总量小（当前 2 条），页大小给到 50 档即可覆盖翻页路径
  const request = useMemo(
    () =>
      createLegacyTableRequest<ProbeGroupRow>(async ({ pageNo, pageSize, signal }) => {
        const raw = await legacyGet<LegacyRawPage<ProbeGroupRow>>(
          '/fms/v1/dispatcher/vehicleGroup/pageVehicleGroups',
          { pageNo, pageSize },
          { signal },
        )
        const page = convertLegacyPage(raw)
        return { items: page.items, total: page.total }
      }),
    [],
  )
  return (
    <section>
      <h4 style={sectionTitleStyle}>样例一 · 分组成员表（分组展开 → 成员子表）</h4>
      <ApexTableReact
        columns={groupColumns}
        request={request}
        getRowId={(row) => toRowId(row.agvGroupKey)}
        pagination={{ pageSizeOptions: [10, 20, 50] }}
        locale={locale}
        showRowNumber
        height={320}
        expandable={{
          // 无成员的分组不可展开（与源 P06 rowExpandable 口径一致）
          rowExpandable: (row) => (row.simpleAGVs?.length ?? 0) > 0,
          expandedRowRender: (row) => <MemberSubtable record={row} />,
        }}
      />
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* 样例二：任务多层展开 —— 模板 → 任务（独立分页）→ 动作 三级嵌套                   */
/* -------------------------------------------------------------------------- */

/** 模板主表列：任务数由 orderMissions 长度派生 */
const templateColumns: ApexColumnDef<ProbeTemplateRow>[] = [
  { accessorKey: 'orderTemplateName', header: '模板名称', size: 180 },
  { accessorKey: 'orderTemplateKey', header: '模板标识', size: 260 },
  { accessorKey: 'appointVehicleName', header: '指定车辆', size: 140 },
  { accessorKey: 'appointVehicleGroupName', header: '指定车型组', size: 140 },
  { id: 'missionCount', accessorFn: (row) => row.orderMissions?.length ?? 0, header: '任务数', size: 90 },
]

/** 任务级列（P20 MissionTable 同形：地图/站点） */
const missionColumns: ApexColumnDef<ProbeMission>[] = [
  { accessorKey: 'mapName', header: '地图名称', size: 160 },
  { accessorKey: 'mapId', header: '地图ID', size: 200 },
  { accessorKey: 'stationName', header: '站点名称', size: 160 },
  { accessorKey: 'stationId', header: '站点ID', size: 200 },
]

/** 动作级列：参数列渲染 key:value 明细，多参数自然撑高详情（动态行高观察点） */
const actionColumns: ApexColumnDef<ProbeAction>[] = [
  { accessorKey: 'actionType', header: '动作类型', size: 180 },
  { accessorKey: 'actionDescription', header: '动作描述', size: 240 },
  { accessorKey: 'blockingType', header: '阻塞类型', size: 110 },
  {
    id: 'actionParameters',
    accessorFn: (row) => (row.actionParameters ?? []).map((p) => `${p.key}:${String(p.value)}`).join('；'),
    header: '动作参数',
    size: 320,
  },
]

/**
 * 动作子表（第三级）：行身份用 `actionType#序号` 组合。
 * 真实数据里同一任务内 actionType 会重复（如 humanoidBend 连续两次）、
 * actionId 为空，裸 actionType 会触发库 duplicateRowId 诊断并拒绝渲染；
 * 源 P20 的 antd rowKey 同样用 actionType，重复时仅告警仍渲染——
 * 这是 ApexTable 更严格身份合同的消费差异，正式页面（T059）需按序号组合。
 */
function ActionSubtable({ mission }: { mission: ProbeMission }) {
  const locale = useApexTableLocale()
  return (
    <ApexTableReact
      columns={actionColumns}
      data={mission.actions ?? []}
      getRowId={(row, index) => toRowId(`${row.actionType ?? 'action'}#${index}`)}
      locale={locale}
      virtualization={false}
    />
  )
}

/**
 * 任务子表（第二级）：详情内独立客户端分页（默认 5/页），
 * 验证“各级行身份、分页相互独立”——子表翻页不扰动外层主表分页；
 * 行身份用任务 id；继续展开动作子表构成三级嵌套。
 */
function MissionSubtable({ record }: { record: ProbeTemplateRow }) {
  const locale = useApexTableLocale()
  return (
    <ApexTableReact
      columns={missionColumns}
      data={record.orderMissions ?? []}
      getRowId={(row) => toRowId(row.id ?? '')}
      locale={locale}
      enableSorting
      pagination={{ pageSizeOptions: [5, 10] }}
      virtualization={false}
      expandable={{
        rowExpandable: (row) => (row.actions?.length ?? 0) > 0,
        expandedRowRender: (row) => <ActionSubtable mission={row} />,
      }}
    />
  )
}

/** 多层展开演示区块：真实 pageOrderTemplates 只读查询（页大小含 200 档可整表拉取） */
export function TemplateNestingDemo() {
  const locale = useApexTableLocale()
  const request = useMemo(
    () =>
      createLegacyTableRequest<ProbeTemplateRow>(async ({ pageNo, pageSize, signal }) => {
        const raw = await legacyGet<LegacyRawPage<ProbeTemplateRow>>(
          '/fms/v1/dispatcher/orderTemplate/pageOrderTemplates',
          { pageNo, pageSize },
          { signal },
        )
        const page = convertLegacyPage(raw)
        return { items: page.items, total: page.total }
      }),
    [],
  )
  return (
    <section>
      <h4 style={sectionTitleStyle}>样例二 · 任务多层展开（模板 → 任务 → 动作 三级）</h4>
      <ApexTableReact
        columns={templateColumns}
        request={request}
        getRowId={(row) => toRowId(row.orderTemplateKey)}
        pagination={{ pageSizeOptions: [10, 20, 200] }}
        locale={locale}
        showRowNumber
        height={420}
        expandable={{
          rowExpandable: (row) => (row.orderMissions?.length ?? 0) > 0,
          expandedRowRender: (row) => <MissionSubtable record={row} />,
        }}
      />
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* 样例三：跨页展开规模 —— 79 行 × 4 页父表，展开状态跨页保留                       */
/* -------------------------------------------------------------------------- */

/** 实例主表列：触发方式/次数与 Cron 概览（P21 完整页面归 T063，不在此展开业务） */
const flowColumns: ApexColumnDef<ProbeFlowRow>[] = [
  { accessorKey: 'orderFlowName', header: '实例名称', size: 200 },
  { accessorKey: 'orderFlowKey', header: '实例标识', size: 260 },
  { accessorKey: 'triggerType', header: '触发类型', size: 110 },
  { accessorKey: 'triggerTimes', header: '触发次数', size: 100 },
  { accessorKey: 'cronExpression', header: 'Cron', size: 180 },
]

/** 子流程子表列：展示模板引用与状态 */
const subFlowColumns: ApexColumnDef<ProbeSubFlow>[] = [
  { accessorKey: 'orderTemplateName', header: '引用模板', size: 200 },
  { accessorKey: 'appointVehicleName', header: '指定车辆', size: 160 },
  { accessorKey: 'subOrderFlowState', header: '子流程状态', size: 140 },
  { accessorKey: 'subOrderFlowKey', header: '子流程标识', size: 280 },
]

/** 子流程子表：结构与样例一成员表同款（非虚拟、内容高、可排序） */
function SubFlowSubtable({ record }: { record: ProbeFlowRow }) {
  const locale = useApexTableLocale()
  return (
    <ApexTableReact
      columns={subFlowColumns}
      data={record.subOrderFlows ?? []}
      getRowId={(row) => toRowId(row.subOrderFlowKey ?? '')}
      locale={locale}
      enableSorting
      virtualization={false}
    />
  )
}

/**
 * 跨页展开规模演示：真实 pageOrderFlows 当前 79 条（pageSize 20 → 4 页），
 * 用于验证展开状态按行身份跨页保留、翻回后详情无错位（T022-V04）。
 */
export function FlowPaginationDemo() {
  const locale = useApexTableLocale()
  const request = useMemo(
    () =>
      createLegacyTableRequest<ProbeFlowRow>(async ({ pageNo, pageSize, signal }) => {
        const raw = await legacyGet<LegacyRawPage<ProbeFlowRow>>(
          '/fms/v1/dispatcher/orderFlow/pageOrderFlows',
          { pageNo, pageSize },
          { signal },
        )
        const page = convertLegacyPage(raw)
        return { items: page.items, total: page.total }
      }),
    [],
  )
  return (
    <section>
      <h4 style={sectionTitleStyle}>样例三 · 分页×展开规模（跨页展开状态保留）</h4>
      <ApexTableReact
        columns={flowColumns}
        request={request}
        getRowId={(row) => toRowId(row.orderFlowKey)}
        pagination={{ pageSizeOptions: [20, 50] }}
        locale={locale}
        showRowNumber
        showSelectionColumn
        height={420}
        expandable={{
          rowExpandable: (row) => (row.subOrderFlows?.length ?? 0) > 0,
          expandedRowRender: (row) => <SubFlowSubtable record={row} />,
        }}
      />
    </section>
  )
}

/** 展开表演示集合：探针页在 T021 车辆表演示之下追加本区块（外层为滚动容器，禁止收缩） */
export default function ExpansionProbe() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
      <GroupMemberDemo />
      <TemplateNestingDemo />
      <FlowPaginationDemo />
    </div>
  )
}
