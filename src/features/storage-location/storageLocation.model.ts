import data from './data/storage-locations.json'
import type { StorageLocationData, StorageLocationValues } from './storageLocation.types'

/** JSON 是初始数据的唯一来源；页面复制记录后编辑，刷新恢复预制数据。 */
export const storageLocationData: StorageLocationData = data

/** 新增草稿不预选站点和关联点，避免误保存到不相关的作业区域。 */
export const emptyLocation: Partial<StorageLocationValues> = {
  name: '', layer: 1, depth: 1200, height: 800, maxLoad: 500, remark: '',
}

/** 名称校验和提交共用规范化规则，忽略两端空白与英文字母大小写。 */
export const normalizeLocationName = (name: string) => name.trim().toLocaleLowerCase()

/** 目录、筛选及表格统一读取站点字典，不在库位记录中重复保存名称。 */
export const getStorageStation = (id: string) => storageLocationData.stations.find((station) => station.id === id)
