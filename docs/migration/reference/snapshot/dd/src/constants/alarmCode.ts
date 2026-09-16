/**
 * @description 车辆告警码相关常量
 * @date 2026-7-9
 */
import type { SelectProps } from "antd";

/**
 * 多语言告警描述支持的语言类型选项
 * locale 取值与项目国际化语言代码保持一致
 */
export const LOCALE_OPTIONS: SelectProps["options"] = [
    { label: "简体中文", value: "zh_CN" },
    { label: "English", value: "en_US" },
    { label: "日本語", value: "ja_JP" },
    { label: "한국어", value: "ko_KR" },
    { label: "繁體中文", value: "zh_TW" },
];

/**
 * 根据语言代码获取展示名称，未匹配时原样返回
 * @param locale 语言类型代码
 */
export const getLocaleLabel = (locale?: string): string => {
    return LOCALE_OPTIONS?.find(item => item?.value === locale)?.label as string || locale || "";
};
