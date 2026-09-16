/**
 * @description 车辆告警条目表格化展示组件
 * @date 2026-7-20
 *
 * 将后端 errorEntryList（车辆告警列表）从 JSON 裸展示改造为结构化表格：
 *  - 按 locale 匹配译文（errorDescriptionTranslations / errorHintTranslations）
 *  - 严格容错 + 多级回退（当前语言 → zh_CN → en_US → 原文 / "-"）
 *  - 宽度自适应（width: 100%），由调用方外层容器决定实际宽度
 *
 * 后端 translationKey 仅返回 en_US / zh_CN（POSIX/Java 风格、下划线分隔），
 * 而项目支持 zh-CN / en-US / zh-TW / ja-JP / ko-KR（BCP-47、连字符、5 种），
 * zh-TW / ja-JP / ko-KR 在数据中无对应翻译，必须走回退链。
 *
 * 语言切换会整页刷新（setLocale(locale, true)），无需考虑"已打开弹窗实时切换语言"
 * 的响应式问题；组件每次 render 读取 locale，保证打开时的语言正确。
 *
 * 详见 docs/SPEC_error_entry_table.md
 */
import { memo } from "react";
import { Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useI18n } from "@/hooks/useI18n";
import styles from "./index.less";

/** 译文条目（后端 translationKey 仅 en_US / zh_CN） */
export interface TranslationItem {
    translationKey: string;
    translationValue: string;
}

/** 引用条目（容错：字段均可选，兼容后端缺字段场景） */
interface ErrorReferenceLike {
    referenceKey?: string;
    referenceValue?: string;
}

/**
 * 告警条目（组件内部容错类型）。
 * 字段均可选，既兼容 typing.d.ts / PlaybackTypings 中的 ErrorEntry（必填），
 * 也保证后端漏字段时不致整表崩溃（见规格 §10 容错与边界）。
 */
export interface ErrorEntryItem {
    errorDescription?: string;
    errorDescriptionTranslations?: TranslationItem[];
    errorHintTranslations?: TranslationItem[];
    errorLevel?: string;
    errorReferences?: ErrorReferenceLike[];
    errorType?: string;
}

export interface ErrorEntryTableProps {
    /** 告警条目列表，可能为 null/undefined/空数组 */
    errorEntryList?: ErrorEntryItem[] | null;
    /** 表格最大高度（px），超出纵向滚动；默认 320 */
    maxHeight?: number;
}

/** errorLevel → Tag color 映射；未识别等级走 default 灰色，对后端新增等级安全 */
const LEVEL_COLOR: Record<string, string> = {
    FATAL: "red",
    ERROR: "red",
    FAIL: "red",
    WARNING: "orange",
};

/**
 * 将任意风格的语言标识归一化为 "lang_REGION"（lang 小写、region 大写）。
 * "zh-CN" / "zh_CN" / "zh-cn" / "zh_cn" → "zh_CN"
 * "en-US" → "en_US"，"ja-JP" → "ja_JP"，"ko-KR" → "ko_KR"，"zh-TW" → "zh_TW"
 */
function normalizeLocaleKey(key: string): string {
    if (!key) return "";
    const parts = key.replace(/-/g, "_").split("_");
    const lang = (parts[0] || "").toLowerCase();
    const region = (parts[1] || "").toUpperCase();
    return region ? `${lang}_${region}` : lang;
}

/**
 * 按回退链从 translations 中解析译文。
 * 回退顺序（中文优先）：当前语言 → zh_CN → en_US。
 * translationValue 为空白字符串、translations 非数组/空数组均视为未命中，继续回退。
 * 全部未命中返回空字符串 ""（由调用方决定兜底：描述兜底原文，建议兜底 "-"）。
 */
function resolveTranslation(
    translations: TranslationItem[] | null | undefined,
    locale: string
): string {
    if (!Array.isArray(translations) || translations.length === 0) return "";
    const want = normalizeLocaleKey(locale);
    const order = [want, "zh_CN", "en_US"];
    for (const target of order) {
        if (!target) continue;
        const hit = translations.find(
            (item) => item && normalizeLocaleKey(item.translationKey) === target
        );
        if (
            hit &&
            typeof hit.translationValue === "string" &&
            hit.translationValue.trim() !== ""
        ) {
            return hit.translationValue;
        }
    }
    return "";
}

const { Paragraph } = Typography;

/**
 * 多行省略单元格。
 * 最多展示 6 行，超出以省略号截断；hover 时通过 tooltip 查看完整文本。
 * 借助 Antd Typography 的 js 测量能力，仅在文本确实被截断时才弹出 tooltip，
 * 避免短文本也冒气泡；空白文本返回 null，保持空单元格。
 * marginBottom: 0 用于抵消 Paragraph 默认 1em 下外边距，防止撑高表格行。
 */
const ClampCell = ({ text }: { text?: string }) => {
    if (!text) return null;
    return (
        <Paragraph ellipsis={{ rows: 6, tooltip: text }} style={{ marginBottom: 0 }}>
            {text}
        </Paragraph>
    );
};

/**
 * 告警条目表格。
 * 仅负责表格渲染，不含 Popover 触发器——是否外层包 Popover 由各调用方自行决定。
 */
const ErrorEntryTable = ({ errorEntryList, maxHeight = 320 }: ErrorEntryTableProps) => {
    const { t, locale } = useI18n();

    const columns: TableColumnsType<ErrorEntryItem> = [
        {
            title: t("等级"),
            dataIndex: "errorLevel",
            width: 80,
            render: (level?: string) =>
                level ? (
                    <Tag color={LEVEL_COLOR[level] || "default"}>{level}</Tag>
                ) : (
                    ""
                )
        },
        {
            // 类型为后端枚举，原文展示、不做 t() 翻译
            title: t("类型"),
            dataIndex: "errorType",
            width: 140,
            render: (text?: string) => text || ""
        },
        {
            // 错误码 = errorDescription 原文，直接展示、不翻译（如 "3"）
            title: t("错误码"),
            dataIndex: "errorDescription",
            width: 80,
            render: (text?: string) => text || ""
        },
        {
            // 描述回退链：译文 → errorDescription 原文 → "-"
            // 最多 6 行，超出省略号，hover 看全貌（见 ClampCell）
            title: t("描述"),
            render: (_value, record) => (
                <ClampCell
                    text={
                        resolveTranslation(record.errorDescriptionTranslations, locale) ||
                        record.errorDescription ||
                        ""
                    }
                />
            )
        },
        {
            // 处理建议回退链：译文 → "-"（无原文兜底字段）
            // 最多 6 行，超出省略号，hover 看全貌（见 ClampCell）
            title: t("处理建议"),
            render: (_value, record) => (
                <ClampCell
                    text={resolveTranslation(record.errorHintTranslations, locale) || ""}
                />
            )
        },
        {
            // 引用：非空时以 JSON 格式化展示整个对象；空数组留空
            title: t("引用"),
            dataIndex: "errorReferences",
            width: 300,
            render: (refs?: ErrorReferenceLike[]) => {
                if (!Array.isArray(refs) || refs.length === 0) return "";
                return (
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {JSON.stringify(refs, null, 4)}
                    </pre>
                );
            }
        }
    ];

    return (
        <Table<ErrorEntryItem>
            className={styles.errorEntryTable}
            size="small"
            tableLayout="fixed"
            pagination={false}
            columns={columns}
            dataSource={errorEntryList || []}
            // 后端无稳定主键，使用索引作 rowKey
            rowKey={(_record, index) => String(index)}
            scroll={{ y: maxHeight }}
        />
    );
};

export default memo(ErrorEntryTable);
