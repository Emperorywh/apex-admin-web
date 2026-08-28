/**
 * 任务管理服务：分页 + 多条件筛选。
 * 当前为 mock 实现（数据见 order.mock.ts），按查询条件在内存中过滤/分页；
 * 接入调度后端时保留函数签名，替换实现并解包 code envelope 即可。
 */

import { CanceledError } from 'axios'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  OrderListQuery,
  OrderRecordDto,
} from '@/services/order-record/order.service.types'
import {
  MOCK_ORDER_LATENCY_MS,
  MOCK_ORDER_PAGE_ENVELOPE,
} from '@/services/order-record/order.mock'
import type { OrderEntity, OrderPage } from '@/types/order-record/order.types'

/** envelope 记录 → 实体（当前同构，直接透传） */
function toOrderEntity(dto: OrderRecordDto): OrderEntity {
  return dto
}

function matchesQuery(record: OrderEntity, query: OrderListQuery): boolean {
  if (query.keyword) {
    const keyword = query.keyword.toLowerCase()
    const haystack = [record.orderName, record.orderKey, record.taskId ?? '']
      .join('\n')
      .toLowerCase()
    if (!haystack.includes(keyword)) return false
  }
  if (query.orderType && record.orderType !== query.orderType) return false
  if (query.orderState && record.orderState !== query.orderState) return false
  if (query.executeVehicleName && !(record.executeVehicleName ?? '').includes(query.executeVehicleName)) {
    return false
  }
  if (query.createdStart && record.createTime < query.createdStart) return false
  if (query.createdEnd && record.createTime > query.createdEnd) return false
  return true
}

function hasFilters(query: OrderListQuery): boolean {
  return Boolean(
    query.keyword || query.orderType || query.orderState || query.executeVehicleName || query.createdStart || query.createdEnd,
  )
}

function queryMock(query: OrderListQuery): OrderPage {
  const { page, pageSize } = query

  // 无筛选时模拟后端全量分页：用 envelope 总量循环补齐任意页，便于预览翻页效果
  if (!hasFilters(query)) {
    const total = MOCK_ORDER_PAGE_ENVELOPE.data.total
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const records = MOCK_ORDER_PAGE_ENVELOPE.data.records
    const items = Array.from({ length: Math.min(pageSize, Math.max(0, total - start)) }, (_, index) => {
      const base = toOrderEntity(records[(start + index) % records.length])
      // 偏移量放大保证合成 id 页内唯一（基记录 id 连续，线性偏移会碰撞出重复 rowKey）
      return { ...base, id: base.id - (start + index) * 100 }
    })
    return { items, total, page, pageSize, pages }
  }

  const filtered = MOCK_ORDER_PAGE_ENVELOPE.data.records
    .map(toOrderEntity)
    .filter((record) => matchesQuery(record, query))
  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  }
}

export function pageOrders(query: OrderListQuery, options?: RequestOptions): Promise<OrderPage> {
  const { signal } = options ?? {}
  if (signal?.aborted) return Promise.reject(new CanceledError('canceled'))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(queryMock(query))
    }, MOCK_ORDER_LATENCY_MS)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new CanceledError('canceled'))
    }
    signal?.addEventListener('abort', onAbort)
  })
}
