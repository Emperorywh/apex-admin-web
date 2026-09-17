/**
 * ApexTable 列偏好官方适配器接入约定（T00.5 表格公共设施，DoD 5「列偏好隔离可重置」）。
 *
 * 本文件只是官方适配器（apex-table-react/adapters/local-column-preferences）
 * 的参数约定与实例工厂——返回的就是官方适配器实例，不改其行为，不属于表格二次封装。
 *
 * 隔离维度（DoD 5）：存储 key 由 namespace/userId/tenantId/tableId 四段组成，
 * 官方再叠加 schemaVersion 做结构版本迁移，天然满足「按用户/表格/版本隔离」：
 * - namespace 固定 'apex-admin'：本应用标识；
 * - tenantId 固定 'default'：调度后端无多租户概念，占位满足官方必填校验；
 * - userId：登录用户唯一标识（username），由 useColumnPreferences 从会话注入；
 * - tableId：页面任务自行命名，全项目唯一，建议「页面:表格」形式
 *   （如 'order-record:main'、'order-record:draft'）；
 * - schemaVersion：默认 '1'；页面列结构变更（增删列/改 id）时必须提升版本号，
 *   否则旧偏好会套在新列结构上（官方 load 只过滤未知列 id，不会重排既有顺序）。
 *
 * 页面接线四步（约定，页面任务照此组装到 ApexTableReact，不另造存储）：
 *  1. 创建：useColumnPreferences(tableId) 返回官方适配器实例（随会话/卸载自动管理）；
 *  2. 读取：适配器就绪后（实例的 load 需要运行时列实例），
 *     prefs.load({ columns: tableRef.current.getAllLeafColumns(), initialState })
 *     返回四切片，作为受控 state 初值——因此列偏好晚一帧应用属预期行为；
 *  3. 保存：onColumnOrderChange / onColumnVisibilityChange / onColumnSizingChange /
 *     onColumnPinningChange 中 setState 后调 prefs.save(四切片集合)，
 *     官方自带 300ms 防抖写 localStorage；
 *  4. 重置：提供「恢复默认」入口时调 prefs.clear() 清存储，再把 state 回到页面默认。
 */

import { createLocalColumnPreferences } from 'apex-table-react/adapters/local-column-preferences'

/** 官方适配器实例类型（原样透出，页面按官方 API 使用） */
export type TableColumnPreferences = ReturnType<typeof createLocalColumnPreferences>

/** 本项目统一的应用命名空间（存储 key 第一段） */
const COLUMN_PREFERENCES_NAMESPACE = 'apex-admin'

/** 单实例部署的租户占位（后端无租户概念，仅满足官方必填校验） */
const COLUMN_PREFERENCES_TENANT_ID = 'default'

/** 列结构版本基线；页面列结构变更时通过参数提升 */
const DEFAULT_SCHEMA_VERSION = '1'

export interface TableColumnPreferencesIdentity {
  /** 页面内表格唯一标识，建议「页面:表格」形式（如 'order-record:main'） */
  tableId: string
  /** 登录用户唯一标识（username），列偏好按用户隔离 */
  userId: string
  /** 列结构版本，列定义变更时必须提升，默认 '1' */
  schemaVersion?: string
}

/** 按统一约定创建官方列偏好适配器实例（不改变官方行为与形状） */
export function createTableColumnPreferences(identity: TableColumnPreferencesIdentity): TableColumnPreferences {
  const tableId = identity.tableId.trim()
  const userId = identity.userId.trim()

  // 官方对空身份会抛英文错误；这里提前用中文语义拦截，报错定位到具体 tableId
  if (!tableId || !userId) {
    throw new Error(
      `[列偏好] tableId 与 userId 均不能为空（tableId="${identity.tableId}"），` +
        '未登录或未命名表格时不应创建列偏好适配器',
    )
  }

  return createLocalColumnPreferences({
    namespace: COLUMN_PREFERENCES_NAMESPACE,
    userId,
    tenantId: COLUMN_PREFERENCES_TENANT_ID,
    tableId,
    schemaVersion: identity.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
  })
}
