/**
 * ApexTable 分页换算纯函数（T00.5 表格公共设施，规格 6.2 / DoD 5）。
 *
 * 背景：apex-table-react（TanStack）分页状态 pageIndex 从 0 计数，
 * 调度后端分页参数 pageNo 从 1 计数（contracts.md 第 1 节 BackendPageQuery）。
 * 页面在 request 回调里自行换算——本文件只提供换算与校验，不做任何请求。
 *
 * 语义约束（不因封装而含糊）：
 * - pageIndex 必须为非负整数、pageSize 必须为正整数，无效入参直接抛错，
 *   宁可在开发期暴露配置错误，不发错误分页参数打脏真实接口；
 * - 未知总数（rowCount）不由本文件处理：后端未返回 total 时页面不得填 0
 *   （DoD 5「未知总数不填 0」），由各页面任务按契约如实透传。
 */

/** 后端标准分页参数形状（与 request.types.ts 的 BackendPageQuery 对齐） */
export interface BackendPageParam {
  /** 从 1 计数的后端页码 */
  pageNo: number
  /** 每页条数，原样透传 */
  pageSize: number
}

/** 校验并换算：零基 pageIndex → 一基后端 pageNo（pageNo = pageIndex + 1） */
export function toBackendPageNo(pageIndex: number): number {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Error(`[表格分页] pageIndex 必须为非负整数，收到：${String(pageIndex)}`)
  }
  return pageIndex + 1
}

/** 校验 pageSize：正整数，供两处调用共享同一报错语义 */
export function toBackendPageSize(pageSize: number): number {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`[表格分页] pageSize 必须为正整数，收到：${String(pageSize)}`)
  }
  return pageSize
}

/** 一次成对换算：把 ApexTable request 回调收到的分页状态转为后端查询参数 */
export function toBackendPage(pageIndex: number, pageSize: number): BackendPageParam {
  return {
    pageNo: toBackendPageNo(pageIndex),
    pageSize: toBackendPageSize(pageSize),
  }
}
