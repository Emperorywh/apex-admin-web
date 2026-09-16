import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RowData } from '@tanstack/react-table';
import type { ApexTableReactLocalProps, ApexTableReactRequestProps, ApexTableRef, ApexTableRequestResult, ColumnFiltersState, OnChangeFn, PaginationState, SortingState } from '../types';

/*
 * 请求查询切片同时支持内部状态和受控状态，回调继续接收原生 updater。
 * 回调在事件路径调用，避免 React 重放状态更新函数时重复通知业务。
 * 同一批次的非受控更新使用最新值，受控切片始终以父组件提交的值为准。
 */
function useRequestState<T>(controlled: T | undefined, initial: T, onChange?: OnChangeFn<T>): [T, OnChangeFn<T>] {
  const [internal, setInternal] = useState<T>(() => initial);
  const value = controlled === undefined ? internal : controlled;
  const latest = useRef({ value, controlled, onChange });
  useLayoutEffect(() => { latest.current = { value, controlled, onChange }; });
  const change = useCallback<OnChangeFn<T>>((updater) => {
    const current = latest.current;
    const next = typeof updater === 'function' ? (updater as (previous: T) => T)(current.value) : updater;
    if (current.controlled === undefined) latest.current = { ...current, value: next };
    setInternal(() => next);
    current.onChange?.(updater);
  }, []);
  return [value, change];
}

/*
 * 比较排序项与筛选项，避免父组件重建等价数组时重复请求。
 * 筛选值允许复杂业务对象，按引用判断，不序列化、不修改调用方的数据。
 */
const emptySorting: SortingState = [];
const emptyFilters: ColumnFiltersState = [];
type Criteria = { sorting: SortingState; columnFilters: ColumnFiltersState; globalFilter: unknown; manualSorting: boolean; manualFiltering: boolean };
function sameCriteria(previous: Criteria, next: Criteria) {
  return previous.manualSorting === next.manualSorting && previous.manualFiltering === next.manualFiltering && Object.is(previous.globalFilter, next.globalFilter)
    && previous.sorting.length === next.sorting.length && previous.sorting.every((item, index) => item.id === next.sorting[index].id && item.desc === next.sorting[index].desc)
    && previous.columnFilters.length === next.columnFilters.length && previous.columnFilters.every((item, index) => item.id === next.columnFilters[index].id && Object.is(item.value, next.columnFilters[index].value));
}

/*
 * 请求模式统一管理分页、排序、列筛选和全局筛选，界面仍复用普通数据组件。
 * 默认将排序和筛选交给服务端，显式 manualSorting/manualFiltering=false 保留当前页本地计算。
 */
