/**
 * @description 时间段选择器（开始时间 + 结束时间 + 快捷选择下拉菜单）
 * @date 2026-8-13
 *
 * 布局：时间段 DatePicker 居左，快捷选择下拉菜单居右。
 * 快捷选项（今天 / 近3天 / 近7天 / 近15天 / 近30天）收纳为下拉菜单，
 * 避免平铺按钮占用过多横向空间。
 *
 * 辅助按钮时间口径（按自然日整点）：
 *   今天    = [今天 00:00:00, 今天 23:59:59]（等价于近1天）；
 *   近 N 天 = [今天-(N-1)天 00:00:00, 今天 23:59:59]，包含今天共 N 个自然日；
 *   近30天  = [今天-29天 00:00:00, 今天 23:59:59]。
 *
 * 两种调用方式：
 *   - 受控：value + onChange
 *   - Form：放在 <Form.Item name="xxx"> 内，Ant Design 通过 cloneElement
 *     自动注入 value/onChange，无需额外配置。
 *
 * value 类型为 [Dayjs | null, Dayjs | null] 元组，
 * 与 Ant Design RangePicker 的 value 结构一致，便于消费方统一处理。
 */
import { memo, useState } from "react";
import { DatePicker, Select, Space } from "antd";
import type { GetProps } from "antd";
import dayjs from "dayjs";
import { useI18n } from "@/hooks/useI18n";

type DatePickerProps = GetProps<typeof DatePicker>;

/**
 * 时间段值：[开始时间, 结束时间]。
 * 两个元素均可为 null（对应未选择），与 Ant Design RangePicker 一致。
 */
export type TimeRangeValue = [Dayjs | null, Dayjs | null];

interface TimeRangePickerProps {
    /** 时间段值 [开始, 结束]，受控/Form 注入 */
    value?: TimeRangeValue;
    /** 时间段变化回调（受控/Form 注入） */
    onChange?: (value: TimeRangeValue) => void;
    /** 开始时间占位文案，默认取 t("开始时间") */
    startPlaceholder?: string;
    /** 结束时间占位文案，默认取 t("结束时间") */
    endPlaceholder?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 自定义类名 */
    className?: string;
}

/**
 * 计算近 N 个自然日的快捷区间。
 * 近 N 天 = [今天-(N-1)天 00:00:00, 今天 23:59:59]，
 * 包含今天在内共 N 个自然日。
 */
function lastNDays(n: number): TimeRangeValue {
    const end = dayjs().endOf("day");
    const start = dayjs().subtract(n - 1, "day").startOf("day");
    return [start, end];
}

/**
 * 计算近 30 天的快捷区间。
 * 近30天 = [今天-29天 00:00:00, 今天 23:59:59]，包含今天共 30 个自然日。
 */
function last30Days(): TimeRangeValue {
    const end = dayjs().endOf("day");
    const start = dayjs().subtract(29, "day").startOf("day");
    return [start, end];
}

/**
 * 快捷辅助按钮配置：label 经 t() 翻译，getRange 返回对应的自然日整点区间。
 */
function useQuickRanges() {
    const { t } = useI18n();
    return [
        // 今天即近1天，复用 lastNDays 的自然日整点口径，区间最短排在最前
        { label: t("今天"), getRange: () => lastNDays(1) },
        { label: t("近3天"), getRange: () => lastNDays(3) },
        { label: t("近7天"), getRange: () => lastNDays(7) },
        { label: t("近15天"), getRange: () => lastNDays(15) },
        { label: t("近30天"), getRange: () => last30Days() },
    ];
}

function TimeRangePicker(props: TimeRangePickerProps) {
    const { value, onChange, startPlaceholder, endPlaceholder, disabled, className } = props;

    const { t } = useI18n();
    const quickRanges = useQuickRanges();

    /*
     * 当前选中的快捷预设标签（内部状态）。
     * 默认回显"近7天"（与消费方初始区间口径一致）；
     * 仅在用户从下拉框选择预设时更新，手动修改 DatePicker 不会联动清除。
     */
    const [quickLabel, setQuickLabel] = useState<string>(t("近7天"));

    /*
     * 快捷预设选择：记录标签用于回显，同时计算自然日整点区间填充两个 DatePicker。
     */
    const handleQuickSelect = (label: string, getRange: () => TimeRangeValue) => {
        setQuickLabel(label);
        onChange?.(getRange());
    };

    /*
     * 开始时间变化：更新元组第 0 位，结束时间保持不变。
     * value 可能为 undefined（初始未赋值），此时第 1 位取 null。
     */
    const onStartChange: DatePickerProps["onChange"] = (dateValue) => {
        onChange?.([dateValue ?? null, value?.[1] ?? null]);
    };

    /*
     * 结束时间变化：更新元组第 1 位，开始时间保持不变。
     * value 可能为 undefined（初始未赋值），此时第 0 位取 null。
     */
    const onEndChange: DatePickerProps["onChange"] = (dateValue) => {
        onChange?.([value?.[0] ?? null, dateValue ?? null]);
    };

    return (
        <Space className={className} align="center">
            {/* 开始时间 DatePicker（最左侧），支持年月日时分秒 */}
            <DatePicker
                showTime={{ format: "HH:mm:ss" }}
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={startPlaceholder ?? t("开始时间")}
                value={value?.[0] ?? null}
                disabled={disabled}
                onChange={onStartChange}
            />
            {/* 结束时间 DatePicker，支持年月日时分秒 */}
            <DatePicker
                showTime={{ format: "HH:mm:ss" }}
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={endPlaceholder ?? t("结束时间")}
                value={value?.[1] ?? null}
                disabled={disabled}
                onChange={onEndChange}
            />
            {/* 快捷预设下拉框（最右侧），回显当前选择的预设名，节省横向空间 */}
            <Select
                value={quickLabel}
                placeholder=""
                style={{ width: 110 }}
                options={quickRanges.map((range) => ({ value: range.label, label: range.label }))}
                onChange={(val) => {
                    const range = quickRanges.find((r) => r.label === val);
                    if (range) handleQuickSelect(range.label, range.getRange);
                }}
                disabled={disabled}
            />
        </Space>
    );
}

export default memo(TimeRangePicker);
