/**
 * @description 服务器实时资源监控大屏的共享常量与纯函数
 *
 * 取值与复刻源 server-monitor-dashboard.html 保持一致：
 *   - 轮询 2s、趋势窗口 90 点（约 3 分钟）
 *   - 使用率兼容两种后端口径：0~1 比例（×100）或 0~100 百分比
 *   - 严重程度分级：<70 正常 / 70~89 偏高 / ≥90 危险
 */

/** 轮询间隔（毫秒） */
export const POLL_MS = 2000;

/** 趋势窗口点数（90 × 2s ≈ 3 分钟） */
export const MAX_HIST = 90;

/** 趋势图三条序列的 key 与配色（配色已通过 CVD / 对比度校验，勿随意改色） */
export const SERIES = [
    { key: "cpu", color: "#3987e5" },
    { key: "mem", color: "#d95926" },
    { key: "jvm", color: "#199e70" },
] as const;

export type SeriesKey = (typeof SERIES)[number]["key"];

/** 趋势历史采样点（t 为采集时刻的时间戳） */
export interface TrendPoint {
    t: number;
    cpu: number;
    mem: number;
    jvm: number;
}

/** 严重程度档位：c 为弧形/进度条主色，t 为中文文案（组件层用 t() 翻译），dot 为状态点颜色 */
export interface Severity {
    c: string;
    t: string;
    dot: string;
}

const SEV_NORMAL: Severity = { c: "#3987e5", t: "正常", dot: "#1fd08a" };
const SEV_WARN: Severity = { c: "#fab219", t: "偏高", dot: "#fab219" };
const SEV_CRIT: Severity = { c: "#d03b3b", t: "危险", dot: "#d03b3b" };

/** 按使用率取严重程度档位：<70 正常 / 70~89 偏高 / ≥90 危险 */
export const sevOf = (v: number): Severity => (v >= 90 ? SEV_CRIT : v >= 70 ? SEV_WARN : SEV_NORMAL);

/**
 * 使用率归一化为 0~100：
 * 兼容两种后端口径，0~1 视为比例（×100），否则视为百分数；非法值按 0 处理。
 */
export function normRate(v: unknown): number {
    let n = Number(v);
    if (!isFinite(n)) return 0;
    if (n >= 0 && n <= 1) n *= 100;
    return Math.min(100, Math.max(0, n));
}

/** 两位补零（时钟与时间标签用） */
export const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 十六进制颜色转 rgba（趋势图渐变、仪表辉光用） */
export function hexA(hex: string, a: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 悬浮提示的单行内容（颜色条 + 名称 + 数值） */
export interface TipRow {
    color: string;
    name: string;
    value: string;
}

/** 页面级悬浮提示状态（x/y 为鼠标视口坐标） */
export interface TipState {
    x: number;
    y: number;
    title: string;
    rows: TipRow[];
}
