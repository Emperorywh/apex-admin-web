/**
 * 节点映射编辑草稿模型与行三态纯函数（P07，迁移自旧 MappingModal，
 * 语义与 docs/SPEC_node_mapping.md §4 一致）。
 *
 * 草稿形态：弹窗内「地图组 → 映射行」两级本地 state（不用 Form.List——
 * 组内是动态编辑表格，受控 state 更直观，旧实现同决策）。
 * rowKey/groupKey 仅是前端渲染标识（自增序列），绝不进入提交数据。
 */

import type {
  MapNodeMappingDto,
  MappingNodeDto,
  MappingPointDto,
} from '@/services/vehicle/node-mapping.service.types'

/** 映射行草稿：选中节点后整体回填（nodeId/nodeName/x/y），映射点可手改 */
export interface MappingRowDraft {
  rowKey: string
  mapNode?: MappingNodeDto
  mappingPoint?: MappingPointDto
}

/** 地图组草稿：一组同地图下的映射行；expectedCount 仅用于「获取建议」参数 */
export interface MapGroupDraft {
  groupKey: string
  mapId?: string
  /** 提交接口需要地图名称，选地图时一并记录 */
  mapName?: string
  expectedCount?: number
  rows: MappingRowDraft[]
}

/** 组内视图状态（搜索关键字/只看未填完整/前端分页）：纯 UI 状态，不进提交数据 */
export interface GroupViewState {
  keyword: string
  onlyInvalid: boolean
  pageNo: number
  pageSize: number
}

/** 组视图默认值：组首次操作过滤/分页时以此打底 */
export const DEFAULT_GROUP_VIEW: GroupViewState = {
  keyword: '',
  onlyInvalid: false,
  pageNo: 1,
  pageSize: 10,
}

/** 节点下拉选项：附带原始节点对象（含坐标），选中时免二次查找直接整体回填 */
export interface NodeOption {
  value: string
  label: string
  node: MappingNodeDto
}

/** 行是否完全空白（未选节点且坐标均未填）：占位行，提交时自动剔除，不高亮不报错 */
export function isRowBlank(row: MappingRowDraft): boolean {
  return (
    !row.mapNode?.nodeId &&
    typeof row.mappingPoint?.x !== 'number' &&
    typeof row.mappingPoint?.y !== 'number'
  )
}

/** 行是否填写完整：已选节点且映射点 x/y 均为数字 */
export function isRowComplete(row: MappingRowDraft): boolean {
  return (
    !!row.mapNode?.nodeId &&
    typeof row.mappingPoint?.x === 'number' &&
    typeof row.mappingPoint?.y === 'number'
  )
}

/** 半填行（非空白但不完整）：常显淡红高亮，提交校验拦截 */
export function isRowPartial(row: MappingRowDraft): boolean {
  return !isRowBlank(row) && !isRowComplete(row)
}

/**
 * 草稿 → 提交结构（按地图分组；剔除完全空白的占位行）。
 * 空白行剔除是旧实现既定语义：占位空行不参与校验也不提交。
 */
export function buildMapNodeMappings(groups: MapGroupDraft[]): MapNodeMappingDto[] {
  return groups.map((group) => ({
    mapId: group.mapId,
    mapName: group.mapName,
    nodeMappings: group.rows
      .filter((row) => !isRowBlank(row))
      .map((row) => ({
        mapNode: row.mapNode,
        mappingPoint: row.mappingPoint,
      })),
  }))
}
