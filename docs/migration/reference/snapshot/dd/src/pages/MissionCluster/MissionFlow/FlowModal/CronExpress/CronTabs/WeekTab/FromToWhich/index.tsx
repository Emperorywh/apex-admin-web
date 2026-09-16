/**
 * @description 第几个对应星期的#
 * @date 2025-11-1
 */
import { Space, InputNumber, Typography } from "antd";
import type { InputNumberProps } from "antd";
import { cronIndex } from "@/constants/MissionCluster";
import { useI18n } from "@/hooks/useI18n";

interface FromToWhichProps {
    text: string;
    cronValue: string;
    radioValue: string;
    triggerChange: (value: string) => void;
}

export default (props: FromToWhichProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { text, cronValue, radioValue, triggerChange } = props;

    const onFromChange: InputNumberProps["onChange"] = (value) => {
        if (!cronValue || radioValue !== "fromToWhich") return;
        const splitCron = cronValue.split(" ");
        // 把对应位的项取出来单独处理
        const currentText = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, value + "#" + currentText.split("#")?.[1]).join(" ");
        triggerChange(updateCron);
    };

    const onWhichChange: InputNumberProps["onChange"] = (value) => {
        if (!cronValue || radioValue !== "fromToWhich") return;
        const splitCron = cronValue.split(" ");
         // 把对应位的项取出来单独处理
         const currentText = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, currentText.split("#")?.[0] + "#" + value).join(" ");
        triggerChange(updateCron);
    };

    return (
        <Space>
            <Typography.Text>{t("第")}</Typography.Text>
            <InputNumber
                placeholder={t("周")}
                min={1}
                max={4}
                precision={0}
                disabled={radioValue !== "fromToWhich"}
                value={radioValue === "fromToWhich" ? parseInt(cronValue.split(" ")[cronIndex[text]].split("#")?.[0] || "-1", 10) : null}
                onChange={onFromChange}
            />
            <Typography.Text>{t("周，的星期")}</Typography.Text>
            <InputNumber
                placeholder={t("周几")}
                min={1}
                max={7}
                precision={0}
                disabled={radioValue !== "fromToWhich"}
                value={radioValue === "fromToWhich" ? parseInt(cronValue.split(" ")[cronIndex[text]].split("#")?.[1] || "-1", 10) : null}
                onChange={onWhichChange}
            />
        </Space>
    )
};
