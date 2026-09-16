/**
 * @description 从几月开始,每几个月执行一次
 * @date 2025-10-30
 */
import { useState } from "react";
import { InputNumber, Space, Typography } from "antd";
import type { InputNumberProps } from "antd";
import { cronIndex } from "@/constants/MissionCluster";
import { useI18n } from "@/hooks/useI18n";

interface FromToIntervalProps {
    text: string;
    min: number;
    max: number;
    cronValue: string;
    radioValue: string;
    triggerChange: (value: string) => void;
}

export default (props: FromToIntervalProps) => {

    const { text, min, max, cronValue, radioValue, triggerChange } = props;

    const { t } = useI18n();

    // 起始值
    // const [fromValue, setFromValue] = useState<number>(1);
    // 间隔值
    // const [intervalValue, setIntervalValue] = useState<number>(1);

    // 起始值变化
    const onFromChange: InputNumberProps["onChange"] = (value) => {
        if (!cronValue) return;
        const splitCron = cronValue.split(" ");
        // 找到对应的值
        const currentValue = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, value + "/" + currentValue.split("/")[1]).join(" ");
        triggerChange(updateCron);
    };

    // 间隔值变化
    const onIntervalChange: InputNumberProps["onChange"] = (value) => {
        if (!cronValue) return;
        const splitCron = cronValue.split(" ");
        // 找到对应的值
        const currentValue = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, currentValue.split("/")[0] + "/" + value).join(" ");
        triggerChange(updateCron);
    };

    return (
        <Space>
            <Typography.Text>{t("从")}</Typography.Text>
            <InputNumber
                placeholder={t("起始值")}
                min={min}
                max={max}
                disabled={radioValue !== "fromInterval"}
                value={radioValue === "fromInterval" ? parseInt(cronValue.split(" ")[cronIndex[text]].split("/")?.[0] || "-1", 10) : null}
                onChange={onFromChange}
            />
            <Typography.Text>{t("{text}开始，每", { text: t(text) })}</Typography.Text>
            <InputNumber
                placeholder={t("间隔值")}
                min={min}
                max={max}
                disabled={radioValue !== "fromInterval"}
                value={radioValue === "fromInterval" ? parseInt(cronValue.split(" ")[cronIndex[text]].split("/")?.[1] || "-1", 10) : null}
                onChange={onIntervalChange}
            />
            <Typography.Text>{t("{text}执行一次", { text: t(text) })}</Typography.Text>
        </Space>
    );
};
