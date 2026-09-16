/**
 * 避障模板数据
 */

export interface AvoidItem {
    value: string;
    label: string;
}

export interface ObstacleTemplateItem {
    name: string;
    key: string;
    avoidList: AvoidItem[];
}

/**
 * 生成 avoidList
 * 规则：
 *   - 共 count 项，index 从 0 开始
 *   - value 格式：`${key}_index_${i}`
 *   - label：index 为 0 时为 "默认"，其余为 `自定义${i}`
 *
 * @param key   模板项的 key（如 "forward_nav"）
 * @param count 要生成的选项总数（包含"默认"项），默认 7
 * @returns AvoidItem[]
 *
 * @example
 *   generateAvoidList('forward_nav', 64)
 *   // => [{ value: 'forward_nav_index_0', label: '默认' }, ..., { value: 'forward_nav_index_63', label: '自定义63' }]
 */
export function generateAvoidList(key: string, count: number = 7): AvoidItem[] {
    if (!Number.isFinite(count) || count <= 0) {
        return [];
    }
    const total = Math.floor(count);
    return Array.from({ length: total }, (_, i) => ({
        value: `${key}_index_${i}`,
        label: i === 0 ? '默认' : `自定义${i}`,
    }));
}

/**
 * 模板项的元信息（名称 + key），avoidList 通过 generateAvoidList 生成
 */
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
];

/**
 * 按指定数量生成完整的避障模板数据
 * @param count 每个模板项的 avoidList 长度，默认 64
 *
 * @example
 *   generateObstacleAvoidanceTemplateData(64) // 每个模板项生成 64 个选项
 */
export function generateObstacleAvoidanceTemplateData(count: number = 64): ObstacleTemplateItem[] {
    return TEMPLATE_META.map(({ name, key }) => ({
        name,
        key,
        avoidList: generateAvoidList(key, count),
    }));
}

export const ObstacleAvoidanceTemplateData: ObstacleTemplateItem[] =
    generateObstacleAvoidanceTemplateData(64);