export function useRequestProps<D extends RowData>(props: ApexTableReactRequestProps<D>): { dataProps: ApexTableReactLocalProps<D>; reload: ApexTableRef['reload'] } {
  const { request, onPaginationChange, onSortingChange, onColumnFiltersChange, onGlobalFilterChange, ...options } = props;
  const [pagination, changePagination] = useRequestState<PaginationState>(props.state?.pagination, { pageIndex: 0, pageSize: 10, ...props.initialState?.pagination }, onPaginationChange);
  const [sorting, changeSorting] = useRequestState<SortingState>(props.state?.sorting, props.initialState?.sorting ?? emptySorting, onSortingChange);
  const [columnFilters, changeColumnFilters] = useRequestState<ColumnFiltersState>(props.state?.columnFilters, props.initialState?.columnFilters ?? emptyFilters, onColumnFiltersChange);
  const [globalFilter, changeGlobalFilter] = useRequestState<unknown>(props.state?.globalFilter, props.initialState?.globalFilter, onGlobalFilterChange);
  const manualSorting = props.manualSorting ?? true;
  const manualFiltering = props.manualFiltering ?? true;
  const nextCriteria: Criteria = { sorting: manualSorting ? sorting : emptySorting, columnFilters: manualFiltering ? columnFilters : emptyFilters, globalFilter: manualFiltering ? globalFilter : undefined, manualSorting, manualFiltering };
  const previousCriteria = useRef(nextCriteria);
  const criteria = sameCriteria(previousCriteria.current, nextCriteria) ? previousCriteria.current : nextCriteria;
  const resetPage = criteria !== previousCriteria.current && (props.autoResetAll ?? props.autoResetPageIndex ?? true) && pagination.pageIndex !== 0;
  const [attempt, setAttempt] = useState(0);
  const query = useMemo(() => ({ pageIndex: pagination.pageIndex, pageSize: pagination.pageSize, criteria, attempt }), [pagination.pageIndex, pagination.pageSize, criteria, attempt]);
  const [result, setResult] = useState<ApexTableRequestResult<D> & { query: typeof query | null; error?: unknown }>(() => ({ data: [], rowCount: 0, query: null }));
  const requestRef = useRef(request);
  const committedQuery = useRef(query);
  /*
   * 只使用最新已提交的请求函数，内联函数引用变化本身不会重新请求。
   * 条件变化先校正页码，跳过旧页请求；受控分页通过原生回调通知业务接收新页码。
   * 同步记录查询身份，防止旧响应在副作用清理前覆盖已经提交的新查询。
   */
  useLayoutEffect(() => {
    requestRef.current = request;
    committedQuery.current = query;
    previousCriteria.current = criteria;
    if (resetPage) changePagination((previous) => ({ ...previous, pageIndex: 0 }));
  }, [request, query, criteria, resetPage, changePagination]);
  const reload = useCallback<ApexTableRef['reload']>((reloadOptions) => {
    if (reloadOptions?.resetPageIndex) changePagination((previous) => ({ ...previous, pageIndex: 0 }));
    setAttempt((previous) => previous + 1);
  }, [changePagination]);
  const retry = useCallback(() => reload(), [reload]);
  useEffect(() => {
    /*
     * 非法分页交给诊断界面处理，条件变更的中间页码也不发送给接口。
     * 清理时同时取消请求并禁止旧结果提交，接口忽略取消信号也不会覆盖新查询。
     */
    if (resetPage || !Number.isInteger(query.pageIndex) || query.pageIndex < 0 || !Number.isInteger(query.pageSize) || query.pageSize < 1) return;
    const controller = new AbortController();
    let active = true;
    const run = async () => {
      try {
        const next = await requestRef.current({ pageIndex: query.pageIndex, pageSize: query.pageSize, sorting: query.criteria.sorting, columnFilters: query.criteria.columnFilters, globalFilter: query.criteria.globalFilter, signal: controller.signal });
        if (!active || committedQuery.current !== query) return;
        if (!Array.isArray(next?.data) || !Number.isInteger(next.rowCount) || next.rowCount < 0) throw new Error('request 必须返回数据数组 data 和非负整数 rowCount');
        setResult({ data: next.data, rowCount: next.rowCount, query });
      } catch (error) {
        if (active && committedQuery.current === query) setResult({ data: [], rowCount: 0, query, error: error || new Error('请求失败') });
      }
    };
    void run();
    return () => { active = false; controller.abort(); };
  }, [query, resetPage]);
  /*
   * 查询改变立即隐藏旧页和总数，请求返回时一起更新；刷新不重建表格实例。
   * 页码重置由查询变化统一管理，禁止底层因响应 data 更新再次重置或循环请求。
   */
  const loading = resetPage || result.query !== query;
  const dataProps: ApexTableReactLocalProps<D> = { ...options, data: result.data, rowCount: result.rowCount, manualPagination: true, manualSorting, manualFiltering, autoResetAll: false, autoResetPageIndex: false, state: { ...props.state, pagination, sorting, columnFilters, globalFilter }, onPaginationChange: changePagination, onSortingChange: changeSorting, onColumnFiltersChange: changeColumnFilters, onGlobalFilterChange: changeGlobalFilter, loading, error: loading ? undefined : result.error, onRetry: retry };
  return { dataProps, reload };
}
