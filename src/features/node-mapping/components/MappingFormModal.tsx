/**
 * 新增/编辑节点映射弹窗（P07；迁移自旧 MappingModal，语义与
 * docs/SPEC_node_mapping.md §4 一致，基座升级见各节注释）。
 *
 * 结构：映射名称 + 关联AGV（Form）+ 地图组列表（本地 state，不用 Form.List）。
 * 单地图映射行可达数千至万行（行主要由「获取建议」批量生成，人工只做微调）：
 * - 组内行表格为前端分页（默认 10 条/页，可切 20/50/100），只有当前页行进 DOM；
 * - 行三态纯函数（features/node-mapping/types）：完整行正常；空白行视为占位、
 *   提交时自动剔除；半填行常显淡红高亮并拦截提交；
 * - 「获取建议」按节点 id 合并进当前组（不整组覆盖、不删已录入数据）；
 * - 定位手段：组内搜索 +「只看未填完整」+ 半填高亮 + 校验失败自动开过滤。
 *
 * 与旧实现的形态差异（等价迁移，交互语义不变）：
 * - 行表格基座按「业务表格统一 Apex」纪律改 ApexTableReact data 模式
 *   （真实草稿数据的编辑载体，非 mock）；行高亮改单元格级背景（Apex 无行级
 *   className）；分页器为 antd 受控 Pagination（组级过滤/跳最后页联动需要
 *   完全受控的分页状态，语义与旧版内建分页一致）；
 * - 草稿保留（A13/DoD 7）：关闭弹窗不清空输入；编辑目标出现时重填、清除时
 *   复位干净基线（P04/P06 同语义）；失败留稿；顶层「清空」为显式丢弃入口；
 * - 关联AGV 必填：当前后端 save/update 均拒绝空 agvKeys（业务码 2004030
 *   「AGV唯一key列表不能为空」，curl 复证），旧实现允许为空——按后端现行
 *   契约加 required 校验，差异已登记 gaps.md。
 * - 选项加载（地图/车辆）走 useStaticOptions 共享契约（打开时加载，
 *   失败清空选项并呈现状态文本，不冒充成功）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tooltip,
} from 'antd'
import { Plus, Trash2, MapPin, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApexTableReact } from 'apex-table-react'
import type { ApexColumnDef } from 'apex-table-react'
import { useApexLocale } from '@/hooks/useApexLocale'
import { useStaticOptions } from '@/hooks/useStaticOptions'
import { useTabDirtyGuard } from '@/hooks/useTabDirtyGuard'
import { stringFieldRowId } from '@/utils/table/rowId'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { fetchSimpleMaps } from '@/services/map/map.service'
import type { SimpleMapDto } from '@/services/map/map.service.types'
import { fetchSimpleVehicles } from '@/services/vehicle/vehicle.service'
import type { SimpleVehicleDto } from '@/services/vehicle/vehicle.service.types'
import { fetchMapGraph } from '@/services/map/map.service'
import {
  fetchCollectionNodeSuggestions,
  saveAgvNodeMapping,
  updateAgvNodeMapping,
} from '@/services/vehicle/node-mapping.service'
import type { AgvNodeMappingRecordDto, MappingNodeDto } from '@/services/vehicle/node-mapping.service.types'
import {
  DEFAULT_GROUP_VIEW,
  buildMapNodeMappings,
  isRowBlank,
  isRowComplete,
  isRowPartial,
} from '@/features/node-mapping/types'
import type {
  GroupViewState,
  MapGroupDraft,
  MappingRowDraft,
  NodeOption,
} from '@/features/node-mapping/types'
import { MapPickerModal } from '@/features/node-mapping/components/MapPickerModal'
import type { MapPickerTarget } from '@/features/node-mapping/components/MapPickerModal'
import styles from './MappingFormModal.module.css'

/** 表单值形状（地图组/映射行走本地 state，不进 Form） */
interface MappingFormValues {
  mappingName: string
  agvKeys?: string[]
}

interface MappingFormModalProps {
  open: boolean
  /** 编辑目标行；null = 新增模式 */
  editTarget: AgvNodeMappingRecordDto | null
  onClose: () => void
  /** 提交成功后回调（页面刷新列表；本组件已自行复位草稿） */
  onSucceeded: () => void
}

