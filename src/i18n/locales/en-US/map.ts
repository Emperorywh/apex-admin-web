/**
 * 共享地图能力文案（T00.7 ReadOnlyMap 只读地图组件；map 命名空间）。
 *
 * 归属：map 命名空间由 T00 维护（共享地图组件内建文案）；
 * 各页面私有地图文案放页面自己的分片。消费页面需在路由 meta.i18nNamespaces
 * 声明 'map'（页面任务接入时应用）。zh-TW/ja-JP/ko-KR 随 T00.8 五语言基座补齐，
 * 当前回退简体中文（已登记 docs/migration/i18n-missing.md）。
 */

export default {
  '请传入地图ID': 'Map ID is required',
  '地图加载中...': 'Loading map...',
  '地图数据为空': 'The map contains no nodes or paths',
  '搜索节点或路径...': 'Search nodes or paths...',
  '节点': 'Nodes',
  '路径': 'Paths',
} as const
