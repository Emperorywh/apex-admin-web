/**
 * @description 从哪月到哪月
 * @date 2025-10-30
 */
import { InputNumber, Space, Typography } from "antd";
import type { InputNumberProps } from "antd";
import { cronIndex } from "@/constants/MissionCluster";
import { useI18n } from "@/hooks/useI18n";

interface FromToInputProps {
    text: string;
    min: number;
    max: number;
    cronValue: string;
    radioValue: string;
    triggerChange: (value: string) => void;
}

export default (props: FromToInputProps) => {

    const { text, min, max, cronValue, radioValue, triggerChange } = props;

    const { t } = useI18n();

    // 起始值变化
    const onFromChange: InputNumberProps["onChange"] = (value) => {
        if (!cronValue || radioValue !== "fromTo") return;
        const splitCron = cronValue.split(" ");
        // 把对应位的项取出来单独处理
        const currentText = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, value + "-" + currentText.split("-")?.[1]).join(" ");
        triggerChange(updateCron);
    };

    // 结束值变化
    const onToChange: InputNumberProps["onChange"] = (value) => {
        if (!cronValue || radioValue !== "fromTo") return;
        const splitCron = cronValue.split(" ");
         // 把对应位的项取出来单独处理
         const currentText = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, currentText.split("-")?.[0] + "-" + value).join(" ");
        triggerChange(updateCron);
    };

    return (
        <Space>
            <Typography.Text>{t("从")}</Typography.Text>
            <InputNumber
                placeholder={t("起始值")}
                min={min}
                max={max}
                disabled={radioValue !== "fromTo"}
                value={radioValue === "fromTo" ? parseInt(cronValue.split(" ")[cronIndex[text]].split("-")?.[0] || "-1", 10) : null}
                onChange={onFromChange}
            />
            <Typography.Text>{t("到")}</Typography.Text>
            <InputNumber
                placeholder={t("结束值")}
                min={min}
                max={max}
                disabled={radioValue !== "fromTo"}
                value={radioValue === "fromTo" ? parseInt(cronValue.split(" ")[cronIndex[text]].split("-")?.[1] || "-1", 10) : null}
                onChange={onToChange}
            />
            <Typography.Text>{t("每{text}执行一次", { text: t(text) })}</Typography.Text>
        </Space>
    )
};
