/**
 * @description 时间表达式里面的最后 L
 * @date 2025-11-1
 */
import { Space, InputNumber, Typography } from "antd";
import type { InputNumberProps } from "antd";
import { cronIndex } from "@/constants/MissionCluster";
import { useI18n } from "@/hooks/useI18n";

interface FromToLastProps {
    text: string;
    cronValue: string;
    radioValue: string;
    triggerChange: (value: string) => void;
}

export default (props: FromToLastProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { text, cronValue, radioValue, triggerChange } = props;

    const onLastChange: InputNumberProps["onChange"] = (value) => {
        if (!cronValue || radioValue !== "fromToLast") return;
        const splitCron = cronValue.split(" ");
        // 把对应位的项取出来单独处理
        const currentText = splitCron[cronIndex[text]];
        const updateCron = splitCron.toSpliced(cronIndex[text], 1, value + "L").join(" ");
        triggerChange(updateCron);
    };

    return (
        <Space>
            <Typography.Text>{t("本月最后一个星期")}</Typography.Text>
            <InputNumber
                placeholder={t("请输入周几")}
                min={1}
                max={7}
                precision={0}
                disabled={radioValue !== "fromToLast"}
                value={radioValue === "fromToLast" ? parseInt(cronValue.split(" ")[cronIndex[text]].split("L")?.[0] || "-1", 10) : null}
                onChange={onLastChange}
            />
        </Space>
    )
};
