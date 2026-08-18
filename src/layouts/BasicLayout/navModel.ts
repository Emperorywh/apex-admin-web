/**
 * 布局导航消费契约（规格 §4.1 投影 3/§11.2）。
 *
 * 布局层不得反向导入 router/（结构门禁依赖方向固定为 router → layouts），
 * 因此路由层把 menuRoutes 投影（含权限与 hideInMenu 过滤、hasPage 派生）经 props
 * 注入布局；本文件定义布局消费侧的导航节点形状，是这份注入契约的唯一表述。
 * router/router.types.ts 的 MenuRouteNode 以 extends 复用本形状并追加过滤输入字段，
 * 共享字段不在两处重复定义（规格 §3.4 单一权威定义）。
 */

/**
 * 布局消费的导航节点：由路由层从受保护根子树投影并过滤后注入。
 * path 为前端完整路径（本模板路由定义一律使用绝对路径），目录节点也携带自身路径。
 */
export interface NavTreeNode {
  /** 对应路由定义的稳定唯一 id */
  id: string
  /** 节点完整路径；无法寻址的节点（如 index route）不参与导航 */
  path?: string
  /** 标题：中文文案 key，经 menu 命名空间翻译（规格 §12） */
  title: string
  /** 菜单图标名（local: 前缀，AppIcon 注册表解析，SPEC_UI2 §5.4） */
  icon?: string
  /** 菜单副标题 caption：中文文案 key，经 menu 命名空间翻译（SPEC_UI2 §6.1） */
  caption?: string
  /**
   * 是否挂载页面组件（路由定义含 loadPage）：
   * 目录节点为 false，面包屑据此判定该层级不可点击（规格 §11.2）。
   */
  hasPage: boolean
  children?: NavTreeNode[]
}

/**
 * Data Router handle.meta 的布局消费子集（规格 §4.2：meta 原样映射到 handle.meta）。
 * 面包屑与标题只从 handle.meta 读取，不维护副本；此处只声明布局实际读取的字段，
 * 含页签系统消费的 hideInTabs/noCache/affixTab/tabKeyMode（规格 §4.2/§9）。
 */
export interface NavMatchMeta {
  title: string
  breadcrumb?: boolean
  i18nNamespaces?: string[]
  /** 不生成页签的辅助路由（登录、错误页等，规格 §4.2） */
  hideInTabs?: boolean
  /** 离开即卸载、不进入 Activity/LRU 的页面（规格 §9.1） */
  noCache?: boolean
  /** 固定页签：排在最前且不可关闭（规格 §9.3） */
  affixTab?: boolean
  /** 页签 key 模式：fullPath 含规范化 search，pathname 仅按路径（规格 §4.5） */
  tabKeyMode?: 'fullPath' | 'pathname'
}

/**
 * 从 Data Router match 的 handle 中读取布局所需 meta（规格 §4.2）。
 * handle 经路由投影写入 { meta }；形状不符（无 meta 或缺 title）时视为该层级
 * 不参与面包屑，返回 undefined。
 */
export function readNavMatchMeta(handle: unknown): NavMatchMeta | undefined {
  if (typeof handle !== 'object' || handle === null) {
    return undefined
  }
  const meta = (handle as { meta?: unknown }).meta
  if (typeof meta !== 'object' || meta === null) {
    return undefined
  }
  const { title, breadcrumb, i18nNamespaces, hideInTabs, noCache, affixTab, tabKeyMode } = meta as Record<
    string,
    unknown
  >
  if (typeof title !== 'string') {
    return undefined
  }
  return {
    title,
    ...(typeof breadcrumb === 'boolean' ? { breadcrumb } : {}),
    ...(Array.isArray(i18nNamespaces) ? { i18nNamespaces: i18nNamespaces as string[] } : {}),
    ...(hideInTabs === true ? { hideInTabs: true } : {}),
    ...(noCache === true ? { noCache: true } : {}),
    ...(affixTab === true ? { affixTab: true } : {}),
    ...(tabKeyMode === 'pathname' || tabKeyMode === 'fullPath' ? { tabKeyMode } : {}),
  }
}
