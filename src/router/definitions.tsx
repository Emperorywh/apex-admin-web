/**
 * 路由定义唯一来源：id、path、页面懒加载与 meta 在此声明。
 * projections.tsx 据此生成访问路由、缓存渲染路由与菜单；
 * ROUTE_IDS / ROUTE_PATHS / RouteId 由定义树自动推导。
 * 根路径与未匹配地址跳转到机器人监控。
 */

import {
  Bot,
  Cog,
  Cpu,
  Radar,
  ListTree,
  Map,
  MapPlus,
  Warehouse,
  Workflow,
} from 'lucide-react'
import type { AppRouteDefinition } from '@/router/router.types'

/** 以 const 泛型收集字面量 id，供 RouteId 联合类型推导 */
function defineAppRoutes<const T extends readonly AppRouteDefinition[]>(routes: T): T {
  return routes
}

export const appRouteDefinitions = defineAppRoutes([
  {
    id: 'auth-login',
    path: '/login',
    loadPage: () => import('@/pages/auth/Login/Login'),
    meta: {
      title: '登录',
      hideInMenu: true,
      hideInTabs: true,
      noCache: true,
      i18nNamespaces: ['auth'],
    },
  },
  {
    // 与登录页同级，使用全屏布局；新增和编辑共用入口，不进入菜单或页签缓存。
    id: 'action-orchestration-edit',
    path: '/action-orchestration/edit',
    loadPage: () => import('@/pages/action/ActionOrchestrationEdit/ActionOrchestrationEdit'),
    // 编辑页独立加载动作命名空间，直接访问与刷新同样支持英文配置界面。
    meta: { title: '动作编排编辑', hideInMenu: true, hideInTabs: true, noCache: true, i18nNamespaces: ['action'] },
  },
  {
    id: 'root',
    path: '/',
    meta: { title: '机器人系统' },
    children: [
      {
        id: 'root-index',
        index: true,
        meta: { title: '工作台', hideInMenu: true, hideInTabs: true, noCache: true },
      },
      {
        // 单机监控作为默认工作台，固定页签保证实时状态入口始终可达。
        id: 'robot-monitor',
        path: 'robot-monitor',
        loadPage: () => import('@/pages/robot-monitor/RobotMonitor/RobotMonitor'),
        meta: { title: '机器人监控', icon: Radar, affixTab: true },
      },
      {
        id: 'robot-control',
        path: 'robot-control',
        meta: { title: '机器人控制', icon: Bot },
        children: [
          {
            id: 'robot-control-index',
            index: true,
            redirect: '/robot-control/robots',
            meta: { title: '机器人列表', hideInMenu: true, hideInTabs: true, noCache: true },
          },
          {
            id: 'robot-list',
            path: 'robots',
            loadPage: () => import('@/pages/robot/RobotList/RobotList'),
            meta: { title: '机器人列表', icon: Bot },
          },
          {
            id: 'robot-map-edit',
            path: 'map-edit',
            loadPage: () => import('@/pages/robot/MapEdit/MapEdit'),
            meta: { title: '地图编辑', icon: Map },
          },
          {
            id: 'robot-map-create',
            path: 'map-create',
            loadPage: () => import('@/pages/robot/MapCreate/MapCreate'),
            meta: { title: '地图创建', icon: MapPlus },
          },
        ],
      },
      {
        id: 'action-orchestration',
        path: 'action-orchestration',
        loadPage: () => import('@/pages/action/ActionOrchestration/ActionOrchestration'),
        // 声明页面命名空间，语言切换时预加载列表和操作入口译文。
        meta: { title: '动作编排', icon: Workflow, i18nNamespaces: ['action'] },
      },
      {
        id: 'axis-motor-management',
        path: 'axis-motor-management',
        loadPage: () => import('@/pages/axis-motor/AxisMotorManagement/AxisMotorManagement'),
        meta: { title: '轴电机管理', icon: Cog },
      },
      {
        id: 'device-management',
        path: 'device-management',
        loadPage: () => import('@/pages/device/DeviceManagement/DeviceManagement'),
        meta: { title: '设备管理', icon: Cpu },
      },
      {
        id: 'storage-location-management',
        path: 'storage-location-management',
        loadPage: () => import('@/pages/storage-location/StorageLocationManagement/StorageLocationManagement'),
        meta: { title: '库位管理', icon: Warehouse },
      },
      {
        id: 'task-chain-orchestration',
        path: 'task-chain-orchestration',
        loadPage: () => import('@/pages/task-chain/TaskChainOrchestration/TaskChainOrchestration'),
        meta: { title: '任务链编排', icon: ListTree },
      },
      {
        id: 'root-fallback',
        path: '*',
        meta: { title: '工作台', hideInMenu: true, hideInTabs: true, noCache: true },
      },
    ],
  },
])

/* -------------------------------------------------------------------------- */
/* id / 完整路径推导（模块初始化时执行一次）                                       */
/* -------------------------------------------------------------------------- */

/** 拼接父子路径；以 / 开头的段视为绝对路径直接采用 */
export function joinPath(base: string, segment: string | undefined): string {
  if (!segment) return base || '/'
  if (segment.startsWith('/')) return segment
  return `${base === '/' ? '' : base}/${segment}`
}

/** 从定义树递归提取全部 id 字面量 */
type RouteIdOf<T> = T extends readonly (infer U)[]
  ? U extends { id: infer I; children?: infer C }
  ? C extends readonly unknown[]
  ? I | RouteIdOf<C>
  : I
  : never
  : never

/** 全局唯一路由 id 联合；新增树节点后自动扩充 */
export type RouteId = RouteIdOf<typeof appRouteDefinitions>

const ids: Record<string, string> = {}
const paths: Record<string, string> = {}

function collectRoutes(definitions: readonly AppRouteDefinition[], basePath: string): void {
  for (const definition of definitions) {
    if (definition.id in ids) throw new Error(`路由 id 重复：${definition.id}`)
    ids[definition.id] = definition.id
    // index 与 * 节点没有可导航地址，归到父路径
    const navigable = definition.path !== undefined && !definition.path.includes('*')
    paths[definition.id] = navigable ? joinPath(basePath, definition.path) : basePath
    if (definition.children?.length) {
      collectRoutes(definition.children, navigable ? paths[definition.id] : basePath)
    }
  }
}

collectRoutes(appRouteDefinitions, '/')

/** 全量路由 id（按 id 索引）；业务代码引用 id 时用它而非散落字面量 */
export const ROUTE_IDS = ids as Readonly<Record<RouteId, RouteId>>

/** id → 完整访问路径；由树推导，禁止手写副本 */
export const ROUTE_PATHS = paths as Readonly<Record<RouteId, string>>

/** 常驻页签播种数据：affixTab 叶子的规范化地址（无 search）与路由 id */
export interface AffixTabSeed {
  key: string
  routeId: string
  pathname: string
}

/** 收集全部 affixTab 页面路由（按定义顺序）；页签状态初始化时据此播种，刷新后常驻页签不丢失 */
export function collectAffixTabSeeds(): AffixTabSeed[] {
  const seeds: AffixTabSeed[] = []
  const walk = (definitions: readonly AppRouteDefinition[], basePath: string): void => {
    for (const definition of definitions) {
      const path = joinPath(basePath, definition.path)
      if (definition.children?.length) {
        walk(definition.children, path)
        continue
      }
      if (
        definition.loadPage &&
        definition.meta.affixTab === true &&
        definition.meta.hideInTabs !== true
      ) {
        seeds.push({ key: path, routeId: definition.id, pathname: path })
      }
    }
  }
  walk(appRouteDefinitions, '/')
  return seeds
}
