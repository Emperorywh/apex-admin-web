/**
 * @description 表格派生顺序纯函数（§7.4）
 *
 * 表格原始 rows 保持不可变，使用纯 selector 派生：
 *   1. 按列筛选
 *   2. 使用稳定排序；值相同时按行 ID 升序保证确定性
 *   3. 根据 current/pageSize 截取当前页
 *
 * 筛选条件或 pageSize 改变时由调用方将 current 重置为 1；
 * 仅翻页不得重新请求报表。
 */

export type SortDirection = "ascend" | "descend";

export interface ColumnSorter<TRow> {
    column: keyof TRow & string;
    direction: SortDirection;
    /** 从行中取出参与排序的可比较值（数字或 null） */
    valueOf: (row: TRow) => number | null;
}

export interface ColumnFilter<TRow> {
    column: keyof TRow & string;
    /** 返回 true 表示保留该行 */
    accept: (row: TRow) => boolean;
}

export interface PageQuery {
    current: number;
    pageSize: number;
}

/**
 * 比较两个可排序值。
 * null 视为最大值（§5.4：未恢复事件的持续时间排序时视为最大持续时间）。
 * 同值时返回 0，由外层用 id 升序兜底保证确定性。
 */
function compareSortableValue(a: number | null, b: number | null, direction: SortDirection): number {
    const aIsNull = a === null || a === undefined || Number.isNaN(a as number);
    const bIsNull = b === null || b === undefined || Number.isNaN(b as number);
    // null 视为最大：升序时排在末尾，降序时排在最前（保持"未恢复=最大"语义）
    if (aIsNull && bIsNull) return 0;
    if (aIsNull) return 1;
    if (bIsNull) return -1;
    const diff = (a as number) - (b as number);
    const signed = direction === "ascend" ? diff : -diff;
    return signed < 0 ? -1 : signed > 0 ? 1 : 0;
}

/**
 * 应用筛选。
 */
export function filterRows<TRow extends { id: string }>(rows: readonly TRow[], filters: ColumnFilter<TRow>[]): TRow[] {
    if (!filters.length) return [...rows];
    return rows.filter((row) => filters.every((f) => f.accept(row)));
}

/**
 * 应用稳定排序：先按指定列方向排序，同值时按 id 升序兜底。
 */
export function sortRows<TRow extends { id: string }>(rows: readonly TRow[], sorter: ColumnSorter<TRow> | null): TRow[] {
    if (!sorter) return [...rows];
    const result = [...rows];
    result.sort((a, b) => {
        const cmp = compareSortableValue(sorter.valueOf(a), sorter.valueOf(b), sorter.direction);
        if (cmp !== 0) return cmp;
        // 同值按 id 升序保证确定性
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return result;
}

/**
 * 应用分页（current/pageSize）。
 */
export function paginateRows<TRow>(rows: readonly TRow[], page: PageQuery): TRow[] {
    const start = (page.current - 1) * page.pageSize;
    return rows.slice(start, start + page.pageSize);
}

/**
 * 一站式派生：筛选 → 稳定排序 → 分页。
 */
export function deriveRows<TRow extends { id: string }>(rows: readonly TRow[], filters: ColumnFilter<TRow>[], sorter: ColumnSorter<TRow> | null, page: PageQuery): TRow[] {
    const filtered = filterRows(rows, filters);
    const sorted = sortRows(filtered, sorter);
    return paginateRows(sorted, page);
}
