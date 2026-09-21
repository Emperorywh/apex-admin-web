/**
 * 路由层外的稳定回退地址。
 * 路由 id 与 path 的唯一来源是 @/router/definitions.tsx（树节点推导）；
 * 此处仅保留 components/features 等不可依赖 router 层的模块所需的锚点。
 */

/** 错误恢复与登录无有效回跳时进入机器人监控；对应 definitions.tsx 中 robot-monitor 节点。 */
export const FALLBACK_PATH = '/robot-monitor'