export function MappingFormModal({ open, editTarget, onClose, onSucceeded }: MappingFormModalProps) {
  const { t, t: tCommon } = useTranslation(['nodeMapping', 'common'], { nsMode: 'fallback' })
  const { message } = App.useApp()
  const [form] = Form.useForm<MappingFormValues>()
  const isEdit = editTarget !== null

  // 草稿脏标记：任何输入即登记到页签（关页/刷新统一确认、LRU 豁免）；编辑模式同样保护
  const [dirty, setDirty] = useState(false)
  useTabDirtyGuard(dirty, isEdit ? t('编辑节点映射') : t('新增节点映射'))

  /* -------------------------------- 选项加载（共享契约） -------------------------------- */

  // 地图/车辆选项：仅弹窗打开时加载（P04 GroupFormModal 同语义）；失败清空并呈现状态文本
  const simpleMaps = useStaticOptions<SimpleMapDto>((signal) => fetchSimpleMaps({ signal }), open)
  const simpleVehicles = useStaticOptions<SimpleVehicleDto>(
    (signal) => fetchSimpleVehicles({ signal }),
    open,
  )

  /** Select 空态三态呈现：加载中/失败状态文本/默认（具体用法见下方两处 notFoundContent） */

  /* --------------------------------- 草稿与视图状态 --------------------------------- */

  // 地图组草稿（组内是动态编辑表格，受控 state 比 Form.List 直观；旧实现同决策）
  const [groups, setGroups] = useState<MapGroupDraft[]>([])
  // 组内视图状态（搜索/只看未填完整/前端分页）：纯 UI 状态，按 groupKey 索引，不进提交数据
  const [groupViews, setGroupViews] = useState<Record<string, GroupViewState>>({})
  // 各地图节点选项缓存（mapId → MappingNode[]），避免重复拉取地图数据
  const [mapNodesMap, setMapNodesMap] = useState<Record<string, MappingNodeDto[]>>({})
  // 缓存的 ref 镜像：loadMapNodes 的去重判断需要同步读取，state 闭包可能过期
  const mapNodesRef = useRef<Record<string, MappingNodeDto[]>>({})
  // 「获取建议」按组加载态
  const [suggestionLoading, setSuggestionLoading] = useState<Record<string, boolean>>({})
  // 提交防重复
  const [submitting, setSubmitting] = useState(false)
  // 选点目标行：null 表示关闭；打开期间外层被遮罩阻隔，行数据不会变化
  const [pickerTarget, setPickerTarget] = useState<{ groupKey: string; rowKey: string } | null>(null)

  // 行/组标识自增序列：同一弹窗生命周期内 key 唯一（仅渲染标识，不进提交数据）
  const keySeq = useRef(0)
  const nextKey = (prefix: string) => `${prefix}_${keySeq.current++}`

  /** 干净基线：一个空地图组带一行占位（旧实现新增模式初始形态） */
  const makeBaselineGroups = useCallback((): MapGroupDraft[] => {
    return [{ groupKey: nextKey('g'), rows: [{ rowKey: nextKey('r') }] }]
  }, [])

  /** 复位干净基线：表单 + 组 + 视图状态 + 节点缓存；显式清空与提交成功共用 */
  const handleResetDraft = useCallback(() => {
    form.resetFields()
    setGroups(makeBaselineGroups())
    setGroupViews({})
    mapNodesRef.current = {}
    setMapNodesMap({})
    setDirty(false)
  }, [form, makeBaselineGroups])

  /* --------------------------------- 编辑目标切换语义 --------------------------------- */

  // 编辑目标出现时按行记录重填并预拉各地图节点；清除（转新增）时复位干净基线——
  // 编辑值对新增场景不再有效，绝不能残留误导提交。新增模式自身的草稿保留不受影响。
  useEffect(() => {
    if (editTarget) {
      form.setFieldsValue({
        mappingName: editTarget.mappingName ?? '',
        agvKeys: editTarget.agvKeys ?? [],
      })
      const initGroups: MapGroupDraft[] = (editTarget.mapNodeMapping ?? []).map((group) => ({
        groupKey: nextKey('g'),
        mapId: group.mapId,
        mapName: group.mapName,
        rows: (group.nodeMappings ?? []).map((row) => ({
          rowKey: nextKey('r'),
          mapNode: row.mapNode,
          mappingPoint: row.mappingPoint,
        })),
      }))
      setGroups(initGroups.length > 0 ? initGroups : makeBaselineGroups())
      setGroupViews({})
      // 预拉各地图节点，保证回填行的节点 Select 有选项
      initGroups.forEach((group) => {
        if (group.mapId) void loadMapNodes(group.mapId)
      })
    } else {
      handleResetDraft()
    }
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMapNodes 经 ref 消费，刻意不进依赖
  }, [editTarget, form, handleResetDraft, makeBaselineGroups])

  /* --------------------------------- 地图节点选项缓存 --------------------------------- */

  /**
   * 节点选项缓存：label 一次算好 + nodeId 同步建 Set 供 O(1) 存在性判定
   * （选点弹窗的失效标注也消费该 Set；替代逐行 some 的 O(行×节点) 比较）
   */
  const nodeOptionCache = useMemo(() => {
    const options: Record<string, NodeOption[]> = {}
    const idSets: Record<string, Set<string>> = {}
    for (const [mapId, nodes] of Object.entries(mapNodesMap)) {
      options[mapId] = nodes.map((node) => ({
        value: node.nodeId ?? '',
        label: `${node.nodeName ?? ''}（${node.nodeId ?? ''}）`,
        node,
      }))
      idSets[mapId] = new Set(nodes.map((node) => node.nodeId ?? ''))
    }
    return { options, idSets }
  }, [mapNodesMap])

  /**
   * 拉取指定地图的节点列表并转换为 MappingNode 缓存。
   * 结构来自 fetchMapGraph（getMapInfo → mapJson.nodes），按 mapId 去重；
   * 先占位防止并发重复请求，失败时删除占位以允许重试。
   */
  const loadMapNodes = async (mapId: string) => {
    if (!mapId || mapNodesRef.current[mapId]) return
    mapNodesRef.current[mapId] = []
    try {
      const graph = await fetchMapGraph(mapId)
      const mapped: MappingNodeDto[] = graph.nodes.map((node) => ({
        nodeId: node.id,
        nodeName: node.name,
        x: node.x,
        y: node.y,
      }))
      mapNodesRef.current[mapId] = mapped
      setMapNodesMap({ ...mapNodesRef.current })
    } catch (error) {
      delete mapNodesRef.current[mapId]
      if (!isCancelledError(error)) {
        message.error(t('获取地图节点失败') + apiErrorMessage(error))
      }
    }
  }

  /* ----------------------------------- 草稿操作 ----------------------------------- */

  // 有任何输入即视为脏（草稿保留与关页确认的依据）；以下所有草稿操作都会标记
  const markDirty = useCallback(() => setDirty(true), [])

  /** 更新指定组字段 */
  const patchGroup = (groupKey: string, patch: Partial<MapGroupDraft>) => {
    setGroups((prev) => prev.map((g) => (g.groupKey === groupKey ? { ...g, ...patch } : g)))
    markDirty()
  }

  /** 更新指定组视图状态（组尚无视图时以默认值打底） */
  const patchGroupView = (groupKey: string, patch: Partial<GroupViewState>) => {
    setGroupViews((prev) => {
      const current = prev[groupKey] ?? DEFAULT_GROUP_VIEW
      return { ...prev, [groupKey]: { ...current, ...patch } }
    })
  }

  /** 更新指定行字段 */
  const patchRow = (groupKey: string, rowKey: string, patch: Partial<MappingRowDraft>) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.groupKey === groupKey
          ? { ...g, rows: g.rows.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)) }
          : g,
      ),
    )
    markDirty()
  }

  /** 组内选择地图：记录 mapName 供提交使用并重置映射行与过滤（旧地图的行对新地图无意义） */
  const onGroupMapChange = (groupKey: string, mapId: string) => {
    const mapName = (simpleMaps.options ?? []).find((m) => m.mapId === mapId)?.mapName
    patchGroup(groupKey, { mapId, mapName, rows: [{ rowKey: nextKey('r') }] })
    patchGroupView(groupKey, { keyword: '', onlyInvalid: false, pageNo: 1 })
    void loadMapNodes(mapId)
  }

  /** 组的节点选项：已拉取节点 + 行内已选节点的并集（编辑回填的失效节点保显示，SPEC §4.3） */
  const getGroupOptions = (group: MapGroupDraft): NodeOption[] => {
    const base = nodeOptionCache.options[group.mapId ?? ''] ?? []
    const idSet = nodeOptionCache.idSets[group.mapId ?? '']
    const extras: NodeOption[] = []
    const seen = new Set<string>()
    for (const row of group.rows) {
      const node = row.mapNode
      if (node?.nodeId && !idSet?.has(node.nodeId) && !seen.has(node.nodeId)) {
        seen.add(node.nodeId)
        extras.push({
          value: node.nodeId,
          label: `${node.nodeName ?? ''}（${node.nodeId}）`,
          node,
        })
      }
    }
    return extras.length > 0 ? [...base, ...extras] : base
  }

  /** 组的行视图：一次 O(行数) 遍历同时产出过滤结果、原始行号、半填行计数（纯视图，不改 rows） */
  const getGroupRowView = (group: MapGroupDraft) => {
    const view = groupViews[group.groupKey]
    const keyword = view?.keyword?.trim().toLowerCase() ?? ''
    const onlyInvalid = view?.onlyInvalid ?? false
    const filteredRows: MappingRowDraft[] = []
    const indexMap = new Map<string, number>()
    let invalidCount = 0
    group.rows.forEach((row, index) => {
      indexMap.set(row.rowKey, index)
      if (isRowPartial(row)) invalidCount += 1
      // 「只看未填完整」显示所有非完整行（半填 + 空白占位），完整行才跳过
      if (onlyInvalid && isRowComplete(row)) return
      if (keyword) {
        const name = row.mapNode?.nodeName?.toLowerCase() ?? ''
        const id = row.mapNode?.nodeId?.toLowerCase() ?? ''
        if (!name.includes(keyword) && !id.includes(keyword)) return
      }
      filteredRows.push(row)
    })
    return { filteredRows, indexMap, invalidCount, hasFilter: !!keyword || onlyInvalid }
  }

  /** 行内选节点（下拉或选点弹窗共用）：mapNode 整体回填；映射点仅未手填时跟随（SPEC §4.3） */
  const onRowNodeChange = (groupKey: string, rowKey: string, previous: MappingRowDraft, node?: MappingNodeDto) => {
    patchRow(groupKey, rowKey, {
      mapNode: node ? { ...node } : undefined,
      mappingPoint: {
        x: typeof previous.mappingPoint?.x === 'number' ? previous.mappingPoint.x : node?.x,
        y: typeof previous.mappingPoint?.y === 'number' ? previous.mappingPoint.y : node?.y,
      },
    })
  }

  /** 添加映射行：清空本组过滤（否则新空行可能不匹配过滤条件而不可见）并跳到最后页 */
  const handleAddRow = (group: MapGroupDraft) => {
    const pageSize = groupViews[group.groupKey]?.pageSize ?? DEFAULT_GROUP_VIEW.pageSize
    patchGroup(group.groupKey, { rows: [...group.rows, { rowKey: nextKey('r') }] })
    patchGroupView(group.groupKey, {
      keyword: '',
      onlyInvalid: false,
      pageNo: Math.ceil((group.rows.length + 1) / pageSize),
    })
  }

  /**
   * 获取采集点位建议：控制点按节点 id 合并进当前组，不整组覆盖（避免误清已录入行）。
   * 合并前剔除完全空白的占位行；成功后清空过滤并跳最后页让新行可见；无需确认（不删数据）。
   */
  const handleSuggestion = async (group: MapGroupDraft) => {
    if (!group.mapId) {
      message.warning(t('请先选择地图'))
      return
    }
    setSuggestionLoading((prev) => ({ ...prev, [group.groupKey]: true }))
    try {
      const suggestion = await fetchCollectionNodeSuggestions({
        mapId: group.mapId,
        ...(group.expectedCount ? { expectedCount: group.expectedCount } : {}),
      })
      const points = suggestion.controlPoints ?? []
      // 合并前先剔除完全未填写的占位空行，否则初始空行残留并卡在提交校验
      const rows = group.rows.filter((row) => !isRowBlank(row))
      points.forEach((point) => {
        // mapNode 从控制点整体回填；节点尚未加载也不影响显示（getGroupOptions 会合并行内节点）
        const suggested = {
          mapNode: {
            nodeId: point.id,
            nodeName: point.name,
            x: point.point?.x,
            y: point.point?.y,
          },
          mappingPoint: { x: point.point?.x, y: point.point?.y },
        }
        // 无 id 的控制点不参与匹配，直接按新行追加
        const index = point.id ? rows.findIndex((row) => row.mapNode?.nodeId === point.id) : -1
        if (index >= 0) {
          rows[index] = { ...rows[index], ...suggested }
        } else {
          rows.push({ rowKey: nextKey('r'), ...suggested })
        }
      })
      patchGroup(group.groupKey, { rows })
      const pageSize = groupViews[group.groupKey]?.pageSize ?? DEFAULT_GROUP_VIEW.pageSize
      patchGroupView(group.groupKey, {
        keyword: '',
        onlyInvalid: false,
        pageNo: Math.max(1, Math.ceil(rows.length / pageSize)),
      })
      message.success(t('获取建议成功'))
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error(t('获取建议失败') + apiErrorMessage(error))
      }
    } finally {
      setSuggestionLoading((prev) => ({ ...prev, [group.groupKey]: false }))
    }
  }

  /* --------------------------------- 提交校验与提交 --------------------------------- */

  /**
   * 提交前校验地图组，返回错误文案（null = 通过）。
   * 存在半填行时给问题组自动开「只看未填完整」过滤并回第一页（万行下的定位手段）。
   */
  const validateGroups = (): string | null => {
    if (groups.length === 0) return t('请至少添加一个地图组')
    for (const group of groups) {
      if (!group.mapId) return t('每个地图组都需要选择地图')
      if (!group.rows.some((row) => !isRowBlank(row))) return t('每个地图组至少需要一行映射')
    }
    const invalidGroupKeys = groups.filter((g) => g.rows.some(isRowPartial)).map((g) => g.groupKey)
    if (invalidGroupKeys.length > 0) {
      setGroupViews((prev) => {
        const next = { ...prev }
        invalidGroupKeys.forEach((key) => {
          next[key] = { ...DEFAULT_GROUP_VIEW, onlyInvalid: true }
        })
        return next
      })
      return t('存在未填写完整的映射行，已为你过滤显示')
    }
    return null
  }

  const handleOk = async () => {
    let values: MappingFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const groupError = validateGroups()
    if (groupError) {
      message.warning(groupError)
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      if (isEdit && editTarget?.mappingKey) {
        // 编辑：mappingKey + 全量分组结构，整体替换语义（旧 SPEC §2.1）
        await updateAgvNodeMapping({
          mappingKey: editTarget.mappingKey,
          mappingName: values.mappingName.trim(),
          nodeMappings: buildMapNodeMappings(groups),
          agvKeys: values.agvKeys ?? [],
        })
        message.success(t('编辑节点映射成功'))
      } else {
        await saveAgvNodeMapping({
          mappingName: values.mappingName.trim(),
          nodeMappings: buildMapNodeMappings(groups),
          agvKeys: values.agvKeys ?? [],
        })
        message.success(t('新增节点映射成功'))
      }
      // 成功才清空草稿并复位；失败路径保留全部输入（写操作不自动重试）
      handleResetDraft()
      onSucceeded()
    } catch (error) {
      if (!isCancelledError(error)) {
        message.error((isEdit ? t('编辑节点映射失败') : t('新增节点映射失败')) + apiErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* --------------------------------- 渲染辅助（选点目标解析） --------------------------------- */

  const pickerGroup = pickerTarget ? groups.find((g) => g.groupKey === pickerTarget.groupKey) : undefined
  const pickerRow = pickerGroup?.rows.find((r) => r.rowKey === pickerTarget?.rowKey)
  const pickerTargetData: MapPickerTarget | null =
    pickerGroup && pickerRow ? { group: pickerGroup, row: pickerRow } : null

  /** 顶层清空：一次性丢弃全部草稿（表单+组+视图），误触代价高，二次确认 */
  const handleClearAll = () => {
    handleResetDraft()
    message.success(t('已清空草稿'))
  }

  /* ------------------------------------- 渲染 ------------------------------------- */

  return (
    <>
      <Modal
        title={isEdit ? t('编辑节点映射') : t('新增节点映射')}
        open={open}
        onOk={handleOk}
        onCancel={onClose}
        okText={t('确定')}
        cancelText={t('取消')}
        width={1200}
        confirmLoading={submitting}
        // 草稿弹窗：关闭不销毁内容（新增草稿保留在页签内存）
        destroyOnHidden={false}
        footer={[
          <Popconfirm
            key="reset"
            title={t('清空草稿')}
            description={t('确定清空全部草稿（含映射名称、关联AGV与全部地图组）？')}
            onConfirm={handleClearAll}
            okText={t('确定')}
            cancelText={t('取消')}
          >
            <Button disabled={submitting}>{t('清空')}</Button>
          </Popconfirm>,
          <Button key="cancel" onClick={onClose} disabled={submitting}>
            {t('取消')}
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleOk}>
            {t('确定')}
          </Button>,
        ]}
      >
        {/* body 限高内部滚动：多地图组/万行组时不撑破屏幕（旧实现同手法） */}
        {/* 标签横排居左。用旧实现同款 3/21(而非通用 6/18):「节点映射」组内
            行表格列宽 60+600+180+180+60=1080 是等价迁移的固定布局,6/18 的
            wrapper(约 854px)会让表格必然横向滚动,3/21(约 1008px)与旧版一致 */}
        <div className={styles.modalBody}>
          <Form
            form={form}
            layout="horizontal"
            labelCol={{ span: 3 }}
            wrapperCol={{ span: 21 }}
            autoComplete="off"
            onValuesChange={markDirty}
          >
            <Form.Item
              label={t('映射名称')}
              name="mappingName"
              rules={[{ required: true, message: t('请输入映射名称') }]}
            >
              {/* 名称上限 64 字符（旧实现同边界），showCount 同旧形态 */}
              <Input maxLength={64} showCount placeholder={t('请输入映射名称')} />
            </Form.Item>

            <Form.Item
              label={t('关联AGV')}
              name="agvKeys"
              rules={[{ required: true, message: t('请选择关联AGV') }]}
            >
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                // 选项加载失败呈现状态文本（无重试按钮，按钮纪律）；加载中转圈
                notFoundContent={
                  simpleVehicles.loading ? (
                    <Spin size="small" />
                  ) : simpleVehicles.error ? (
                    <span className={styles.optionError}>{tCommon('加载失败')}</span>
                  ) : undefined
                }
                placeholder={t('请选择关联AGV')}
                options={(simpleVehicles.options ?? []).map((vehicle) => ({
                  value: vehicle.key ?? '',
                  label: vehicle.name ?? vehicle.key ?? '',
                }))}
              />
            </Form.Item>

            <Form.Item label={t('节点映射')} required colon>
              {/* 地图组列表：组头工具/组内行表格/组尾添加行 */}
              <div className={styles.groupsWrap}>
                {groups.map((group) => {
                  const nodeOptions = getGroupOptions(group)
                  const rowView = getGroupRowView(group)
                  const view = groupViews[group.groupKey]
                  // 页码钳制：删除行/过滤收缩后 maxPage 变小，渲染侧派生 min 值，不停留在空页
                  const pageSize = view?.pageSize ?? DEFAULT_GROUP_VIEW.pageSize
                  const maxPage = Math.max(1, Math.ceil(rowView.filteredRows.length / pageSize))
                  const currentPage = Math.min(view?.pageNo ?? 1, maxPage)
                  const pageRows = rowView.filteredRows.slice(
                    (currentPage - 1) * pageSize,
                    currentPage * pageSize,
                  )
                  return (
                    <Card
                      key={group.groupKey}
                      size="small"
                      className={styles.groupCard}
                      title={
                        <Select
                          placeholder={t('请选择地图')}
                          style={{ width: 240 }}
                          value={group.mapId}
                          // 选项加载失败呈现状态文本（按钮纪律：无重试按钮）
                          notFoundContent={
                            simpleMaps.loading ? (
                              <Spin size="small" />
                            ) : simpleMaps.error ? (
                              <span className={styles.optionError}>{tCommon('加载失败')}</span>
                            ) : undefined
                          }
                          options={(simpleMaps.options ?? []).map((m) => ({
                            value: m.mapId ?? '',
                            label: m.mapName ?? m.mapId ?? '',
                          }))}
                          onChange={(mapId) => onGroupMapChange(group.groupKey, mapId)}
                        />
                      }
                      extra={
                        <div className={styles.groupToolbar}>
                          {/* 行定位工具与组操作同放一行，省一条工具栏的纵向空间 */}
                          <Input
                            allowClear
                            prefix={<Search size={13} />}
                            placeholder={t('搜索节点名称/ID')}
                            className={styles.searchInput}
                            value={view?.keyword ?? ''}
                            // 过滤条件变化时回第一页，避免带着大页码过滤后落空
                            onChange={(e) =>
                              patchGroupView(group.groupKey, { keyword: e.target.value, pageNo: 1 })
                            }
                          />
                          <Checkbox
                            checked={view?.onlyInvalid ?? false}
                            onChange={(e) =>
                              patchGroupView(group.groupKey, { onlyInvalid: e.target.checked, pageNo: 1 })
                            }
                          >
                            {t('只看未填完整')}
                          </Checkbox>
                          <InputNumber
                            placeholder={t('期望点位数量')}
                            min={1}
                            style={{ width: 120 }}
                            value={group.expectedCount}
                            onChange={(value) => {
                              patchGroup(group.groupKey, { expectedCount: value ?? undefined })
                            }}
                          />
                          <Button
                            loading={!!suggestionLoading[group.groupKey]}
                            onClick={() => void handleSuggestion(group)}
                          >
                            {t('获取建议')}
                          </Button>
                          <Popconfirm
                            title={t('清空映射行')}
                            description={t('确定清空该地图组的全部映射行？')}
                            onConfirm={() => patchGroup(group.groupKey, { rows: [] })}
                            okText={t('确定')}
                            cancelText={t('取消')}
                          >
                            <Button danger disabled={group.rows.length === 0}>
                              {t('清空')}
                            </Button>
                          </Popconfirm>
                          {/* 删除地图组：未提交草稿的组级操作（旧实现无确认，语义不变） */}
                          <Tooltip title={t('删除地图组')}>
                            <Button
                              danger
                              icon={<Trash2 size={14} />}
                              onClick={() => {
                                setGroups((prev) => prev.filter((g) => g.groupKey !== group.groupKey))
                                markDirty()
                              }}
                            />
                          </Tooltip>
                        </div>
                      }
                    >
                      {/* 行数统计行：搜索/过滤已上移组头，这里只保留统计文本 */}
                      <div className={styles.rowStats}>
                        {rowView.hasFilter
                          ? t('显示 {{shown}} / {{total}} 行', {
                              shown: rowView.filteredRows.length,
                              total: group.rows.length,
                            })
                          : t('共 {{total}} 行', { total: group.rows.length })}
                        {rowView.invalidCount > 0 ? (
                          <span className={styles.invalidCount}>
                            {t('未填完整 {{count}} 行', { count: rowView.invalidCount })}
                          </span>
                        ) : null}
                      </div>
                      {/* 映射行表格：Apex data 模式（真实草稿数据），只渲染当前页切片 */}
                      <MappingRowsTable
                        rows={pageRows}
                        nodeOptions={nodeOptions}
                        indexMap={rowView.indexMap}
                        mapIdMissing={!group.mapId}
                        onPickNode={(rowKey, previous, node) =>
                          onRowNodeChange(group.groupKey, rowKey, previous, node)
                        }
                        onPatchRow={(rowKey, patch) => patchRow(group.groupKey, rowKey, patch)}
                        onDeleteRow={(rowKey) => {
                          patchGroup(group.groupKey, {
                            rows: group.rows.filter((r) => r.rowKey !== rowKey),
                          })
                        }}
                        onOpenPicker={(rowKey) => setPickerTarget({ groupKey: group.groupKey, rowKey })}
                      />
                      {/* 前端分页器：受控（组级过滤/跳最后页联动需要完全受控的分页状态） */}
                      <div className={styles.pagerRow}>
                        <Pagination
                          size="small"
                          current={currentPage}
                          pageSize={pageSize}
                          total={rowView.filteredRows.length}
                          showSizeChanger
                          pageSizeOptions={[10, 20, 50, 100]}
                          onChange={(page, nextSize) => {
                            patchGroupView(
                              group.groupKey,
                              nextSize !== pageSize
                                ? // 改每页条数时回第一页，避免带着大页码换页容量后落空
                                  { pageNo: 1, pageSize: nextSize }
                                : { pageNo: page },
                            )
                          }}
                        />
                      </div>
                      <Button
                        type="dashed"
                        block
                        icon={<Plus size={14} />}
                        className={styles.addRow}
                        onClick={() => handleAddRow(group)}
                      >
                        {t('添加映射行')}
                      </Button>
                    </Card>
                  )
                })}
                <Button
                  type="dashed"
                  block
                  icon={<Plus size={14} />}
                  onClick={() => {
                    setGroups((prev) => [
                      ...prev,
                      { groupKey: nextKey('g'), rows: [{ rowKey: nextKey('r') }] },
                    ])
                    markDirty()
                  }}
                >
                  {t('添加地图')}
                </Button>
              </div>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* 地图选点二级弹窗：确定回填复用 onRowNodeChange 语义（映射点仅未手填时跟随） */}
      <MapPickerModal
        target={pickerTargetData}
        nodeIdSet={pickerGroup?.mapId ? nodeOptionCache.idSets[pickerGroup.mapId] : undefined}
        onOk={(node) => {
          if (pickerGroup && pickerRow) {
            onRowNodeChange(pickerGroup.groupKey, pickerRow.rowKey, pickerRow, node)
          }
          setPickerTarget(null)
        }}
        onClose={() => setPickerTarget(null)}
      />
    </>
  )
}

/* --------------------------------- 映射行表格（组内） --------------------------------- */

interface MappingRowsTableProps {
  rows: MappingRowDraft[]
  nodeOptions: NodeOption[]
  indexMap: Map<string, number>
  /** 组未选地图：选点按钮禁用（选点依赖地图节点数据） */
  mapIdMissing: boolean
  onPickNode: (rowKey: string, previous: MappingRowDraft, node?: MappingNodeDto) => void
  onPatchRow: (rowKey: string, patch: Partial<MappingRowDraft>) => void
  onDeleteRow: (rowKey: string) => void
  onOpenPicker: (rowKey: string) => void
}

/**
 * 组内映射行表格。列结构与旧版逐列核对：#(60，原始行号) / 地图节点(600，
 * 下拉+选点按钮) / 映射点X(180) / 映射点Y(180) / 删除(60)；列全部固定宽、
 * 总和 ≈ 内容区宽，横向不出滚动条。半填行以单元格级淡红背景常显高亮
 * （Apex 无行级 className，逐 cell 包装达成同视觉）。排序不开放（G09：旧版无排序）。
 */
function MappingRowsTable({
  rows,
  nodeOptions,
  indexMap,
  mapIdMissing,
  onPickNode,
  onPatchRow,
  onDeleteRow,
  onOpenPicker,
}: MappingRowsTableProps) {
  const { t } = useTranslation('nodeMapping')
  const apexLocale = useApexLocale()

  /** 半填行单元格包装：淡红背景常显（整行所有 cell 同背景 = 旧版行高亮视觉） */
  const cellWrap = (row: MappingRowDraft, content: React.ReactNode) =>
    isRowPartial(row) ? <div className={styles.partialCell}>{content}</div> : content

  const columns = useMemo<ApexColumnDef<MappingRowDraft>[]>(
    () => [
      {
        id: 'rowNo',
        header: '#',
        enableSorting: false,
        size: 60,
        // 显示完整 rows 中的原始行号，过滤/翻页后仍可对照定位
        cell: ({ row }) => cellWrap(row.original, String((indexMap.get(row.original.rowKey) ?? 0) + 1)),
      },
      {
        id: 'mapNode',
        header: t('地图节点'),
        enableSorting: false,
        size: 600,
        cell: ({ row }) =>
          cellWrap(
            row.original,
            <Space.Compact style={{ width: '100%' }}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('请选择地图节点')}
                style={{ flex: 1 }}
                value={row.original.mapNode?.nodeId}
                options={nodeOptions}
                onChange={(_, option) =>
                  onPickNode(row.original.rowKey, row.original, (option as NodeOption)?.node)
                }
              />
              {/* 组未选地图时禁用选点（选点依赖地图节点数据），Tooltip 说明原因 */}
              <Tooltip title={mapIdMissing ? t('请先选择地图') : undefined}>
                <Button
                  icon={<MapPin size={14} />}
                  disabled={mapIdMissing}
                  onClick={() => onOpenPicker(row.original.rowKey)}
                />
              </Tooltip>
            </Space.Compact>,
          ),
      },
      {
        id: 'pointX',
        header: t('映射点X'),
        enableSorting: false,
        size: 180,
        cell: ({ row }) =>
          cellWrap(
            row.original,
            <InputNumber
              style={{ width: '100%' }}
              value={row.original.mappingPoint?.x ?? undefined}
              onChange={(value) =>
                onPatchRow(row.original.rowKey, {
                  mappingPoint: { ...row.original.mappingPoint, x: value ?? undefined },
                })
              }
            />,
          ),
      },
      {
        id: 'pointY',
        header: t('映射点Y'),
        enableSorting: false,
        size: 180,
        cell: ({ row }) =>
          cellWrap(
            row.original,
            <InputNumber
              style={{ width: '100%' }}
              value={row.original.mappingPoint?.y ?? undefined}
              onChange={(value) =>
                onPatchRow(row.original.rowKey, {
                  mappingPoint: { ...row.original.mappingPoint, y: value ?? undefined },
                })
              }
            />,
          ),
      },
      {
        id: 'actions',
        header: t('操作'),
        enableSorting: false,
        size: 60,
        cell: ({ row }) =>
          cellWrap(
            row.original,
            <Button
              type="text"
              danger
              size="small"
              icon={<Trash2 size={13} />}
              onClick={() => onDeleteRow(row.original.rowKey)}
            />,
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cellWrap 为纯函数包装，随行数据每次渲染取最新
    [t, nodeOptions, indexMap, mapIdMissing, onPickNode, onPatchRow, onDeleteRow, onOpenPicker],
  )

  return (
    <ApexTableReact
      columns={columns}
      data={rows}
      getRowId={stringFieldRowId('rowKey')}
      locale={apexLocale}
      density="compact"
      pagination={false}
      // 当前页仅 ≤100 行；虚拟化会卸载滚动外行、丢编辑控件焦点，行编辑表格关闭
      virtualization={false}
      height={340}
      columnSettingsEnabled={false}
    />
  )
}
