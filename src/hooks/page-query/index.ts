/**
 * 页面统一查询接口（T010 交付）。
 * 业务页只从这里引入；轮询频率一律取 PAGE_POLLING 常量，不自造间隔。
 */

export type {
  UsePageQueryOptions,
  UsePageQueryResult,
  PagePollingPolicy,
  PageQueryFetcher,
} from '@/hooks/page-query/pageQuery.types'

export { PAGE_POLLING, pollingGapMs } from '@/hooks/page-query/pageQuery.types'
export { usePageQuery } from '@/hooks/page-query/usePageQuery'
export { useDocumentVisible } from '@/hooks/page-query/useDocumentVisible'
