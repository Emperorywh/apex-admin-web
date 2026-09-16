/**
 * @description 故障告警明细表派生 selectors（§7.4）
 *
 * 明细表已对接真实接口（服务端分页）：
 *   - 级别 / 类型 / 来源 / 状态等筛选与分页由后端完成（见 FaultDetailPageQuery）；
 *   - 接口无排序参数，排序只对当前页数据做前端稳定排序；
 *   - 未关闭事件 durationMs 为 null，排序时视为最大持续时间（§5.4），
 *     该语义由 tableSelectors.compareSortableValue 统一处理。
 */
import {
    type ColumnSorter,
    sortRows,
} from "@/pages/AnalyzeVisual/DashboardShared/model/tableSelectors";
import type {
    FaultDescription,
    FaultDetailLevel,
    FaultDetailRecord,
} from "@/pages/AnalyzeVisual/FaultAlert/model/types";

/**
 * 明细表筛选状态（下拉类条件用 "all" 表示不筛选，文本/时间条件空值表示不筛选）。
 * 对应接口的全部查询条件；点「查询」后整体生效（applied），与编辑中的草稿态分离。
 */
export interface FaultDetailFilters {
    /** 告警级别：critical / major / all */
    level?: FaultDetailLevel | "all";
    /** 告警类型（后端 alarmType 原文）/ all */
    alarmType?: string | "all";
    /** 告警来源：VEHICLE / DEVICE / SERVER / all */
    sourceType?: string | "all";
    /** 告警来源标识 */
    sourceKey?: string;
    /** 告警来源名称 */
    sourceName?: string;
    /** 告警码 */
    alarmCode?: string;
    /** 关联订单key */
    orderKey?: string;
    /** 状态：open 未关闭 / closed 已关闭 / all */
    closed?: "all" | "open" | "closed";
    /** 发生时间范围（YYYY-MM-DD HH:mm:ss） */
    startTimeBegin?: string;
    startTimeEnd?: string;
    /** 恢复时间范围（YYYY-MM-DD HH:mm:ss） */
    endTimeBegin?: string;
    endTimeEnd?: string;
}

export type FaultTableSortColumn = "durationMs" | "occurredAt";
export type FaultTableSortState = { column: FaultTableSortColumn; direction: "ascend" | "descend" } | null;

/**
 * 对当前页明细行做前端稳定排序。
 * 注意：接口为服务端分页且无排序参数，本排序只作用于当前页，
 * 不代表全量数据的整体顺序。
 */
export function sortFaultDetailRecords(
    rows: readonly FaultDetailRecord[],
    sort: FaultTableSortState,
): FaultDetailRecord[] {
    if (!sort) return [...rows];
    const valueOf = (row: FaultDetailRecord): number | null => {
        if (sort.column === "occurredAt") {
            // 发生时间缺失时按 null 处理，排序视为最大值
            return row.occurredAt ? new Date(row.occurredAt).getTime() : null;
        }
        // durationMs：未关闭为 null，由 compareSortableValue 视为最大（§5.4）
        return row.durationMs;
    };
    const sorter: ColumnSorter<FaultDetailRecord> = { column: sort.column, direction: sort.direction, valueOf };
    return sortRows(rows, sorter);
}

/**
 * 将任意风格的语言标识归一化为 "lang_REGION"（lang 小写、region 大写）。
 * 后端 translationKey 仅返回 en_US / zh_CN（下划线分隔），
 * 项目 locale 为 zh-CN / en-US / zh-TW / ja-JP / ko-KR（连字符），需先归一化再比较。
 * 与 ErrorEntryTable 组件的 normalizeLocaleKey 口径一致。
 */
function normalizeLocaleKey(key: string): string {
    if (!key) return "";
    const parts = key.replace(/-/g, "_").split("_");
    const lang = (parts[0] || "").toLowerCase();
    const region = (parts[1] || "").toUpperCase();
    return region ? `${lang}_${region}` : lang;
}

/**
 * 按回退链解析故障描述译文：当前语言 → zh_CN → en_US → errorDescription 原文。
 * translationValue 为空白视为未命中，继续回退；全部未命中时返回原文（可能为空串）。
 */
export function resolveFaultDescription(desc: FaultDescription | null | undefined, locale: string): string {
    if (!desc) return "";
    const translations = Array.isArray(desc.translations) ? desc.translations : [];
    const want = normalizeLocaleKey(locale);
    for (const target of [want, "zh_CN", "en_US"]) {
        if (!target) continue;
        const hit = translations.find(
            (item) => item && normalizeLocaleKey(item.translationKey) === target,
        );
        if (hit && typeof hit.translationValue === "string" && hit.translationValue.trim() !== "") {
            return hit.translationValue;
        }
    }
    return desc.text ?? "";
}
