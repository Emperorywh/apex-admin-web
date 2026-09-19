/**
 * 避障模板预置数据（P22 整页重写；等价迁移旧 ObstacleAvoidanceTemplateData.ts）。
 *
 * 纯前端预置数据源（非接口下发）：14 个模板项，每项 avoidList 64 个选项。
 * - 选项 value 规则：`${key}_index_${i}`（i 从 0 开始）；该 value 会作为避障参数
 *   类型（avoid 协议值）整体提交并由后端存储，规则变更会破坏历史数据回显，不得改动；
 * - 选项 label 规则：i=0 为「默认」，其余为 `自定义${i}`（数字拼死在简中文案里，
 *   与旧实现一致）；国际化在消费侧从 value 反解 index 后经 t('默认') /
 *   t('自定义{index}') 翻译（直接 t(item.label) 会因数字已拼死而查不到 key）；
 * - name 为简中 i18n key，展示侧经 t() 翻译（四语言既有真译沿用）。
 */

/** 避障参数类型选项（value 为协议提交值；label 为待翻译简中文案） */
export interface AvoidItem {
  value: string
  label: string
}

/** 避障模板项元信息（name 为 i18n key；key 为 avoid value 前缀） */
export interface ObstacleTemplateItem {
  name: string
  key: string
  avoidList: AvoidItem[]
}

/** 生成 avoidList：共 count 项，index 0 为「默认」，其余为「自定义N」（旧实现同规则） */
export function generateAvoidList(key: string, count: number = 7): AvoidItem[] {
  if (!Number.isFinite(count) || count <= 0) {
    return []
  }
  const total = Math.floor(count)
  return Array.from({ length: total }, (_, i) => ({
    value: `${key}_index_${i}`,
    label: i === 0 ? '默认' : `自定义${i}`,
  }))
}

/** 模板项元信息（名称 i18n key + key 前缀；与旧 TEMPLATE_META 逐项一致） */
const TEMPLATE_META: Array<Pick<ObstacleTemplateItem, 'name' | 'key'>> = [
  { name: '前方导航激光', key: 'forward_nav' },
  { name: '后方导航激光', key: 'back_nav' },
  { name: '前方避障激光', key: 'forward_obs_laser' },
  { name: '后方避障激光', key: 'back_obs_laser' },
  { name: '左侧避障激光', key: 'left_obs_laser' },
  { name: '左中避障激光', key: 'left_middle_obs_laser' },
  { name: '右侧避障激光', key: 'right_obs_laser' },
  { name: '右中避障激光', key: 'right_middle_obs_laser' },
  { name: '前方避障相机', key: 'forward_obs_camera' },
  { name: '后方避障相机', key: 'back_obs_camera' },
  { name: '左侧避障相机', key: 'left_obs_camera' },
  { name: '右侧避障相机', key: 'right_obs_camera' },
  { name: '后右方叉尖避障', key: 'right_back_fork_tines_obs' },
  { name: '后左方叉尖避障', key: 'left_back_fork_tines_obs' },
]

/** 按指定数量生成完整避障模板数据（count 为每项 avoidList 长度） */
export function generateObstacleAvoidanceTemplateData(
  count: number = 64,
): ObstacleTemplateItem[] {
  return TEMPLATE_META.map(({ name, key }) => ({
    name,
    key,
    avoidList: generateAvoidList(key, count),
  }))
}

/** 避障模板数据源：每项 64 个选项（与旧实现同默认值） */
export const ObstacleAvoidanceTemplateData: ObstacleTemplateItem[] =
  generateObstacleAvoidanceTemplateData(64)
