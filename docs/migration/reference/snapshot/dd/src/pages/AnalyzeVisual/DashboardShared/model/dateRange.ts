/**
 * @description 日期区间校验与粒度推导（§6.5）
 *
 * 唯一口径来源：getCalendarDays 是时间粒度和最大区间校验的真相源。
 * 展示层只根据稳定错误码渲染文案，不直接展示内部异常消息。
 */
import type { TimeGranularity } from "@/pages/AnalyzeVisual/DashboardShared/model/types";

export const MILLISECONDS_PER_DAY = 86_400_000;
export const HOURLY_MAX_CALENDAR_DAYS = 2;
export const DAILY_MAX_CALENDAR_DAYS = 45;
export const MAX_CALENDAR_DAYS = 90;

/**
 * 日期区间校验错误只携带稳定错误码（§6.5）。
 * 展示层根据错误码读取当前语言文案，不直接展示内部异常消息。
 */
export type DateRangeErrorCode =
    | "INCOMPLETE_RANGE"
    | "INVALID_FORMAT"
    | "INVALID_CALENDAR_DATE"
    | "REVERSED_RANGE"
    | "FUTURE_END_DATE"
    | "RANGE_TOO_LARGE";

export class DateRangeError extends Error {
    constructor(readonly code: DateRangeErrorCode) {
        super(code);
        this.name = "DateRangeError";
    }
}

/**
 * 将 YYYY-MM-DD 转换为与运行环境时区无关的自然日序号。
 * UTC 仅用于日期序号运算，不代表业务事件采用 UTC 时区。
 */
function toEpochDay(value: string): number {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!matched) throw new DateRangeError("INVALID_FORMAT");

    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        throw new DateRangeError("INVALID_CALENDAR_DATE");
    }
    return timestamp / MILLISECONDS_PER_DAY;
}

/**
 * 计算包含首尾的自然日数量。
 * 该函数是时间粒度和最大区间校验的唯一口径。
 */
export function getCalendarDays(startDate: string, endDate: string): number {
    return toEpochDay(endDate) - toEpochDay(startDate) + 1;
}

/**
 * 根据包含首尾的自然日数量选择趋势图粒度。
 * 1–2 日按小时，3–45 日按天，46–90 日按 ISO 周。
 */
export function getTimeGranularity(calendarDays: number): TimeGranularity {
    if (calendarDays < 1) throw new DateRangeError("REVERSED_RANGE");
    if (calendarDays > MAX_CALENDAR_DAYS) throw new DateRangeError("RANGE_TOO_LARGE");
    if (calendarDays <= HOURLY_MAX_CALENDAR_DAYS) return "hour";
    if (calendarDays <= DAILY_MAX_CALENDAR_DAYS) return "day";
    return "week";
}

/**
 * 已校验的日期区间值对象。
 * 报表页面移除区间工具栏后，仅 mock 数据生成（固定默认区间）消费该对象。
 */
export interface DateRange {
    startDate: string;
    endDate: string;
    calendarDays: number;
    granularity: TimeGranularity;
}

/**
 * 业务时区下的今日 YYYY-MM-DD（默认 Asia/Shanghai）。
 * 接受可选 now 注入，便于测试与确定性 mock。
 */
export function todayDateStr(now: number = Date.now(), timezone = "Asia/Shanghai"): string {
    // 使用 Intl 直接计算业务时区的自然日，避免依赖未初始化的 dayjs 插件
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(now));
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
}

/**
 * 创建权威校验过的 DateRange。
 * 校验完整区间：非空、格式、合法日历日、非逆序、结束不晚于今天、不超过 90 个自然日。
 * 校验通过后一次性计算 calendarDays / granularity / key。
 */
export function createDateRange(startDate: string, endDate: string, now: number = Date.now()): DateRange {
    if (!startDate || !endDate) throw new DateRangeError("INCOMPLETE_RANGE");
    // 先校验格式与合法日历日（toEpochDay 内部完成）
    const calendarDays = getCalendarDays(startDate, endDate);
    // 结束日期不得晚于今天（§6.5）
    const today = todayDateStr(now);
    if (toEpochDay(endDate) > toEpochDay(today)) {
        throw new DateRangeError("FUTURE_END_DATE");
    }
    const granularity = getTimeGranularity(calendarDays);
    return {
        startDate,
        endDate,
        calendarDays,
        granularity,
    };
}

/**
 * 计算近 N 个自然日的快捷区间（§4.2）：
 * 统一为 [today - (N - 1) days, today]，包含今天在内共 N 个自然日。
 */
export function lastNDaysRange(n: number, now: number = Date.now()): { startDate: string; endDate: string } {
    const todayEpochDay = toEpochDay(todayDateStr(now));
    const startEpochDay = todayEpochDay - (n - 1);
    return {
        startDate: epochDayToDateStr(startEpochDay),
        endDate: epochDayToDateStr(todayEpochDay),
    };
}

function epochDayToDateStr(epochDay: number): string {
    const ts = epochDay * MILLISECONDS_PER_DAY;
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
